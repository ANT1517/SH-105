/**
 * Immutable Audit Logger Service
 * Owned by Person B
 */

const { query, isConnected } = require('../db/db');

// In-memory fallback log for fast access / offline testing
const inMemoryAuditLogs = [];

/**
 * Logs an event to audit log.
 */
async function logEvent({ user_id, action, entity_type, entity_id, previous_state = null, new_state = null, metadata = {} }) {
  const auditEntry = {
    id: inMemoryAuditLogs.length + 1,
    user_id: user_id || 'meera_001',
    action,
    entity_type,
    entity_id: String(entity_id || ''),
    previous_state,
    new_state,
    metadata,
    created_at: new Date().toISOString()
  };

  inMemoryAuditLogs.unshift(auditEntry);

  // If Postgres is connected, persist to DB asynchronously
  if (isConnected()) {
    try {
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, previous_state, new_state, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          auditEntry.user_id,
          auditEntry.action,
          auditEntry.entity_type,
          auditEntry.entity_id,
          JSON.stringify(previous_state),
          JSON.stringify(new_state),
          JSON.stringify(metadata),
          auditEntry.created_at
        ]
      );
    } catch (err) {
      console.warn('[AuditLogger] Could not persist to DB:', err.message);
    }
  }

  return auditEntry;
}

/**
 * Retrieves audit logs for a user.
 */
async function getAuditLogs(userId, limit = 50) {
  if (isConnected()) {
    try {
      const res = await query(
        `SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [userId, limit]
      );
      if (res.rows.length > 0) {
        return res.rows;
      }
    } catch (err) {
      console.warn('[AuditLogger] Fallback to in-memory logs:', err.message);
    }
  }

  return inMemoryAuditLogs.filter(log => log.user_id === userId).slice(0, limit);
}

/**
 * Clears in-memory audit logs (useful for tests).
 */
function clearAuditLogs() {
  inMemoryAuditLogs.length = 0;
}

module.exports = {
  logEvent,
  getAuditLogs,
  clearAuditLogs
};
