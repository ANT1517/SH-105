/**
 * DB-backed guarantee: an UNMAPPED phone number sent to the write routes creates nothing in Postgres
 * (no user, goal, ledger entry, pot, transaction or audit row) -- the ghost_user_* problem must not come back.
 *
 * Only unmapped-phone requests are sent, and they are rejected before any write, so this suite writes
 * nothing and needs no cleanup. (Mapped-phone success is covered by the in-memory suite: doing it here would
 * mutate the real meera_001 data.)
 */
const request = require('supertest');
const app = require('../../src/server');
const { checkDatabaseConnection, initSchema, query, pool } = require('../../src/db/db');

const UNMAPPED = 'whatsapp:+910000000003';
const LIKE = '%910000000003%';
let dbConnected = false;

const counts = async () => {
  const r = await query(`SELECT
    (SELECT count(*) FROM users) users, (SELECT count(*) FROM goals) goals,
    (SELECT count(*) FROM ledger_entries) ledger_entries, (SELECT count(*) FROM pots) pots,
    (SELECT count(*) FROM transactions) transactions, (SELECT count(*) FROM audit_logs) audit_logs`);
  return Object.fromEntries(Object.entries(r.rows[0]).map(([k, v]) => [k, Number(v)]));
};

beforeAll(async () => {
  dbConnected = await checkDatabaseConnection();
  if (dbConnected) await initSchema();
  process.env.PHONE_USER_MAP = JSON.stringify({ '+919876543210': 'meera_001' }); // maps a DIFFERENT number
});
afterAll(async () => {
  delete process.env.PHONE_USER_MAP;
  try { await pool.end(); } catch (_) {}
});

it('unmapped phone writes are rejected and create zero rows anywhere', async () => {
  if (!dbConnected) throw new Error('PostgreSQL unavailable — this test requires a live database.');
  const before = await counts();

  const calls = [
    request(app).post('/api/goals').send({ user_id: UNMAPPED, name: 'Ghost goal', target_amount: 1000, saved_amount: 0 }),
    request(app).post('/api/goals/progress').send({ user_id: UNMAPPED, saved_delta: 100 }),
    request(app).patch('/api/goals').send({ user_id: UNMAPPED, name: 'Ghost rename' }),
    request(app).post('/api/ledger').send({ user_id: UNMAPPED, activity: 'ghost sales', revenue: 500, cost: 100 }),
    request(app).post('/api/audit-log').send({ user_id: UNMAPPED, action: 'GUIDANCE_GIVEN', entity_type: 'guidance' }),
    request(app).post('/api/transactions').send({
      user_id: UNMAPPED, channel: 'whatsapp', input_type: 'text', raw_text: 'earned 100 tailoring', normalized_text: 'earned 100 tailoring',
      parsed_transaction: { type: 'income', amount: 100, category: 'tailoring' }, confidence: 0.95
    }),
  ];
  const results = await Promise.all(calls);
  const statuses = results.map(r => r.status);
  expect(statuses).toEqual([404, 404, 404, 404, 404, 422]); // transactions keeps its existing 422

  const after = await counts();
  expect(after).toEqual(before); // nothing created in ANY table

  for (const [table, col] of [['users', 'id'], ['goals', 'user_id'], ['ledger_entries', 'user_id'], ['pots', 'user_id'],
                              ['transactions', 'user_id'], ['audit_logs', 'user_id']]) {
    const r = await query(`SELECT count(*) FROM ${table} WHERE ${col} LIKE $1`, [LIKE]);
    expect(Number(r.rows[0].count)).toBe(0);
  }
});

it('unmapped phone reads are 404 and create nothing', async () => {
  if (!dbConnected) throw new Error('PostgreSQL unavailable — this test requires a live database.');
  const before = await counts();
  for (const path of ['/api/goals', '/api/ledger', '/api/audit-log', '/api/financial-state']) {
    expectUnknown(await request(app).get(path).query({ user_id: UNMAPPED }));
  }
  expect(await counts()).toEqual(before);
});

function expectUnknown(res) {
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('unknown_user');
}
