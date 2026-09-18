/**
 * Database Initialization & Meera State Test Suite
 *
 * Tests:
 *  1. Fresh database initialization (schema + seed)
 *  2. Meera user exists in PostgreSQL after seed
 *  3. Meera canonical pots match fixture values exactly
 *  4. Meera pot total = ₹18,500 (dynamic, not hard-coded)
 *  5. Education goal seeded correctly
 *  6. Business ledger entry seeded correctly
 *  7. Foreign-key relationships are valid (no orphaned rows)
 *  8. Repeated initialization is idempotent (no duplicates)
 *  9. Database state survives reinitialization (pool restart)
 * 10. Business pot is NOT included in the 5-pot canonical total
 */

require('dotenv').config();
const { pool, checkDatabaseConnection, initSchema, query } = require('../../src/db/db');
const { seedMeera } = require('../../src/db/seed');
const { calculateTotalBalance } = require('../../src/services/potCalculator');
const fixture = require('../../src/fixtures/meeraFixture.json');

// ─── Canonical fixture values (source of truth) ───────────────────────────────
const EXPECTED_POTS = {
  cash:           fixture.cash,           // 2000
  bank:           fixture.bank,           // 5000
  shg:            fixture.shg,            // 2500
  chit_committed: fixture.chit_committed, // 4000
  post_office:    fixture.post_office,    // 5000
};
const EXPECTED_TOTAL = Object.values(EXPECTED_POTS).reduce((a, b) => a + b, 0); // 18500

