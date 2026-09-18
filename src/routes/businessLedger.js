const express = require('express');
const router = express.Router();
const { addLedgerEntry, getLedgerEntries, getFinancialState, syncLedgerMemory } = require('../services/financialStateStore');
const { logEvent, syncAuditLogToMemory } = require('../services/auditLogger');
const { executeTransaction, isConnected } = require('../db/db');

/**
 * POST /api/ledger
 * Ingests informal business activity sale/cost entry.
 * Calculates revenue, cost, profit, and updates business state.
 * Supports revenue only, cost only, zero, cost > revenue (loss), and decimals.
 */
router.post('/', async (req, res) => {
  try {
    const body = req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Request body must be a valid JSON object' });
    }

    const {
      user_id = 'meera_001',
      activity = 'pickle sales + tailoring',
      revenue,
      cost,
      notes = ''
    } = body;

    // Validate revenue if provided (or default to 0)
    let rev = 0;
    if (revenue !== undefined && revenue !== null) {
      const revStr = String(revenue).trim();
      if (revStr === '' || isNaN(Number(revStr))) {
        return res.status(400).json({ error: 'Revenue must be a valid number' });
      }
      rev = Number(revStr);
      if (!isFinite(rev) || isNaN(rev)) {
        return res.status(400).json({ error: 'Revenue must be a finite number' });
      }
      if (rev < 0) {
        return res.status(400).json({ error: 'Revenue cannot be negative' });
      }
    }

    // Validate cost if provided (or default to 0)
    let cst = 0;
    if (cost !== undefined && cost !== null) {
      const cstStr = String(cost).trim();
      if (cstStr === '' || isNaN(Number(cstStr))) {
        return res.status(400).json({ error: 'Cost must be a valid number' });
      }
      cst = Number(cstStr);
      if (!isFinite(cst) || isNaN(cst)) {
        return res.status(400).json({ error: 'Cost must be a finite number' });
      }
      if (cst < 0) {
        return res.status(400).json({ error: 'Cost cannot be negative' });
      }
    }

    const trimmedUserId = String(user_id || 'meera_001').trim();
    const trimmedActivity = String(activity || 'pickle sales + tailoring').trim();
    const profit = rev - cst;
    const createdAt = new Date().toISOString();

    let entry = null;
    let auditEntry = null;

    if (isConnected()) {
      await executeTransaction(async (client) => {
        // a. Ensure user exists
        await client.query(
          `INSERT INTO users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
          [trimmedUserId, trimmedUserId]
        );

        // b. Insert ledger entry
        const result = await client.query(
          `INSERT INTO ledger_entries (user_id, activity, revenue, cost, profit, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [trimmedUserId, trimmedActivity, rev, cst, profit, String(notes || ''), createdAt]
        );

        const dbId = result.rows[0]?.id;

        // c. Update business pot if profitable
        if (profit > 0) {
          await client.query(
            `INSERT INTO pots (user_id, pot_type, amount, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (user_id, pot_type) DO UPDATE
               SET amount = pots.amount + $3, updated_at = NOW()`,
            [trimmedUserId, 'business', profit]
          );
        }

        entry = {
          id: dbId,
          user_id: trimmedUserId,
          activity: trimmedActivity,
          revenue: rev,
          cost: cst,
          profit,
          notes: notes || null,
          created_at: createdAt
        };

        // d. Audit log — same transaction
        auditEntry = await logEvent({
          user_id: trimmedUserId,
          action: 'LEDGER_ENTRY_RECORDED',
          entity_type: 'business_ledger',
          entity_id: String(dbId || ''),
          new_state: entry,
          metadata: { activity: trimmedActivity, profit },
          client
        });
      });

      // Sync memory ONLY after successful DB commit
      if (entry) syncLedgerMemory(entry);
      if (auditEntry) syncAuditLogToMemory(auditEntry);
    } else {
      // Offline / mock fallback — memory only
      entry = await addLedgerEntry(trimmedUserId, {
        activity: trimmedActivity,
        revenue: rev,
        cost: cst,
        notes: String(notes || '')
      });
      await logEvent({
        user_id: trimmedUserId,
        action: 'LEDGER_ENTRY_RECORDED',
        entity_type: 'business_ledger',
        entity_id: String(entry.id || ''),
        new_state: entry,
        metadata: { activity: trimmedActivity, profit }
      });
    }

    const updatedState = await getFinancialState(trimmedUserId);

    return res.status(201).json({
      status: 'success',
      message: 'Business ledger entry recorded successfully',
      ledger_entry: entry,
      updated_financial_state: updatedState
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[BusinessLedger Route] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error processing ledger entry' });
  }
});

/**
 * GET /api/ledger
 * Retrieves business ledger entries for a user.
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.query.user_id || 'meera_001';
    const entries = await getLedgerEntries(userId);
    return res.status(200).json({
      user_id: userId,
      count: entries.length,
      entries
    });
  } catch (err) {
    console.error('[BusinessLedger Route] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error retrieving ledger entries' });
  }
});

module.exports = router;
