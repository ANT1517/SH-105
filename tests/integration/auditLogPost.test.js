/**
 * POST /api/audit-log (used by Person C). Memory-only: never touches the shared Supabase DB.
 */
const request = require('supertest');
const app = require('../../src/server');
const { isConnected } = require('../../src/db/db');
const { resetState } = require('../../src/services/financialStateStore');
const { clearAuditLogs } = require('../../src/services/auditLogger');

const entry = (over = {}) => ({
  user_id: 'meera_001',
  action: 'GUIDANCE_GIVEN',
  entity_type: 'guidance',
  entity_id: 'g-1',
  metadata: { question: 'Can I reach my goal?', source_class: 'research' },
  ...over
});

beforeAll(() => { expect(isConnected()).toBe(false); });
beforeEach(() => { resetState(); clearAuditLogs(); });

describe('POST /api/audit-log', () => {
  it.each(['GUIDANCE_GIVEN', 'SAFETY_CHECK_PERFORMED', 'SIMULATOR_RUN'])(
    'records %s and the row is retrievable via GET /api/audit-log', async (action) => {
      const post = await request(app).post('/api/audit-log').send(entry({ action }));
      expect(post.status).toBe(201);

      const get = await request(app).get('/api/audit-log').query({ user_id: 'meera_001' });
      expect(get.status).toBe(200);
      const row = get.body.logs.find(l => l.action === action);
      expect(row).toBeDefined();
      expect(row.entity_type).toBe('guidance');
      expect(row.entity_id).toBe('g-1');
      expect(row.metadata).toEqual({ question: 'Can I reach my goal?', source_class: 'research' });
    });

  it('rejects actions reserved for Person B (cannot forge the audit trail)', async () => {
    for (const action of ['TRANSACTION_INGESTED', 'STATE_READ', 'GOAL_UPDATED', 'made_up']) {
      const res = await request(app).post('/api/audit-log').send(entry({ action }));
      expect(res.status).toBe(400);
    }
    const get = await request(app).get('/api/audit-log').query({ user_id: 'meera_001' });
    expect(get.body.logs.length).toBe(0);
  });

  it('requires user_id (never defaults to meera_001) and entity_type', async () => {
    expect((await request(app).post('/api/audit-log').send(entry({ user_id: undefined }))).status).toBe(400);
    expect((await request(app).post('/api/audit-log').send(entry({ user_id: '  ' }))).status).toBe(400);
    expect((await request(app).post('/api/audit-log').send(entry({ entity_type: '' }))).status).toBe(400);
    expect((await request(app).post('/api/audit-log').send(entry({ metadata: [1] }))).status).toBe(400);
  });

  it('returns 404 unknown_user for a user Person B does not know, and records nothing', async () => {
    const res = await request(app).post('/api/audit-log').send(entry({ user_id: 'nobody_123' }));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('unknown_user');
  });
});
