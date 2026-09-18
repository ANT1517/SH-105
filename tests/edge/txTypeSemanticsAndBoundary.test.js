/**
 * Transaction-Type Semantics & Amount Boundary Tests
 *
 * Verifies:
 * 1. Each documented type (income, expense, transfer, commitment) has the
 *    correct pot operation (add / subtract).
 * 2. Unknown / undocumented types are rejected with HTTP 400.
 * 3. Amount boundary cases: NaN, Infinity, -Infinity, 0, negative are rejected.
 * 4. Mixed-case / padded type strings are normalised before lookup.
 *
 * Source of documented types: schema.sql, tx_type column comment.
 *
 * Isolation strategy:
 *   - Tests that MUTATE state use an isolated TEST_USER seeded in beforeAll
 *     and torn down in afterAll, so they never pollute shared meera_001 state.
 *   - Rejection tests (B, C) never reach a DB write and are safe to send
 *     against meera_001 (or any user).
 */

require('dotenv').config();
const request = require('supertest');
const app = require('../../src/server');
const { resetState } = require('../../src/services/financialStateStore');
const { clearCache } = require('../../src/services/deduplicationService');
const { clearAuditLogs } = require('../../src/services/auditLogger');
const { pool, checkDatabaseConnection, initSchema, query } = require('../../src/db/db');

// Unique per run so parallel/repeated runs don't collide
const TEST_USER = `txtype_test_${Date.now()}`;
const INITIAL_BANK  = 10000;
const INITIAL_CASH  = 8000;
const INITIAL_CHIT  = 6000;
const INITIAL_SHG   = 4000;

let dbConnected = false;

// ─── helpers ──────────────────────────────────────────────────────────────────

function makePayload(ptOverrides = {}, baseOverrides = {}) {
  return {
    user_id: TEST_USER,
    channel: 'whatsapp_voice',
    input_type: 'voice',
    raw_text: `test ${Date.now()} ${Math.random()}`,
    normalized_text: `test-${Date.now()}-${Math.random()}`,
    parsed_transaction: {
      type: 'income',
      amount: 500,
      category: 'bank',
      ...ptOverrides
    },
    confidence: 1.0,
    ...baseOverrides
  };
}

// For rejection-only tests that must not change state (using meera_001 is fine
// because these payloads are rejected before any DB write)
function makeRejectionPayload(ptOverrides = {}) {
  return {
    user_id: 'meera_001',
    channel: 'whatsapp_voice',
    input_type: 'voice',
    raw_text: `test ${Date.now()} ${Math.random()}`,
    normalized_text: `test-${Date.now()}-${Math.random()}`,
    parsed_transaction: {
      type: 'income',
      amount: 500,
      category: 'bank',
      ...ptOverrides
    },
    confidence: 1.0
  };
}

// ─── setup / teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  dbConnected = await checkDatabaseConnection();
  if (dbConnected) {
    await initSchema();
    // Seed the isolated test user with known pot values
    await query('INSERT INTO users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [TEST_USER, 'TxType Test User']);
    await query('INSERT INTO pots (user_id, pot_type, amount) VALUES ($1, $2, $3) ON CONFLICT (user_id, pot_type) DO UPDATE SET amount = $3', [TEST_USER, 'bank', INITIAL_BANK]);
    await query('INSERT INTO pots (user_id, pot_type, amount) VALUES ($1, $2, $3) ON CONFLICT (user_id, pot_type) DO UPDATE SET amount = $3', [TEST_USER, 'cash', INITIAL_CASH]);
    await query('INSERT INTO pots (user_id, pot_type, amount) VALUES ($1, $2, $3) ON CONFLICT (user_id, pot_type) DO UPDATE SET amount = $3', [TEST_USER, 'chit_committed', INITIAL_CHIT]);
    await query('INSERT INTO pots (user_id, pot_type, amount) VALUES ($1, $2, $3) ON CONFLICT (user_id, pot_type) DO UPDATE SET amount = $3', [TEST_USER, 'shg', INITIAL_SHG]);
    await query('INSERT INTO pots (user_id, pot_type, amount) VALUES ($1, $2, $3) ON CONFLICT (user_id, pot_type) DO UPDATE SET amount = $3', [TEST_USER, 'post_office', 5000]);
  }
});

