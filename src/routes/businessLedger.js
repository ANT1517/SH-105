const express = require('express');
const router = express.Router();
const { addLedgerEntry, getLedgerEntries, getFinancialState } = require('../services/financialStateStore');
const { logEvent } = require('../services/auditLogger');

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
      if (cst < 0) {
        return res.status(400).json({ error: 'Cost cannot be negative' });
      }
    }

    const entry = await addLedgerEntry(user_id, {
      activity: String(activity || 'business').trim(),
      revenue: rev,
      cost: cst,
      notes: String(notes || '')
    });

    await logEvent({
      user_id,
      action: 'LEDGER_ENTRY_RECORDED',
      entity_type: 'business_ledger',
      entity_id: entry.id,
      new_state: entry,
      metadata: { activity: entry.activity, profit: entry.profit }
    });

    const updatedState = await getFinancialState(user_id);

    return res.status(201).json({
      status: 'success',
      message: 'Business ledger entry recorded successfully',
      ledger_entry: entry,
      updated_financial_state: updatedState
    });
  } catch (err) {
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
