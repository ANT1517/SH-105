const express = require('express');
const router = express.Router();
const meeraFixture = require('../fixtures/meeraFixture.json');
const { getFinancialState } = require('../services/financialStateStore');
const { logEvent } = require('../services/auditLogger');

/**
 * GET /api/financial-state/mock
 * Hour 0-2 contract mock serving Section 2 fixture directly.
 */
router.get('/mock', (req, res) => {
  return res.status(200).json(meeraFixture);
});

/**
 * GET /api/financial-state
 * Serves unified Money Pot Map financial state for Person C (Guidance) and Person D (Dashboard).
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.query.user_id || 'meera_001';
    
    // If explicit mock requested
    if (req.query.mock === 'true') {
      return res.status(200).json(meeraFixture);
    }

    const state = await getFinancialState(userId);
    
    await logEvent({
      user_id: userId,
      action: 'STATE_READ',
      entity_type: 'financial_state',
      entity_id: userId,
      new_state: { total_balance: state.total_balance }
    });

    return res.status(200).json(state);
  } catch (err) {
    console.error('[FinancialState Route] Error:', err);
    return res.status(500).json({ error: 'Internal server error fetching financial state' });
  }
});

module.exports = router;