afterAll(async () => {
  // Clean up isolated test user — do NOT call pool.end() here.
  // The pool is shared across all test files in the same Jest process
  // (--runInBand). Closing it prematurely kills DB connections for every
  // subsequent test suite.
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

// =============================================================================
// Section A: Documented types are accepted (uses isolated TEST_USER)
// =============================================================================
describe('A. Documented types are accepted', () => {
  it('A1. income adds to the target pot', async () => {
    const before = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    const bankBefore = Number(before.rows[0]?.amount ?? INITIAL_BANK);

    const res = await request(app).post('/api/transactions').send(
      makePayload({ type: 'income', amount: 300, category: 'bank' })
    );
    expect(res.status).toBe(201);
    expect(res.body.pot_affected).toBe('bank');

    const after = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    expect(Number(after.rows[0].amount)).toBe(bankBefore + 300);
  });

  it('A2. expense subtracts from the target pot', async () => {
    const before = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'cash']);
    const cashBefore = Number(before.rows[0]?.amount ?? INITIAL_CASH);

    const res = await request(app).post('/api/transactions').send(
      makePayload({ type: 'expense', amount: 100, category: 'cash' })
    );
    expect(res.status).toBe(201);
    expect(res.body.pot_affected).toBe('cash');

    const after = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'cash']);
    expect(Number(after.rows[0].amount)).toBe(Math.max(0, cashBefore - 100));
  });

  it('A3. transfer adds to the target pot', async () => {
    const before = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    const bankBefore = Number(before.rows[0]?.amount ?? INITIAL_BANK);

    const res = await request(app).post('/api/transactions').send(
      makePayload({ type: 'transfer', amount: 200, category: 'bank deposit' })
    );
    expect(res.status).toBe(201);
    expect(res.body.pot_affected).toBe('bank');

    const after = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    expect(Number(after.rows[0].amount)).toBe(bankBefore + 200);
  });

  it('A4. commitment subtracts from the target pot', async () => {
    const before = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'chit_committed']);
    const chitBefore = Number(before.rows[0]?.amount ?? INITIAL_CHIT);

    const res = await request(app).post('/api/transactions').send(
      makePayload({ type: 'commitment', amount: 400, category: 'chit fund' })
    );
    expect(res.status).toBe(201);
    expect(res.body.pot_affected).toBe('chit_committed');

    const after = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'chit_committed']);
    expect(Number(after.rows[0].amount)).toBe(Math.max(0, chitBefore - 400));
  });
});

