const express = require('express');
const router = express.Router();
const meeraFixture = require('../fixtures/meeraFixture.json');
const { getFinancialState } = require('../services/financialStateStore');
const { logEvent } = require('../services/auditLogger');
const { resolveUserId } = require('../services/userResolver');

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
    // Twilio/WhatsApp callers send "whatsapp:+91..."; resolve mapped phone numbers to their user (PHONE_USER_MAP).
    // Unmapped phone numbers are an unknown user (404). Nothing here ever creates a user.
    const resolved = resolveUserId(String(req.query.user_id || 'meera_001').trim());
    if (resolved.error) {
      return res.status(404).json({ error: 'unknown_user', message: resolved.error });
    }
    const userId = resolved.userId;
    
    // If explicit mock requested
    if (req.query.mock === 'true') {
      return res.status(200).json(meeraFixture);
    }

    const state = await getFinancialState(userId);
    if (!state) {
      return res.status(404).json({ error: 'unknown_user', message: `No financial state exists for user_id "${userId}"` });
    }
    
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
