require('dotenv').config();
const { pool, checkDatabaseConnection, initSchema, executeTransaction, isConnected, query } = require('../../src/db/db');
const { getFinancialState } = require('../../src/services/financialStateStore');

describe('Strict PostgreSQL Live Database Verification Suite', () => {
  let dbConnected = false;
  // Users created by tests; deleted in afterEach so cleanup runs whether the test passes or fails.
  const createdUsers = [];
  const newTestUser = (prefix) => {
    const id = `${prefix}_${Date.now()}`;
    createdUsers.push(id); // registered before any insert
    return id;
  };

  afterEach(async () => {
    if (!dbConnected) return;
    while (createdUsers.length) {
      await query('DELETE FROM users WHERE id = $1', [createdUsers.pop()]);
    }
  });

  beforeAll(async () => {
    dbConnected = await checkDatabaseConnection();
    if (dbConnected) {
      await initSchema();
    }
  });

  afterAll(async () => {
    try {
      await pool.end();
    } catch (e) {
      // ignore
    }
  });

  it('1. PostgreSQL Connection & Schema Verification (MUST FAIL IF UNREACHABLE)', () => {
    expect(dbConnected).toBe(true);
  });

  it('2. PostgreSQL Persistence Across Store Reinitialization', async () => {
    if (!dbConnected) {
      throw new Error('PostgreSQL connection failed. Persistence test cannot execute without live PostgreSQL.');
    }

    const testUserId = newTestUser('pg_user');
    await query('INSERT INTO users (id, name) VALUES ($1, $2)', [testUserId, 'Persistence Test User']);
    await query('INSERT INTO pots (user_id, pot_type, amount) VALUES ($1, $2, $3)', [testUserId, 'bank', 5000]);

    // Insert transaction
    const txHash = `hash_${Date.now()}`;
    await query(
      `INSERT INTO transactions (transaction_hash, user_id, channel, input_type, raw_text, normalized_text, tx_type, amount, category, target_pot, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [txHash, testUserId, 'whatsapp', 'text', 'deposit 1000', 'deposit 1000', 'income', 1000, 'bank deposit', 'bank', 1.0]
    );
    await query('UPDATE pots SET amount = amount + 1000 WHERE user_id = $1 AND pot_type = $2', [testUserId, 'bank']);

    // Read directly from PostgreSQL to verify persistence
    const state = await getFinancialState(testUserId);
    expect(state.pots.bank).toBe(6000);

  });

  it('3. PostgreSQL Atomic Rollback on Failure', async () => {
    if (!dbConnected) {
      throw new Error('PostgreSQL connection failed. Rollback test cannot execute without live PostgreSQL.');
    }

    const testUserId = newTestUser('rollback_user');
    await query('INSERT INTO users (id, name) VALUES ($1, $2)', [testUserId, 'Rollback User']);
    await query('INSERT INTO pots (user_id, pot_type, amount) VALUES ($1, $2, $3)', [testUserId, 'cash', 2000]);

    let errorOccurred = false;
    try {
      await executeTransaction(async (client) => {
        await client.query('UPDATE pots SET amount = amount + 1000 WHERE user_id = $1 AND pot_type = $2', [testUserId, 'cash']);
        throw new Error('Intentional controlled failure to test atomic rollback');
      });
    } catch (err) {
      errorOccurred = true;
    }

    expect(errorOccurred).toBe(true);

    const res = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [testUserId, 'cash']);
    expect(Number(res.rows[0].amount)).toBe(2000); // Rolled back!

  });

  it('4. Real PostgreSQL Concurrency & Thread-Safety', async () => {
    if (!dbConnected) {
      throw new Error('PostgreSQL connection failed. Concurrency test cannot execute without live PostgreSQL.');
    }

    const testUserId = newTestUser('concurrent_user');
    await query('INSERT INTO users (id, name) VALUES ($1, $2)', [testUserId, 'Concurrent User']);
    await query('INSERT INTO pots (user_id, pot_type, amount) VALUES ($1, $2, $3)', [testUserId, 'bank', 5000]);

    // Run 10 concurrent updates in PostgreSQL
    const concurrentUpdates = [];
    for (let i = 1; i <= 10; i++) {
      concurrentUpdates.push(
        query(
          `INSERT INTO transactions (transaction_hash, user_id, channel, input_type, raw_text, normalized_text, tx_type, amount, category, target_pot, confidence)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [`hash_${i}_${Date.now()}`, testUserId, 'whatsapp', 'text', `dep ${i}`, `dep ${i}`, 'income', 100, 'bank deposit', 'bank', 1.0]
        ).then(() => {
          return query('UPDATE pots SET amount = amount + 100 WHERE user_id = $1 AND pot_type = $2', [testUserId, 'bank']);
        })
      );
    }

    await Promise.all(concurrentUpdates);

    const res = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [testUserId, 'bank']);
    expect(Number(res.rows[0].amount)).toBe(6000); // 5000 + 10 * 100 = 6000

  });

  it('5. Real PostgreSQL SQL Injection Safety', async () => {
    if (!dbConnected) {
      throw new Error('PostgreSQL connection failed. SQL safety test cannot execute without live PostgreSQL.');
    }

    const maliciousInput = "test_user'; DROP TABLE pots; --";
    const res = await query('SELECT * FROM users WHERE id = $1', [maliciousInput]);
    expect(res.rows).toHaveLength(0);

    // Verify pots table still exists
    const checkTable = await query("SELECT to_regclass('pots')");
    expect(checkTable.rows[0].to_regclass).not.toBeNull();
  });
});
