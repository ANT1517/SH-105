/**
 * Phone-number resolution on GET /api/audit-log, POST /api/goals and POST /api/ledger (plus the sibling
 * goals/ledger routes that share the same auto-create pattern). Memory-only: never touches the shared Supabase DB.
 * (The "nothing created in the DB" guarantee is asserted in phoneResolutionNoCreate.test.js.)
 */
const request = require('supertest');
const app = require('../../src/server');
const { isConnected } = require('../../src/db/db');
const { resetState } = require('../../src/services/financialStateStore');
const { clearAuditLogs } = require('../../src/services/auditLogger');

const MAPPED = 'whatsapp:+919876543210';
const UNMAPPED = 'whatsapp:+910000000002';

beforeAll(() => {
  expect(isConnected()).toBe(false); // guard: in-memory store only
  process.env.PHONE_USER_MAP = JSON.stringify({ '+91 98765 43210': 'meera_001' });
});
afterAll(() => { delete process.env.PHONE_USER_MAP; });
beforeEach(() => { resetState(); clearAuditLogs(); });

const state = async () => (await request(app).get('/api/financial-state')).body;
const expectUnknownUser = (res) => {
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('unknown_user');
};

describe('GET /api/audit-log', () => {
  it('a mapped phone number returns the same rows as querying meera_001 directly', async () => {
    for (const q of ['q1', 'q2']) {
      await request(app).post('/api/audit-log').send({ user_id: 'meera_001', action: 'GUIDANCE_GIVEN', entity_type: 'guidance', entity_id: q, metadata: { question: q } });
    }
    const direct = await request(app).get('/api/audit-log').query({ user_id: 'meera_001' });
    const viaPhone = await request(app).get('/api/audit-log').query({ user_id: MAPPED });
    expect(direct.body.logs.length).toBe(2);
    expect(viaPhone.status).toBe(200);
    expect(viaPhone.body.user_id).toBe('meera_001');
    expect(viaPhone.body.logs).toEqual(direct.body.logs);
  });

  it('an unmapped phone number is 404 unknown_user (not an empty 200)', async () => {
    expectUnknownUser(await request(app).get('/api/audit-log').query({ user_id: UNMAPPED }));
  });

  it('non-phone ids and the default user behave as before', async () => {
    expect((await request(app).get('/api/audit-log')).body.user_id).toBe('meera_001');
    expect((await request(app).get('/api/audit-log').query({ user_id: 'someone_else' })).status).toBe(200);
  });
});

describe('POST /api/goals', () => {
  const goal = (user_id) => ({ user_id, name: 'Wedding', target_amount: 50000, saved_amount: 1000 });

  it('a mapped phone number updates meera_001\'s goal', async () => {
    const res = await request(app).post('/api/goals').send(goal(MAPPED));
    expect(res.status).toBe(201);
    expect(res.body.goal.user_id ?? 'meera_001').toBe('meera_001');
    expect((await state()).goal).toEqual({ name: 'Wedding', target: 50000, saved: 1000 });
  });

  it('an unmapped phone number is rejected with 404 unknown_user and nothing changes', async () => {
    expectUnknownUser(await request(app).post('/api/goals').send(goal(UNMAPPED)));
    expect((await state()).goal).toEqual({ name: 'Education', target: 20000, saved: 8000 });
    expect((await request(app).get('/api/financial-state').query({ user_id: UNMAPPED })).status).toBe(404);
  });

  it('sibling routes are covered too: GET / progress / PATCH', async () => {
    expect((await request(app).get('/api/goals').query({ user_id: MAPPED })).status).toBe(200);
    expectUnknownUser(await request(app).get('/api/goals').query({ user_id: UNMAPPED }));
    expect((await request(app).post('/api/goals/progress').send({ user_id: MAPPED, saved_delta: 100 })).status).toBe(200);
    expectUnknownUser(await request(app).post('/api/goals/progress').send({ user_id: UNMAPPED, saved_delta: 100 }));
    expect((await request(app).patch('/api/goals').send({ user_id: MAPPED, name: 'Renamed' })).status).toBe(200);
    expectUnknownUser(await request(app).patch('/api/goals').send({ user_id: UNMAPPED, name: 'Nope' }));
    const g = (await state()).goal;
    expect(g.name).toBe('Renamed');
    expect(g.saved).toBe(8100); // only the mapped progress call applied
  });
});

describe('POST /api/ledger', () => {
  const entry = (user_id) => ({ user_id, activity: 'pickle sales', revenue: 1000, cost: 600 });

  it('a mapped phone number records the entry against meera_001', async () => {
    const res = await request(app).post('/api/ledger').send(entry(MAPPED));
    expect(res.status).toBe(201);
    expect(res.body.ledger_entry.user_id).toBe('meera_001');
    expect(res.body.updated_financial_state.pots.business).toBe(400);
    expect((await request(app).get('/api/ledger').query({ user_id: 'meera_001' })).body.count).toBe(2);
  });

  it('an unmapped phone number is rejected with 404 unknown_user and nothing is recorded', async () => {
    const before = (await request(app).get('/api/ledger').query({ user_id: 'meera_001' })).body.count;
    expectUnknownUser(await request(app).post('/api/ledger').send(entry(UNMAPPED)));
    expect((await request(app).get('/api/ledger').query({ user_id: 'meera_001' })).body.count).toBe(before);
    expect((await state()).pots.business).toBe(0);
  });

  it('GET /api/ledger resolves mapped phones and rejects unmapped ones', async () => {
    expect((await request(app).get('/api/ledger').query({ user_id: MAPPED })).body.user_id).toBe('meera_001');
    expectUnknownUser(await request(app).get('/api/ledger').query({ user_id: UNMAPPED }));
  });

  it('validation errors still come first', async () => {
    expect((await request(app).post('/api/ledger').send({ user_id: UNMAPPED, revenue: 'abc' })).status).toBe(400);
  });
});