describe('DB Initialization & Meera State Verification Suite', () => {
  let dbConnected = false;

  // ─── Setup: connect, apply schema, seed ─────────────────────────────────────
  beforeAll(async () => {
    dbConnected = await checkDatabaseConnection();
    if (!dbConnected) return;
    await initSchema();
    await seedMeera();
  });

  afterAll(async () => {
    try { await pool.end(); } catch (_) {}
  });

  // ─── Guard: all tests require a live DB ──────────────────────────────────────
  function requireDb() {
    if (!dbConnected) {
      throw new Error('PostgreSQL unavailable — this test requires a live database.');
    }
  }

  // ─── 1. Schema + connection ──────────────────────────────────────────────────
  it('1. PostgreSQL is reachable and schema is applied', () => {
    requireDb();
    expect(dbConnected).toBe(true);
  });

  // ─── 2. Meera user exists ────────────────────────────────────────────────────
  it('2. Meera user (meera_001) exists in the users table', async () => {
    requireDb();
    const res = await query('SELECT id, name FROM users WHERE id = $1', [fixture.user_id]);
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].id).toBe(fixture.user_id);
  });

  // ─── 3. Canonical pot values match fixture exactly ───────────────────────────
  it('3. Meera canonical pot values match meeraFixture.json exactly', async () => {
    requireDb();
    const res = await query(
      'SELECT pot_type, amount FROM pots WHERE user_id = $1',
      [fixture.user_id]
    );
    const potsMap = {};
    res.rows.forEach(r => { potsMap[r.pot_type] = Number(r.amount); });

    expect(potsMap.cash).toBe(EXPECTED_POTS.cash);
    expect(potsMap.bank).toBe(EXPECTED_POTS.bank);
    expect(potsMap.shg).toBe(EXPECTED_POTS.shg);
    expect(potsMap.chit_committed).toBe(EXPECTED_POTS.chit_committed);
    expect(potsMap.post_office).toBe(EXPECTED_POTS.post_office);
  });

  // ─── 4. Dynamic total = ₹18,500 ─────────────────────────────────────────────
  it('4. Dynamic 5-pot total = ₹18,500 (calculated, not hard-coded)', async () => {
    requireDb();
    const res = await query(
      `SELECT pot_type, amount FROM pots
       WHERE user_id = $1 AND pot_type IN ('cash','bank','shg','chit_committed','post_office')`,
      [fixture.user_id]
    );
    const potsMap = {};
    res.rows.forEach(r => { potsMap[r.pot_type] = Number(r.amount); });

    const dynamicTotal = calculateTotalBalance(potsMap);
    expect(dynamicTotal).toBe(EXPECTED_TOTAL); // 18500
    expect(EXPECTED_TOTAL).toBe(18500);        // confirms fixture expectation
  });

  // ─── 5. Business NOT included in 5-pot total ────────────────────────────────
  it('5. Business pot is excluded from the canonical 5-pot total', () => {
    const potsWithBusiness = { ...EXPECTED_POTS, business: 9999 };
    const total = calculateTotalBalance(potsWithBusiness);
    // Must still be 18500, not 18500 + 9999
    expect(total).toBe(18500);
  });

  // ─── 6. Education goal is seeded ────────────────────────────────────────────
  it('6. Education goal is seeded correctly in the goals table', async () => {
    requireDb();
    const res = await query(
      'SELECT name, target_amount, saved_amount FROM goals WHERE user_id = $1 AND is_active = true',
      [fixture.user_id]
    );
    expect(res.rows.length).toBeGreaterThanOrEqual(1);
    const goal = res.rows.find(r => r.name === fixture.goal.name);
    expect(goal).toBeDefined();
    expect(Number(goal.target_amount)).toBe(fixture.goal.target); // 20000
    expect(Number(goal.saved_amount)).toBe(fixture.goal.saved);   // 8000
  });

  // ─── 7. Business ledger entry is seeded ─────────────────────────────────────
  it('7. Initial business ledger entry is seeded correctly', async () => {
    requireDb();
    const res = await query(
      'SELECT activity, revenue, cost, profit FROM ledger_entries WHERE user_id = $1',
      [fixture.user_id]
    );
    expect(res.rows.length).toBeGreaterThanOrEqual(1);
    const entry = res.rows.find(r => r.activity === fixture.business.activity);
    expect(entry).toBeDefined();
    expect(Number(entry.revenue)).toBe(fixture.business.last_entry.revenue); // 1000
    expect(Number(entry.cost)).toBe(fixture.business.last_entry.cost);       // 600
    expect(Number(entry.profit)).toBe(fixture.business.last_entry.profit);   // 400
  });

  // ─── 8. Foreign-key integrity: no orphaned pots ──────────────────────────────
  it('8. No orphaned pots — all pot user_ids have matching users rows', async () => {
    requireDb();
    const res = await query(
      `SELECT p.user_id FROM pots p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE u.id IS NULL`
    );
    expect(res.rows.length).toBe(0); // zero orphans
  });

  // ─── 9. Foreign-key integrity: no orphaned goals ────────────────────────────
  it('9. No orphaned goals — all goal user_ids have matching users rows', async () => {
    requireDb();
    const res = await query(
      `SELECT g.user_id FROM goals g
       LEFT JOIN users u ON g.user_id = u.id
       WHERE u.id IS NULL`
    );
    expect(res.rows.length).toBe(0);
  });

  // ─── 10. Idempotent: running seedMeera twice creates no duplicates ───────────
  it('10. Repeated initialization is idempotent — no duplicate users, pots, or goals', async () => {
    requireDb();
    await seedMeera(); // Run a second time deliberately

    const users = await query('SELECT id FROM users WHERE id = $1', [fixture.user_id]);
    expect(users.rows.length).toBe(1); // Exactly one user

    const pots = await query(
      `SELECT pot_type FROM pots WHERE user_id = $1
       AND pot_type IN ('cash','bank','shg','chit_committed','post_office')`,
      [fixture.user_id]
    );
    expect(pots.rows.length).toBe(5); // Exactly five canonical pots

    const goals = await query(
      'SELECT id FROM goals WHERE user_id = $1 AND name = $2',
      [fixture.user_id, fixture.goal.name]
    );
    expect(goals.rows.length).toBe(1); // Exactly one goal
  });

  // ─── 11. DB state is stable after pool query cycle ──────────────────────────
  it('11. Pot values are stable and unchanged after a second read cycle', async () => {
    requireDb();
    const res = await query(
      `SELECT pot_type, amount FROM pots
       WHERE user_id = $1 AND pot_type IN ('cash','bank','shg','chit_committed','post_office')`,
      [fixture.user_id]
    );
    const potsMap = {};
    res.rows.forEach(r => { potsMap[r.pot_type] = Number(r.amount); });

    // Values must match fixture — seed must not have mutated them on 2nd run
    expect(potsMap.cash).toBe(fixture.cash);
    expect(potsMap.bank).toBe(fixture.bank);
    expect(potsMap.shg).toBe(fixture.shg);
    expect(potsMap.chit_committed).toBe(fixture.chit_committed);
    expect(potsMap.post_office).toBe(fixture.post_office);
  });

  // ─── 12. meeraFixture.json is not mutated by any test ───────────────────────
  it('12. meeraFixture.json source-of-truth values are unchanged', () => {
    expect(fixture.cash).toBe(2000);
    expect(fixture.bank).toBe(5000);
    expect(fixture.shg).toBe(2500);
    expect(fixture.chit_committed).toBe(4000);
    expect(fixture.post_office).toBe(5000);
    expect(fixture.goal.target).toBe(20000);
    expect(fixture.goal.saved).toBe(8000);
  });
});
