const request = require('supertest');
const app = require('../../src/server');
const { resetState } = require('../../src/services/financialStateStore');
const { clearCache } = require('../../src/services/deduplicationService');
const { clearAuditLogs } = require('../../src/services/auditLogger');

describe('Integration: Audit Log API & Immutability (Part 13)', () => {
  beforeEach(() => {
    resetState();
    clearCache();
    clearAuditLogs();
  });

  it('records audit events across transactions, duplicates, ledger entries, and goals', async () => {
    // 1. Transaction
    await request(app).post('/api/transactions').send({
      user_id: "meera_001",
      channel: "whatsapp_voice",
      input_type: "voice",
      raw_text: "earned 500 tailoring",
      normalized_text: "earned 500 tailoring",
      parsed_transaction: { type: "income", amount: 500, category: "tailoring" },
      confidence: 0.95
    });

    // 2. Duplicate attempt
    await request(app).post('/api/transactions').send({
      user_id: "meera_001",
      channel: "whatsapp_voice",
      input_type: "voice",
      raw_text: "earned 500 tailoring",
      normalized_text: "earned 500 tailoring",
      parsed_transaction: { type: "income", amount: 500, category: "tailoring" },
      confidence: 0.95
    });

    // 3. Ledger entry
    await request(app).post('/api/ledger').send({
      user_id: "meera_001",
      activity: "pickle sales",
      revenue: 1000,
      cost: 600
    });

    // 4. Goal update
    await request(app).post('/api/goals/progress').send({
      user_id: "meera_001",
      saved_delta: 1000
    });

    const res = await request(app).get('/api/audit-log?user_id=meera_001');
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(4);

    const actions = res.body.logs.map(l => l.action);
    expect(actions).toContain('TRANSACTION_INGESTED');
    expect(actions).toContain('DUPLICATE_TRANSACTION_BLOCKED');
    expect(actions).toContain('LEDGER_ENTRY_RECORDED');
    expect(actions).toContain('GOAL_UPDATED');
  });

  it('serves audit entries in chronological order', async () => {
    const res = await request(app).get('/api/audit-log?user_id=meera_001');
    expect(res.status).toBe(200);
    const logs = res.body.logs;
    for (let i = 0; i < logs.length - 1; i++) {
      const timeA = new Date(logs[i].created_at).getTime();
      const timeB = new Date(logs[i + 1].created_at).getTime();
      expect(timeA).toBeGreaterThanOrEqual(timeB);
    }
  });
});
