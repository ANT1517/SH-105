const express = require('express');
const router = express.Router();
const { checkDuplicate, recordTransactionInCache } = require('../services/deduplicationService');
const { mapCategoryToPot } = require('../services/potCalculator');
const { addTransaction, updatePotBalance, getFinancialState } = require('../services/financialStateStore');
const { logEvent } = require('../services/auditLogger');

/**
 * POST /api/transactions
 * Ingests normalized financial input from Person A.
 * Strictly adheres to Person A contract without modifying payload schema.
 */
router.post('/', async (req, res) => {
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

    // Field-by-field strict validation for Person A Contract
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

    if (parsed_transaction.category === undefined || parsed_transaction.category === null || typeof parsed_transaction.category !== 'string' || parsed_transaction.category.trim() === '') {
      return res.status(400).json({ error: 'Field "parsed_transaction.category" is required and must be a non-empty string' });
    }

    if (confidence !== undefined && confidence !== null) {
      const confNum = Number(confidence);
      if (isNaN(confNum) || confNum < 0.0 || confNum > 1.0) {
        return res.status(400).json({ error: 'Field "confidence" must be a valid number between 0.0 and 1.0' });
      }
    }

    const txType = parsed_transaction.type.trim().toLowerCase();
    const category = parsed_transaction.category.trim();

    // Step 1: Duplicate Transaction Detection
    const dupCheck = checkDuplicate({
      user_id: user_id.trim(),
      channel: channel.trim(),
      raw_text,
      normalized_text,
      parsed_transaction: {
        type: txType,
        amount,
        category
      }
    });

    if (dupCheck.isDuplicate) {
      await logEvent({
        user_id: user_id.trim(),
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

    // Step 2: Internal Category-to-Pot Mapping (Person B responsibility)
    const targetPot = mapCategoryToPot(category);

    // Step 3: Create transaction record
    const txRecord = {
      transaction_hash: dupCheck.hash,
      user_id: user_id.trim(),
      channel: channel.trim(),
      input_type: input_type.trim(),
      raw_text,
      normalized_text,
      tx_type: txType,
      amount,
      category,
      target_pot: targetPot,
      confidence: confidence !== undefined && confidence !== null ? Number(confidence) : 1.0,
      created_at: new Date().toISOString()
    };

    await addTransaction(txRecord);
    recordTransactionInCache(dupCheck.hash, txRecord);

    // Step 4: Update target pot balance
    const potOperation = (txType === 'expense') ? 'subtract' : 'add';
    const potUpdate = await updatePotBalance(user_id.trim(), targetPot, amount, potOperation);

    // Step 5: Immutable Audit Logging
    await logEvent({
      user_id: user_id.trim(),
      action: 'TRANSACTION_INGESTED',
      entity_type: 'transaction',
      entity_id: dupCheck.hash,
      new_state: potUpdate,
      metadata: { txRecord, targetPot }
    });

    // Step 6: Return updated financial state
    const updatedState = await getFinancialState(user_id.trim());

    return res.status(201).json({
      status: 'success',
      message: 'Transaction ingested and pot balance updated successfully',
      transaction: txRecord,
      pot_affected: targetPot,
      updated_financial_state: updatedState
    });

  } catch (err) {
    console.error('[Transactions Route] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error processing transaction' });
  }
});

module.exports = router;
