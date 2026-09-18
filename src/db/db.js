const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/saathi_db',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

let isConnected = false;

// Check connection on startup
async function checkDatabaseConnection() {
  try {
    const client = await pool.connect();
    isConnected = true;
    client.release();
    return true;
  } catch (err) {
    isConnected = false;
    return false;
  }
}

// Execute query helper
async function query(text, params) {
  if (process.env.STRICT_POSTGRES === 'true' && !isConnected) {
    throw new Error('STRICT_POSTGRES mode enabled but PostgreSQL is unreachable.');
  }
  return pool.query(text, params);
}

// Transaction execution helper with atomic rollback on failure
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

// Run schema initialization
async function initSchema() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(sql);
      return true;
    }
  } catch (err) {
    if (process.env.STRICT_POSTGRES === 'true') {
      throw new Error(`[DB] Schema init failed in STRICT_POSTGRES mode: ${err.message}`);
    }
    return false;
  }
}

module.exports = {
  pool,
  query,
  executeTransaction,
  checkDatabaseConnection,
  initSchema,
  isConnected: () => isConnected,
};
