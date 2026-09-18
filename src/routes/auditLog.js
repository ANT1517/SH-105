const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../services/auditLogger');

/**
 * GET /api/audit-log
 * Exposes immutable audit log trail for compliance and safety.
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.query.user_id || 'meera_001';
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

module.exports = router;
