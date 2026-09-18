const request = require('supertest');
const app = require('../../src/server');
const { resetState } = require('../../src/services/financialStateStore');
const { clearCache } = require('../../src/services/deduplicationService');
const { clearAuditLogs } = require('../../src/services/auditLogger');
const { pool, checkDatabaseConnection, initSchema, query } = require('../../src/db/db');

// Unique per run
const TEST_USER = `overdraw_test_${Date.now()}`;
const INITIAL_CASH = 500;

let dbConnected = false;

beforeAll(async () => {
  dbConnected = await checkDatabaseConnection();
  if (dbConnected) {
    await initSchema();
    await query('INSERT INTO users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [TEST_USER, 'Overdraw Test User']);
    await query('INSERT INTO pots (user_id, pot_type, amount) VALUES ($1, $2, $3) ON CONFLICT (user_id, pot_type) DO UPDATE SET amount = $3', [TEST_USER, 'cash', INITIAL_CASH]);
  }
});

afterAll(async () => {
  if (dbConnected) {
    try {
      await query('DELETE FROM users WHERE id = $1', [TEST_USER]);
    } catch (_) {}
  }
});

beforeEach(() => {
  resetState();
  clearCache();
  clearAuditLogs();
});

function makePayload(ptOverrides = {}, baseOverrides = {}) {
  return {
    user_id: TEST_USER,
    channel: 'whatsapp_voice',
    input_type: 'voice',
    raw_text: `test ${Date.now()} ${Math.random()}`,
    normalized_text: `test-${Date.now()}-${Math.random()}`,
    parsed_transaction: {
      type: 'expense',
      amount: 600, // overdraws INITIAL_CASH (500)
      category: 'cash',
      ...ptOverrides
    },
    confidence: 1.0,
    ...baseOverrides
  };
}

describe('Insufficient Funds Validation', () => {
  it('rejects transaction with HTTP 400 when overdrawing and causes zero DB mutation', async () => {
    if (!dbConnected) {
      console.warn('Skipping overdraw test without DB connection');
      return;
    }

    const before = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'cash']);
    const cashBefore = Number(before.rows[0]?.amount ?? INITIAL_CASH);

    const res = await request(app).post('/api/transactions').send(
      makePayload()
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Insufficient funds');

    const after = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'cash']);
    expect(Number(after.rows[0].amount)).toBe(cashBefore);
  });
});
