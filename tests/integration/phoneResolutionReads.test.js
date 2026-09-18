/**
 * Phone-number resolution on GET /api/financial-state and POST /api/audit-log
 * (the same PHONE_USER_MAP resolver POST /api/transactions uses). Memory-only: never touches the shared Supabase DB.
 */
const request = require('supertest');
const app = require('../../src/server');
const { isConnected } = require('../../src/db/db');
const { resetState } = require('../../src/services/financialStateStore');
const { clearAuditLogs } = require('../../src/services/auditLogger');

const MAPPED = 'whatsapp:+919876543210';
const UNMAPPED = 'whatsapp:+910000000001';

beforeAll(() => {
  expect(isConnected()).toBe(false); // guard: in-memory store only
  process.env.PHONE_USER_MAP = JSON.stringify({ '+91 98765 43210': 'meera_001' });
});
afterAll(() => { delete process.env.PHONE_USER_MAP; });
beforeEach(() => { resetState(); clearAuditLogs(); });

const audit = (over = {}) => ({
  user_id: MAPPED, action: 'GUIDANCE_GIVEN', entity_type: 'guidance', entity_id: 'g-1',
  metadata: { question: 'How much can I save?' }, ...over
});

describe('GET /api/financial-state with a phone-number user_id', () => {
  it('a mapped phone number returns meera_001\'s real data (was 404)', async () => {
    const res = await request(app).get('/api/financial-state').query({ user_id: MAPPED });
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe('meera_001');
    expect(res.body.pots).toEqual({ cash: 2000, bank: 5000, shg: 2500, chit_committed: 4000, post_office: 5000, business: 0 });
    expect(res.body.total_balance).toBe(18500);
    expect(res.body.goal).toEqual({ name: 'Education', target: 20000, saved: 8000 });
  });

  it.each(['+919876543210', '+91-98765-43210', 'whatsapp:+91 98765 43210'])('formatting variant %s resolves too', async (id) => {
    const res = await request(app).get('/api/financial-state').query({ user_id: id });
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe('meera_001');
  });

  it('an unmapped phone number is still 404 unknown_user (no silent user creation)', async () => {
    const res = await request(app).get('/api/financial-state').query({ user_id: UNMAPPED });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('unknown_user');
    expect(res.body.pots).toBeUndefined();
  });

  it('non-phone ids behave as before (meera_001 ok, unknown id 404, default is meera)', async () => {
    expect((await request(app).get('/api/financial-state').query({ user_id: 'meera_001' })).status).toBe(200);
    expect((await request(app).get('/api/financial-state').query({ user_id: 'nobody_123' })).status).toBe(404);
    expect((await request(app).get('/api/financial-state')).body.user_id).toBe('meera_001');
  });

  it('a repeated user_id parameter does not crash the resolver', async () => {
    const res = await request(app).get('/api/financial-state?user_id=a&user_id=b');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/audit-log with a phone-number user_id', () => {
  it('a mapped phone number is recorded against meera_001 and is retrievable via GET', async () => {
    const post = await request(app).post('/api/audit-log').send(audit());
    expect(post.status).toBe(201);
    expect(post.body.entry.user_id).toBe('meera_001');

    const get = await request(app).get('/api/audit-log').query({ user_id: 'meera_001' });
    const row = get.body.logs.find(l => l.action === 'GUIDANCE_GIVEN');
    expect(row).toBeDefined();
    expect(row.metadata).toEqual({ question: 'How much can I save?' });
  });

  it('an unmapped phone number is 404 unknown_user and nothing is recorded for anyone', async () => {
    const res = await request(app).post('/api/audit-log').send(audit({ user_id: UNMAPPED }));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('unknown_user');
    const meera = await request(app).get('/api/audit-log').query({ user_id: 'meera_001' });
    expect(meera.body.logs.length).toBe(0);
    // GET /api/audit-log now also resolves phones: an unmapped one is 404, not an empty 200.
    const ghost = await request(app).get('/api/audit-log').query({ user_id: UNMAPPED });
    expect(ghost.status).toBe(404);
    expect(ghost.body.error).toBe('unknown_user');
  });

  it('validation still comes first (bad action with a mapped phone is 400)', async () => {
    const res = await request(app).post('/api/audit-log').send(audit({ action: 'TRANSACTION_INGESTED' }));
    expect(res.status).toBe(400);
  });
});
