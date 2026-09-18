const express = require('express');
const router = express.Router();
const { getAuditLogs, logEvent } = require('../services/auditLogger');
const { getFinancialState } = require('../services/financialStateStore');
const { resolveUserId, resolveOrReject } = require('../services/userResolver');

// Actions external services (Person C) may record. Person B's own actions (TRANSACTION_INGESTED,
// STATE_READ, GOAL_UPDATED, ...) are deliberately NOT accepted here so the HTTP API can't forge them.
const EXTERNAL_ACTIONS = ['GUIDANCE_GIVEN', 'SAFETY_CHECK_PERFORMED', 'SIMULATOR_RUN'];

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * GET /api/audit-log
 * Exposes immutable audit log trail for compliance and safety.
 */
router.get('/', async (req, res) => {
  try {
    const userId = resolveOrReject(res, req.query.user_id || 'meera_001');
    if (!userId) return;
    const limit = Number(req.query.limit) || 50;
    const logs = await getAuditLogs(userId, limit);

    return res.status(200).json({
      user_id: userId,
      count: logs.length,
      logs
    });
  } catch (err) {
    console.error('[AuditLog Route] Error:', err);
    return res.status(500).json({ error: 'Internal server error retrieving audit logs' });
  }
});

/**
 * POST /api/audit-log
 * Lets other services (Person C) record guidance/safety/simulator events in the audit trail.
 * Body: { user_id, action, entity_type, entity_id?, metadata? }
 */
router.post('/', async (req, res) => {
  try {
    const { user_id, action, entity_type, entity_id, metadata } = req.body || {};

    if (!isNonEmptyString(user_id)) {
      return res.status(400).json({ error: 'Field "user_id" is required and must be a non-empty string' });
    }
    if (!EXTERNAL_ACTIONS.includes(action)) {
      return res.status(400).json({ error: `Field "action" must be one of: ${EXTERNAL_ACTIONS.join(', ')}` });
    }
    if (!isNonEmptyString(entity_type)) {
      return res.status(400).json({ error: 'Field "entity_type" is required and must be a non-empty string' });
    }
    if (entity_id !== undefined && entity_id !== null && typeof entity_id !== 'string' && typeof entity_id !== 'number') {
      return res.status(400).json({ error: 'Field "entity_id" must be a string or number' });
    }
    if (metadata !== undefined && (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata))) {
      return res.status(400).json({ error: 'Field "metadata" must be a JSON object' });
    }

    // Same phone -> user resolution as POST /api/transactions and GET /api/financial-state.
    // Unmapped phone numbers are an unknown user (404); no user is ever created here.
    const resolved = resolveUserId(user_id.trim());
    if (resolved.error) {
      return res.status(404).json({ error: 'unknown_user', message: resolved.error });
    }
    const userId = resolved.userId;
    // Same rule as GET /api/financial-state: unknown users are surfaced, not silently attributed to someone else
    // (and the audit_logs FK would otherwise drop the row while still reporting success).
    if (!(await getFinancialState(userId))) {
      return res.status(404).json({ error: 'unknown_user', message: `No financial state exists for user_id "${userId}"` });
    }

    const entry = await logEvent({
      user_id: userId,
      action,
      entity_type: entity_type.trim(),
      entity_id,
      metadata: metadata || {}
    });

    return res.status(201).json({ status: 'success', entry });
  } catch (err) {
    console.error('[AuditLog Route] Error:', err);
    return res.status(500).json({ error: 'Internal server error recording audit log' });
  }
});

module.exports = router;
