const express = require('express');
const router = express.Router();
const { checkDuplicate, recordTransactionInCache } = require('../services/deduplicationService');
const { mapCategoryToPot } = require('../services/potCalculator');
const { getFinancialState, syncMemoryPotFromDb } = require('../services/financialStateStore');
const { logEvent, removeAuditLogByEntityId } = require('../services/auditLogger');
const { query, executeTransaction, isConnected } = require('../db/db');

/**
 * POST /api/transactions
 * Ingests normalized financial input from Person A.
 *
 * When PostgreSQL is connected:
 *   All writes (transaction insert, pot update, audit log) execute inside a
 *   single BEGIN/COMMIT block using the same DB client.
 *   Any failure triggers ROLLBACK — no partial state is ever committed.
 *
 * When PostgreSQL is not connected:
 *   Falls back to in-memory only (development/offline mode).
 *
 * Strictly adheres to Person A contract without modifying payload schema.
 */
router.post('/', async (req, res) => {
  let dupCheck = null;
  try {
    const body = req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length === 0) {
      return res.status(400).json({ error: 'Request body must be a non-empty JSON object' });
    }

    const {
      user_id,
      channel,
      input_type,
      raw_text,
      normalized_text,
      parsed_transaction,
      confidence
    } = body;

    // ─── Field-by-field strict validation (Person A Contract) ────────────────
    if (user_id === undefined || user_id === null || typeof user_id !== 'string' || user_id.trim() === '') {
      return res.status(400).json({ error: 'Field "user_id" is required and must be a non-empty string' });
    }

    if (channel === undefined || channel === null || typeof channel !== 'string' || channel.trim() === '') {
      return res.status(400).json({ error: 'Field "channel" is required and must be a non-empty string' });
    }

    if (input_type === undefined || input_type === null || typeof input_type !== 'string' || input_type.trim() === '') {
      return res.status(400).json({ error: 'Field "input_type" is required and must be a non-empty string' });
    }

    if (raw_text === undefined || raw_text === null || typeof raw_text !== 'string') {
      return res.status(400).json({ error: 'Field "raw_text" is required and must be a string' });
    }

    if (normalized_text === undefined || normalized_text === null || typeof normalized_text !== 'string') {
      return res.status(400).json({ error: 'Field "normalized_text" is required and must be a string' });
    }

    if (!parsed_transaction || typeof parsed_transaction !== 'object' || Array.isArray(parsed_transaction)) {
      return res.status(400).json({ error: 'Field "parsed_transaction" is required and must be an object' });
    }

    if (!parsed_transaction.type || typeof parsed_transaction.type !== 'string' || parsed_transaction.type.trim() === '') {
      return res.status(400).json({ error: 'Field "parsed_transaction.type" is required and must be a non-empty string' });
    }

    if (parsed_transaction.amount === undefined || parsed_transaction.amount === null) {
      return res.status(400).json({ error: 'Field "parsed_transaction.amount" is required' });
    }

    const rawAmountStr = String(parsed_transaction.amount).trim();
    if (rawAmountStr === '' || isNaN(Number(rawAmountStr))) {
      return res.status(400).json({ error: 'Field "parsed_transaction.amount" must be a valid number' });
    }

    const amount = Number(rawAmountStr);
    if (amount <= 0) {
      return res.status(400).json({ error: 'Field "parsed_transaction.amount" must be greater than zero' });
    }

    if (
      parsed_transaction.category === undefined ||
      parsed_transaction.category === null ||
      typeof parsed_transaction.category !== 'string' ||
      parsed_transaction.category.trim() === ''
    ) {
      return res.status(400).json({ error: 'Field "parsed_transaction.category" is required and must be a non-empty string' });
    }

    if (confidence !== undefined && confidence !== null) {
      const confNum = Number(confidence);
      if (isNaN(confNum) || confNum < 0.0 || confNum > 1.0) {
        return res.status(400).json({ error: 'Field "confidence" must be a valid number between 0.0 and 1.0' });
      }
    }

    const trimmedUserId = user_id.trim();
    const txType = parsed_transaction.type.trim().toLowerCase();
    const category = parsed_transaction.category.trim();
    const confValue = confidence !== undefined && confidence !== null ? Number(confidence) : 1.0;
    const createdAt = new Date().toISOString();

    // ─── Step 1: Duplicate detection (memory cache — no DB write) ────────────
    dupCheck = checkDuplicate({
      user_id: trimmedUserId,
      channel: channel.trim(),
      raw_text,
      normalized_text,
      parsed_transaction: { type: txType, amount, category }
    });

    if (dupCheck.isDuplicate) {
      await logEvent({
        user_id: trimmedUserId,
        action: 'DUPLICATE_TRANSACTION_BLOCKED',
        entity_type: 'transaction',
        entity_id: dupCheck.hash,
        metadata: { reason: dupCheck.reason, raw_text, amount, category }
      });

      return res.status(409).json({
        status: 'duplicate',
        message: 'Duplicate transaction detected. Ignored to protect financial memory.',
        details: dupCheck
      });
    }

    // ─── Step 1b: Database-level duplicate pre-check ────────────────────────
    // If in-memory cache missed (e.g. server restart, multi-instance, cache reset),
    // check the persistent database as the authoritative source of truth.
    if (isConnected()) {
      try {
        const existingTx = await query(
          `SELECT created_at FROM transactions WHERE transaction_hash = $1 LIMIT 1`,
          [dupCheck.hash]
        );
        if (existingTx.rows.length > 0) {
          recordTransactionInCache(dupCheck.hash, {
            user_id: trimmedUserId,
            channel: channel.trim(),
            raw_text,
            normalized_text,
            tx_type: txType,
            amount,
            category
          });

          await logEvent({
            user_id: trimmedUserId,
            action: 'DUPLICATE_TRANSACTION_BLOCKED',
            entity_type: 'transaction',
            entity_id: dupCheck.hash,
            metadata: {
              reason: 'Duplicate transaction detected in persistent database',
              raw_text,
              amount,
              category
            }
          });

          return res.status(409).json({
            status: 'duplicate',
            message: 'Duplicate transaction detected. Ignored to protect financial memory.',
            details: {
              isDuplicate: true,
              hash: dupCheck.hash,
              reason: 'Duplicate transaction detected in persistent database',
              firstSeenAt: existingTx.rows[0].created_at
            }
          });
        }
      } catch (dbCheckErr) {
        console.warn('[Transactions Route] DB duplicate pre-check warning:', dbCheckErr.message);
      }
    }

    // ─── Step 2: Map category → pot ──────────────────────────────────────────
    const targetPot = mapCategoryToPot(category);
    const potOperation = (txType === 'expense') ? 'subtract' : 'add';

    const txRecord = {
      transaction_hash: dupCheck.hash,
      user_id: trimmedUserId,
      channel: channel.trim(),
      input_type: input_type.trim(),
      raw_text,
      normalized_text,
      tx_type: txType,
      amount,
      category,
      target_pot: targetPot,
      confidence: confValue,
      created_at: createdAt
    };

    // ─── Step 3: Atomic database transaction ─────────────────────────────────
    // All three writes (transaction, pot update, audit log) share ONE connection.
    // If ANY step throws, the entire transaction is rolled back automatically.
    let potUpdate = null;

    if (isConnected()) {
      await executeTransaction(async (client) => {
        // 3a. Ensure user exists (upsert) so FK constraint is satisfied
        await client.query(
          `INSERT INTO users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
          [trimmedUserId, trimmedUserId]
        );

        // 3b. Insert transaction record (with database-level uniqueness enforcement)
        const txResult = await client.query(
          `INSERT INTO transactions
             (transaction_hash, user_id, channel, input_type, raw_text, normalized_text,
              tx_type, amount, category, target_pot, confidence, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (transaction_hash) DO NOTHING
           RETURNING id`,
          [
            txRecord.transaction_hash, txRecord.user_id, txRecord.channel,
            txRecord.input_type, txRecord.raw_text, txRecord.normalized_text,
            txRecord.tx_type, txRecord.amount, txRecord.category,
            txRecord.target_pot, txRecord.confidence, txRecord.created_at
          ]
        );

        if (txResult.rows.length === 0) {
          const dupErr = new Error('Duplicate transaction detected at database level');
          dupErr.isDuplicate = true;
          throw dupErr;
        }

        // 3c. Upsert pot balance atomically
        const potResult = await client.query(
          `INSERT INTO pots (user_id, pot_type, amount, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_id, pot_type) DO UPDATE
             SET amount = CASE
               WHEN $4 = 'subtract'
               THEN GREATEST(0, pots.amount - $3)
               ELSE pots.amount + $3
             END,
             updated_at = NOW()
           RETURNING amount`,
          [trimmedUserId, targetPot, amount, potOperation]
        );

        const newAmount = potResult.rows[0] ? Number(potResult.rows[0].amount) : amount;
        potUpdate = { potType: targetPot, newAmount };

        // 3d. Insert audit log record atomically using same client
        await logEvent({
          user_id: trimmedUserId,
          action: 'TRANSACTION_INGESTED',
          entity_type: 'transaction',
          entity_id: txRecord.transaction_hash,
          new_state: potUpdate,
          metadata: { txRecord, targetPot },
          client
        });
      });

      // ─── Step 4: Memory sync AFTER successful commit ──────────────────────
      // Memory is never written before the DB commits.
      if (potUpdate) {
        syncMemoryPotFromDb(targetPot, potUpdate.newAmount);
      }
    } else {
      // ─── Offline / development fallback ──────────────────────────────────
      // Memory-only path: used only when PostgreSQL is not available.
      const { addTransaction, updatePotBalance } = require('../services/financialStateStore');
      await addTransaction(txRecord);
      potUpdate = await updatePotBalance(trimmedUserId, targetPot, amount, potOperation);

      await logEvent({
        user_id: trimmedUserId,
        action: 'TRANSACTION_INGESTED',
        entity_type: 'transaction',
        entity_id: txRecord.transaction_hash,
        new_state: potUpdate,
        metadata: { txRecord, targetPot }
      });
    }

    // ─── Step 5: Record in deduplication cache (post-commit only) ────────────
    recordTransactionInCache(dupCheck.hash, txRecord);

    // ─── Step 6: Return updated financial state ───────────────────────────────
    const updatedState = await getFinancialState(trimmedUserId);

    return res.status(201).json({
      status: 'success',
      message: 'Transaction ingested and pot balance updated successfully',
      transaction: txRecord,
      pot_affected: targetPot,
      updated_financial_state: updatedState
    });

  } catch (err) {
    if (dupCheck && dupCheck.hash) {
      removeAuditLogByEntityId(dupCheck.hash);
    }

    if (err.isDuplicate || err.code === '23505') {
      const rawTextVal = req.body?.raw_text || '';
      const amountVal = req.body?.parsed_transaction?.amount;
      const catVal = req.body?.parsed_transaction?.category;

      if (dupCheck && dupCheck.hash) {
        recordTransactionInCache(dupCheck.hash, {
          user_id: req.body?.user_id,
          raw_text: rawTextVal,
          amount: amountVal,
          category: catVal
        });

        await logEvent({
          user_id: req.body?.user_id ? String(req.body.user_id).trim() : 'meera_001',
          action: 'DUPLICATE_TRANSACTION_BLOCKED',
          entity_type: 'transaction',
          entity_id: dupCheck.hash,
          metadata: {
            reason: 'Duplicate transaction detected at database level (unique constraint)',
            raw_text: rawTextVal,
            amount: amountVal,
            category: catVal
          }
        });
      }

      return res.status(409).json({
        status: 'duplicate',
        message: 'Duplicate transaction detected. Ignored to protect financial memory.',
        details: {
          isDuplicate: true,
          hash: dupCheck ? dupCheck.hash : null,
          reason: 'Duplicate transaction detected at database level'
        }
      });
    }

    console.error('[Transactions Route] Atomic transaction failed:', err.message);
    return res.status(500).json({ error: 'Internal server error processing transaction' });
  }
});

module.exports = router;
