/**
 * Database-Level Idempotency Test Suite (Phase 4)
 *
 * Verifies that duplicate financial transactions are strictly prevented under all circumstances:
 *   1. Same transaction submitted twice
 *   2. Same transaction after process restart (in-memory state reset)
 *   3. 5 simultaneous duplicate requests (race condition safety)
 *   4. 10 simultaneous independent transactions (concurrency without interference)
 *   5. Duplicate transaction hash at database level (unique constraint enforcement)
 *   6. Duplicate handling after cache reset (in-memory cache cleared)
 *
 * Verifies that duplicates NEVER:
 *   - Create another transaction row in PostgreSQL
 *   - Double-count or change the pot balance twice
 *   - Create duplicate TRANSACTION_INGESTED audit records
 */

require('dotenv').config();
const request = require('supertest');
const app = require('../../src/server');
const { pool, checkDatabaseConnection, initSchema, query } = require('../../src/db/db');
const { seedMeera } = require('../../src/db/seed');
const { resetState } = require('../../src/services/financialStateStore');
const { clearCache } = require('../../src/services/deduplicationService');
const { clearAuditLogs } = require('../../src/services/auditLogger');

// Isolated test user per run
const TEST_USER = `idemp_user_${Date.now()}`;

const MAKE_TX = (suffix = '', amount = 500, category = 'bank deposit') => ({
  user_id: TEST_USER,
  channel: 'whatsapp_voice',
  input_type: 'voice',
  raw_text: `earned ${amount} ${category} ${suffix}`,
  normalized_text: `earned ${amount} ${category} ${suffix}`,
  parsed_transaction: {
    type: 'income',
    amount,
    category
  },
  confidence: 0.95
});

