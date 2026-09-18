const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// ─── SSL Configuration ────────────────────────────────────────────────────────
// Supabase and most managed PostgreSQL providers require SSL.
// If DATABASE_SSL is explicitly 'false', disable it (local dev without SSL).
// Otherwise default to SSL enabled with rejectUnauthorized: false (for poolers).
function buildSslConfig() {
  const sslEnv = process.env.DATABASE_SSL;
  if (sslEnv === 'false') return false;
  // Enable SSL for Supabase and other managed providers
  return { rejectUnauthorized: false };
}

// ─── Pool ─────────────────────────────────────────────────────────────────────
// DATABASE_URL must be set in .env. No hardcoded credentials.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: buildSslConfig(),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,   // Increased for Supabase cold-start latency
  query_timeout: 15000,
});

let isConnected = false;
let connectionError = null;

// ─── Connection Check ─────────────────────────────────────────────────────────
async function checkDatabaseConnection() {
  if (!process.env.DATABASE_URL) {
    connectionError = 'DATABASE_URL is not set in environment.';
    isConnected = false;
    return false;
  }

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    isConnected = true;
    connectionError = null;
    return true;
  } catch (err) {
    isConnected = false;
    // Store error type/code without credentials
    connectionError = `${err.code || 'CONNECTION_ERROR'}: ${err.message.replace(/(postgresql?:\/\/)[^@]+@/gi, '$1***@')}`;
    return false;
  }
}

// ─── Query Helper ─────────────────────────────────────────────────────────────
async function query(text, params) {
  if (process.env.STRICT_POSTGRES === 'true' && !isConnected) {
    throw new Error(
      `STRICT_POSTGRES mode: PostgreSQL is unreachable. ${connectionError || 'Check DATABASE_URL and network.'}`
    );
  }
  return pool.query(text, params);
}

// ─── Atomic Transaction Helper ────────────────────────────────────────────────
async function executeTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Schema Initialization ────────────────────────────────────────────────────
async function initSchema() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(sql);
      return true;
    }
    return false;
  } catch (err) {
    if (process.env.STRICT_POSTGRES === 'true') {
      throw new Error(`[DB] Schema init failed in STRICT_POSTGRES mode: ${err.message}`);
    }
    console.warn('[DB] Schema init failed (non-strict):', err.message);
    return false;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  pool,
  query,
  executeTransaction,
  checkDatabaseConnection,
  initSchema,
  isConnected: () => isConnected,
  getConnectionError: () => connectionError,
};
