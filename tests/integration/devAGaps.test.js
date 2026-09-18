/**
 * Gaps found during Dev-A integration. Memory-only (never touches the shared Supabase DB).
 */
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../src/server');
const { isConnected } = require('../../src/db/db');
const { resetState } = require('../../src/services/financialStateStore');
const { clearCache } = require('../../src/services/deduplicationService');
const { clearAuditLogs } = require('../../src/services/auditLogger');
const { CATEGORY_TO_POT_MAP } = require('../../src/services/potCalculator');

const DEMO_PHONE = 'whatsapp:+919876543210';

const tx = (user_id, type, amount, category, raw = `${type} ${amount} ${category}`) => ({
  user_id, channel: 'whatsapp', input_type: 'text', raw_text: raw, normalized_text: raw,
  parsed_transaction: { type, amount, category }, confidence: 0.95
});

const parserBody = () => {
  const src = fs.readFileSync(path.join(__dirname, '../../services/interaction/app/transaction_parser.py'), 'utf8');
  return src.slice(src.indexOf('def determine_type_and_category'), src.indexOf('def parse_transaction'));
};

beforeAll(() => {
  // Guard: these tests must run against the in-memory store only.
  expect(isConnected()).toBe(false);
  process.env.PHONE_USER_MAP = JSON.stringify({ '+91 98765 43210': 'meera_001' });
});
afterAll(() => { delete process.env.PHONE_USER_MAP; });
beforeEach(() => { resetState(); clearCache(); clearAuditLogs(); });

describe('Fix 1: "saving" and "business" types (normalized-input contract)', () => {
  it('saving with Dev-A category "saving" credits the bank pot by default', async () => {
    const res = await request(app).post('/api/transactions').send(tx('meera_001', 'saving', 500, 'saving'));
    expect(res.status).toBe(201);
    expect(res.body.pot_affected).toBe('bank');
    expect(res.body.updated_financial_state.pots.bank).toBe(5500);
  });

  it('saving with an explicit savings-pot category credits that pot (shg, post_office)', async () => {
    const shg = await request(app).post('/api/transactions').send(tx('meera_001', 'saving', 300, 'shg contribution'));
    expect(shg.body.pot_affected).toBe('shg');
    expect(shg.body.updated_financial_state.pots.shg).toBe(2800);
    const po = await request(app).post('/api/transactions').send(tx('meera_001', 'saving', 200, 'post office'));
    expect(po.body.pot_affected).toBe('post_office');
    expect(po.body.updated_financial_state.pots.post_office).toBe(5200);
  });

  it('saving with a non-savings category (e.g. cash) still lands in a savings pot, not cash', async () => {
    const res = await request(app).post('/api/transactions').send(tx('meera_001', 'saving', 100, 'cash'));
    expect(res.body.pot_affected).toBe('bank');
    expect(res.body.updated_financial_state.pots.cash).toBe(2000);
  });

  it('business credits the business pot (sale of pickles) and leaves the five canonical pots alone', async () => {
    const res = await request(app).post('/api/transactions').send(tx('meera_001', 'business', 1000, 'pickles'));
    expect(res.status).toBe(201);
    expect(res.body.pot_affected).toBe('business');
    expect(res.body.updated_financial_state.pots.business).toBe(1000);
    expect(res.body.updated_financial_state.total_balance).toBe(18500);
  });

  it("every type Dev-A's parser can emit is accepted by Person B (drift check)", async () => {
    const types = [...new Set([...parserBody().matchAll(/return "(\w+)", /g)].map(m => m[1]))];
    expect(types).toEqual(expect.arrayContaining(['business', 'commitment', 'saving', 'income', 'expense']));
    let n = 0;
    for (const type of types) {
      const res = await request(app).post('/api/transactions').send(tx('meera_001', type, 10 + n++, 'cash'));
      expect(res.body.error || '').not.toMatch(/must be one of/);
    }
  });
});

describe('Fix 2: phone number -> user_id mapping', () => {
  it('a mapped Twilio "whatsapp:+91..." sender resolves to meera_001 (no new user)', async () => {
    const res = await request(app).post('/api/transactions').send(tx(DEMO_PHONE, 'income', 500, 'bank'));
    expect(res.status).toBe(201);
    expect(res.body.transaction.user_id).toBe('meera_001');
    expect(res.body.updated_financial_state.user_id).toBe('meera_001');
    expect(res.body.updated_financial_state.pots.bank).toBe(5500);
  });

  it('formatting variants of the same number resolve identically', async () => {
    const res = await request(app).post('/api/transactions').send(tx('+91-98765-43210', 'income', 50, 'bank'));
    expect(res.body.transaction.user_id).toBe('meera_001');
  });

  it('an unmapped phone number is rejected with 422 and changes nothing (no ghost user)', async () => {
    const res = await request(app).post('/api/transactions').send(tx('whatsapp:+910000000001', 'income', 500, 'bank'));
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Unknown phone number/);
    const state = await request(app).get('/api/financial-state');
    expect(state.body.pots.bank).toBe(5000);
    const ghost = await request(app).get('/api/financial-state').query({ user_id: 'whatsapp:+910000000001' });
    expect(ghost.status).toBe(404);
  });

  it('non-phone user ids are untouched', async () => {
    const res = await request(app).post('/api/transactions').send(tx('meera_001', 'income', 5, 'bank'));
    expect(res.body.transaction.user_id).toBe('meera_001');
  });
});

describe('Fix 3: unknown user on GET /api/financial-state', () => {
  it("returns 404 unknown_user, not Meera's state", async () => {
    const res = await request(app).get('/api/financial-state').query({ user_id: 'new_user_999' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('unknown_user');
    expect(res.body.pots).toBeUndefined();
  });

  it('the default/known user still works', async () => {
    const res = await request(app).get('/api/financial-state');
    expect(res.status).toBe(200);
    expect(res.body.total_balance).toBe(18500);
  });
});

describe('Category fix: vegetables is household cash spending, not business', () => {
  it('"spent 200 on vegetables" debits cash, not the business pot', async () => {
    const res = await request(app).post('/api/transactions')
      .send(tx('meera_001', 'expense', 200, 'vegetables', 'spent 200 on vegetables'));
    expect(res.status).toBe(201);
    expect(res.body.pot_affected).toBe('cash');
    expect(res.body.updated_financial_state.pots.cash).toBe(1800);
    expect(res.body.updated_financial_state.pots.business).toBe(0);
  });
});

describe("Fix 4: every category Dev-A's parser emits is explicitly mapped", () => {
  const body = parserBody();
  const categories = [...new Set([
    ...[...body.matchAll(/cat = "(\w+)"/g)].map(m => m[1]),
    ...[...body.matchAll(/return "\w+", "(\w+)"/g)].map(m => m[1])
  ])];

  it("extracted the parser's categories", () => {
    expect(categories).toEqual(expect.arrayContaining(['tailoring', 'pickles', 'chit', 'stitching', 'electricity', 'saving']));
  });

  it.each(categories)('category "%s" is in CATEGORY_TO_POT_MAP (not a silent cash default)', (cat) => {
    expect(Object.keys(CATEGORY_TO_POT_MAP)).toContain(cat);
  });

  it.each([['stitching', 'business'], ['pickles', 'business'], ['tailoring', 'business'], ['chit', 'chit_committed']])(
    '"%s" lands in the %s pot', async (cat, pot) => {
      const type = cat === 'chit' ? 'commitment' : 'income';
      const res = await request(app).post('/api/transactions').send(tx('meera_001', type, 100, cat));
      expect(res.status).toBe(201);
      expect(res.body.pot_affected).toBe(pot);
    });
});