// =============================================================================
// Section B: Unknown types are rejected before any DB write
// =============================================================================
describe('B. Unknown types are rejected with 400', () => {
  const unknownTypes = [
    'withdrawal', 'deposit', 'refund', 'payment', 'credit',
    'debit', 'savings', 'unknown_type', '123', 'income_extra'
  ];

  unknownTypes.forEach((badType) => {
    it(`B. rejects unknown type "${badType}"`, async () => {
      const res = await request(app).post('/api/transactions').send(
        makeRejectionPayload({ type: badType, amount: 500, category: 'bank' })
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      // Error message must name the bad type
      expect(res.body.error).toContain(badType.trim());
    });
  });

  it('B. empty type string is rejected', async () => {
    const res = await request(app).post('/api/transactions').send(
      makeRejectionPayload({ type: '', amount: 500, category: 'bank' })
    );
    expect(res.status).toBe(400);
  });

  it('B. whitespace-only type is rejected', async () => {
    const res = await request(app).post('/api/transactions').send(
      makeRejectionPayload({ type: '   ', amount: 500, category: 'bank' })
    );
    expect(res.status).toBe(400);
  });

  it('B. type normalisation: "Income" (capitalised) is accepted', async () => {
    const res = await request(app).post('/api/transactions').send(
      makePayload({ type: 'Income', amount: 100, category: 'cash' })
    );
    expect(res.status).toBe(201);
  });

  it('B. type normalisation: "  EXPENSE  " (padded+uppercase) is accepted', async () => {
    const res = await request(app).post('/api/transactions').send(
      makePayload({ type: '  EXPENSE  ', amount: 50, category: 'cash' })
    );
    expect(res.status).toBe(201);
  });

  it('B. type normalisation: "Transfer" is accepted', async () => {
    const res = await request(app).post('/api/transactions').send(
      makePayload({ type: 'Transfer', amount: 75, category: 'bank deposit' })
    );
    expect(res.status).toBe(201);
  });

  it('B. type normalisation: "COMMITMENT" is accepted', async () => {
    const res = await request(app).post('/api/transactions').send(
      makePayload({ type: 'COMMITMENT', amount: 100, category: 'chit fund' })
    );
    expect(res.status).toBe(201);
  });
});

// =============================================================================
// Section C: Amount boundary cases — all rejected before DB write
// =============================================================================
describe('C. Invalid amounts rejected with 400', () => {
  async function assertAmountRejected(amount) {
    const res = await request(app).post('/api/transactions').send(
      makeRejectionPayload({ type: 'income', amount, category: 'bank' })
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  }

  it('C1. amount = 0 is rejected',          async () => await assertAmountRejected(0));
  it('C2. amount = -1 is rejected',         async () => await assertAmountRejected(-1));
  it('C3. amount = -0.01 is rejected',      async () => await assertAmountRejected(-0.01));
  it('C4. amount = "NaN" is rejected',      async () => await assertAmountRejected('NaN'));
  it('C5. amount = "Infinity" is rejected', async () => await assertAmountRejected('Infinity'));
  it('C6. amount = "-Infinity" is rejected',async () => await assertAmountRejected('-Infinity'));
  it('C7. amount = "not-a-number" rejected',async () => await assertAmountRejected('not-a-number'));
  it('C8. amount = null is rejected',       async () => await assertAmountRejected(null));

  it('C9. amount missing entirely is rejected', async () => {
    const res = await request(app).post('/api/transactions').send({
      user_id: 'meera_001',
      channel: 'whatsapp_voice',
      input_type: 'voice',
      raw_text: `test-no-amount-${Date.now()}`,
      normalized_text: `test-no-amount-${Date.now()}`,
      parsed_transaction: { type: 'income', category: 'bank' },
      confidence: 1.0
    });
    expect(res.status).toBe(400);
  });

  it('C10. amount = 0.01 (minimum positive decimal) is accepted', async () => {
    const res = await request(app).post('/api/transactions').send(
      makePayload({ type: 'income', amount: 0.01, category: 'bank' })
    );
    expect(res.status).toBe(201);
  });

  it('C11. amount = 9999999.99 (large finite value) is accepted', async () => {
    const res = await request(app).post('/api/transactions').send(
      makePayload({ type: 'income', amount: 9999999.99, category: 'bank' })
    );
    expect(res.status).toBe(201);
  });
});

// =============================================================================
// Section D: Semantic invariant — subtract-types never inflate pot
// =============================================================================
describe('D. Semantic invariant: subtract-types never inflate pot', () => {
  it('D1. expense does not increase any pot', async () => {
    const before = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'cash']);
    const cashBefore = Number(before.rows[0]?.amount ?? INITIAL_CASH);

    await request(app).post('/api/transactions').send(
      makePayload({ type: 'expense', amount: 50, category: 'cash' })
    );

    const after = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'cash']);
    expect(Number(after.rows[0].amount)).toBeLessThanOrEqual(cashBefore);
  });

  it('D2. commitment does not increase any pot', async () => {
    const before = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'chit_committed']);
    const chitBefore = Number(before.rows[0]?.amount ?? INITIAL_CHIT);

    await request(app).post('/api/transactions').send(
      makePayload({ type: 'commitment', amount: 100, category: 'chit fund' })
    );

    const after = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'chit_committed']);
    expect(Number(after.rows[0].amount)).toBeLessThanOrEqual(chitBefore);
  });

  it('D3. income strictly increases the target pot', async () => {
    const before = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    const bankBefore = Number(before.rows[0]?.amount ?? INITIAL_BANK);

    await request(app).post('/api/transactions').send(
      makePayload({ type: 'income', amount: 100, category: 'bank' })
    );

    const after = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    expect(Number(after.rows[0].amount)).toBeGreaterThan(bankBefore);
  });

  it('D4. transfer strictly increases the target pot', async () => {
    const before = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    const bankBefore = Number(before.rows[0]?.amount ?? INITIAL_BANK);

    await request(app).post('/api/transactions').send(
      makePayload({ type: 'transfer', amount: 50, category: 'bank deposit' })
    );

    const after = await query('SELECT amount FROM pots WHERE user_id = $1 AND pot_type = $2', [TEST_USER, 'bank']);
    expect(Number(after.rows[0].amount)).toBeGreaterThan(bankBefore);
  });
});
