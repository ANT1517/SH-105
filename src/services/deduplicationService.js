/**
 * Duplicate Transaction Detection Service
 * Owned by Person B
 */

const crypto = require('crypto');

// In-memory sliding window cache for fast deduplication check (in addition to DB index)
const recentTransactionsCache = new Map();
const DEDUPLICATION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes window

/**
 * Generates an idempotency hash from transaction parameters.
 */
function generateTransactionHash({ user_id, channel, raw_text, normalized_text, parsed_transaction }) {
  const amount = parsed_transaction?.amount ?? '';
  const category = (parsed_transaction?.category ?? '').trim().toLowerCase();
  const txType = (parsed_transaction?.type ?? '').trim().toLowerCase();
  const normText = (normalized_text || raw_text || '').trim().toLowerCase();

  const payload = `${user_id}|${channel}|${normText}|${amount}|${category}|${txType}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Checks if a transaction is a duplicate within the deduplication window.
 */
function checkDuplicate(txData) {
  const hash = generateTransactionHash(txData);
  const now = Date.now();

  // Clean expired entries in cache
  for (const [key, entry] of recentTransactionsCache.entries()) {
    if (now - entry.timestamp > DEDUPLICATION_WINDOW_MS) {
      recentTransactionsCache.delete(key);
    }
  }

  if (recentTransactionsCache.has(hash)) {
    const existing = recentTransactionsCache.get(hash);
    return {
      isDuplicate: true,
      hash,
      reason: `Duplicate transaction detected within ${DEDUPLICATION_WINDOW_MS / 1000}s window`,
      firstSeenAt: new Date(existing.timestamp).toISOString()
    };
  }

  return {
    isDuplicate: false,
    hash
  };
}

/**
 * Records transaction in deduplication cache.
 */
function recordTransactionInCache(hash, txData) {
  recentTransactionsCache.set(hash, {
    timestamp: Date.now(),
    txData
  });
}

/**
 * Clears deduplication cache (useful for testing).
 */
function clearCache() {
  recentTransactionsCache.clear();
}

module.exports = {
  generateTransactionHash,
  checkDuplicate,
  recordTransactionInCache,
  clearCache,
  DEDUPLICATION_WINDOW_MS
};