describe('Database-Level Idempotency & Concurrency Suite (Phase 4)', () => {
  let dbConnected = false;

  beforeAll(async () => {
    dbConnected = await checkDatabaseConnection();
    if (!dbConnected) return;
    await initSchema();
    await seedMeera();

    // Initialize isolated test user with initial pot
    await query('INSERT INTO users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [TEST_USER, 'Idempotency User']);
    await query('INSERT INTO pots (user_id, pot_type, amount) VALUES ($1, $2, $3) ON CONFLICT (user_id, pot_type) DO NOTHING',
      [TEST_USER, 'bank', 5000]);
  });

  afterAll(async () => {
    if (dbConnected) {
      await query('DELETE FROM users WHERE id = $1', [TEST_USER]);
    }
    try { await pool.end(); } catch (_) {}
  });

  beforeEach(() => {
    clearCache();
    clearAuditLogs();
  });

  function requireDb() {
    if (!dbConnected) throw new Error('PostgreSQL is unreachable — test requires live DB.');
  }

  // ─── Scenario 1: Same transaction submitted twice ───────────────────────────
  it('1. Same transaction submitted twice: 1st returns 201, 2nd returns 409 duplicate', async () => {
    requireDb();

    const tx = MAKE_TX(`_twice_${Date.now()}`);
    const potBefore = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    const balanceBefore = Number(potBefore.rows[0].amount);

    // 1st submission
    const res1 = await request(app).post('/api/transactions').send(tx);
    expect(res1.status).toBe(201);
    expect(res1.body.status).toBe('success');
    const txHash = res1.body.transaction.transaction_hash;

    // 2nd submission (exact duplicate)
    const res2 = await request(app).post('/api/transactions').send(tx);
    expect(res2.status).toBe(409);
    expect(res2.body.status).toBe('duplicate');
    expect(res2.body.details.isDuplicate).toBe(true);

    // Verify DB: exactly 1 transaction row
    const txRows = await query('SELECT * FROM transactions WHERE transaction_hash = $1', [txHash]);
    expect(txRows.rows.length).toBe(1);

    // Verify Pot: incremented exactly once (+500, not +1000)
    const potAfter = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    expect(Number(potAfter.rows[0].amount)).toBe(balanceBefore + 500);

    // Verify Audit Log: exactly 1 TRANSACTION_INGESTED record
    const auditIngested = await query(
      `SELECT * FROM audit_logs WHERE user_id = $1 AND action = 'TRANSACTION_INGESTED' AND entity_id = $2`,
      [TEST_USER, txHash]
    );
    expect(auditIngested.rows.length).toBe(1);
  });

  // ─── Scenario 2: Same transaction after process restart ─────────────────────
  it('2. Same transaction after process restart: rejected via DB record', async () => {
    requireDb();

    const tx = MAKE_TX(`_restart_${Date.now()}`);

    // Initial submission
    const res1 = await request(app).post('/api/transactions').send(tx);
    expect(res1.status).toBe(201);
    const txHash = res1.body.transaction.transaction_hash;

    const potAfterFirst = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    const balanceAfterFirst = Number(potAfterFirst.rows[0].amount);

    // Simulate process restart: wipe all in-memory caches and stores
    clearCache();
    resetState();
    clearAuditLogs();

    // Re-submit identical transaction
    const res2 = await request(app).post('/api/transactions').send(tx);
    expect(res2.status).toBe(409);
    expect(res2.body.status).toBe('duplicate');

    // Verify DB: still exactly 1 transaction row
    const txRows = await query('SELECT * FROM transactions WHERE transaction_hash = $1', [txHash]);
    expect(txRows.rows.length).toBe(1);

    // Verify Pot: unchanged after duplicate attempt
    const potAfterRestart = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    expect(Number(potAfterRestart.rows[0].amount)).toBe(balanceAfterFirst);
  });

  // ─── Scenario 3: 5 simultaneous duplicate requests ─────────────────────────
  it('3. 5 simultaneous duplicate requests: exactly 1 succeeds (201), 4 rejected (409)', async () => {
    requireDb();

    const tx = MAKE_TX(`_concurrent_dup_${Date.now()}`);
    const potBefore = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    const balanceBefore = Number(potBefore.rows[0].amount);

    // Fire 5 identical requests concurrently
    const promises = Array.from({ length: 5 }, () =>
      request(app).post('/api/transactions').send(tx)
    );
    const responses = await Promise.all(promises);

    const successResponses = responses.filter(r => r.status === 201);
    const duplicateResponses = responses.filter(r => r.status === 409);

    expect(successResponses.length).toBe(1);
    expect(duplicateResponses.length).toBe(4);

    const txHash = successResponses[0].body.transaction.transaction_hash;

    // Verify DB: exactly 1 transaction row in PostgreSQL
    const txRows = await query('SELECT * FROM transactions WHERE transaction_hash = $1', [txHash]);
    expect(txRows.rows.length).toBe(1);

    // Verify Pot: incremented exactly once (+500, never +2500)
    const potAfter = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    expect(Number(potAfter.rows[0].amount)).toBe(balanceBefore + 500);

    // Verify Audit: exactly 1 TRANSACTION_INGESTED record
    const auditIngested = await query(
      `SELECT * FROM audit_logs WHERE user_id = $1 AND action = 'TRANSACTION_INGESTED' AND entity_id = $2`,
      [TEST_USER, txHash]
    );
    expect(auditIngested.rows.length).toBe(1);
  }, 15000);

  // ─── Scenario 4: 10 simultaneous independent transactions ───────────────────
  it('4. 10 simultaneous independent transactions: all 10 succeed without losing updates', async () => {
    requireDb();

    const potBefore = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    const balanceBefore = Number(potBefore.rows[0].amount);

    // 10 distinct, independent transactions
    const promises = Array.from({ length: 10 }, (_, i) =>
      request(app).post('/api/transactions').send(MAKE_TX(`_indep_${i}_${Date.now()}`, 100))
    );
    const responses = await Promise.all(promises);

    responses.forEach((res) => {
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
    });

    // Verify DB: pot balance correctly updated by exactly 10 × 100 = +1000
    const potAfter = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    expect(Number(potAfter.rows[0].amount)).toBe(balanceBefore + 1000);
  }, 20000);

  // ─── Scenario 5: Duplicate transaction hash at database level ───────────────
  it('5. Duplicate transaction hash at database level: PostgreSQL rejects with unique violation (23505)', async () => {
    requireDb();

    const rawHash = `db_unique_constraint_${Date.now()}`;

    // Direct insertion of 1st row
    await query(
      `INSERT INTO transactions
         (transaction_hash, user_id, channel, input_type, raw_text, normalized_text,
          tx_type, amount, category, target_pot, confidence, created_at)
       VALUES ($1, $2, 'whatsapp', 'text', 'test', 'test', 'income', 250, 'bank', 'bank', 1.0, NOW())`,
      [rawHash, TEST_USER]
    );

    // Direct insertion of 2nd row with same hash MUST fail at database level
    let dbError = null;
    try {
      await query(
        `INSERT INTO transactions
           (transaction_hash, user_id, channel, input_type, raw_text, normalized_text,
            tx_type, amount, category, target_pot, confidence, created_at)
         VALUES ($1, $2, 'whatsapp', 'text', 'test', 'test', 'income', 250, 'bank', 'bank', 1.0, NOW())`,
        [rawHash, TEST_USER]
      );
    } catch (err) {
      dbError = err;
    }

    expect(dbError).not.toBeNull();
    // 23505 is PostgreSQL error code for unique_violation
    expect(dbError.code).toBe('23505');
  });

  // ─── Scenario 6: Duplicate handling after cache reset ───────────────────────
  it('6. Duplicate handling after cache reset: clearCache() does not bypass database duplicate protection', async () => {
    requireDb();

    const tx = MAKE_TX(`_cache_reset_${Date.now()}`);

    // First ingestion
    const res1 = await request(app).post('/api/transactions').send(tx);
    expect(res1.status).toBe(201);
    const txHash = res1.body.transaction.transaction_hash;

    const potAfterFirst = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    const balanceAfterFirst = Number(potAfterFirst.rows[0].amount);

    // Explicitly reset only the 5-minute sliding-window cache
    clearCache();

    // Re-submit identical transaction
    const res2 = await request(app).post('/api/transactions').send(tx);
    expect(res2.status).toBe(409);
    expect(res2.body.status).toBe('duplicate');

    // Verify DB: exactly 1 transaction row survives
    const txRows = await query('SELECT * FROM transactions WHERE transaction_hash = $1', [txHash]);
    expect(txRows.rows.length).toBe(1);

    // Verify Pot: not double counted
    const potAfterSecond = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    expect(Number(potAfterSecond.rows[0].amount)).toBe(balanceAfterFirst);
  });
});
