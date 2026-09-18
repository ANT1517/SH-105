const request = require('supertest');
const app = require('../src/server');
const { resetState } = require('../src/services/financialStateStore');
const { clearCache } = require('../src/services/deduplicationService');
const { clearAuditLogs } = require('../src/services/auditLogger');

describe('Person B: Duplicate Transaction Detection Suite', () => {
  beforeEach(() => {
    resetState();
    clearCache();
    clearAuditLogs();
  });

  it('allows the first transaction through', async () => {
    const payload = {
      user_id: "meera_001",
      channel: "whatsapp_voice",
      input_type: "voice",
      raw_text: "I earned 800 from tailoring",
      normalized_text: "earned 800 tailoring",
      parsed_transaction: {
        type: "income",
        amount: 800,
        category: "tailoring"
      },
      confidence: 0.98
    };

    const res = await request(app)
      .post('/api/transactions')
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
  });

  it('blocks duplicate transactions submitted within the window', async () => {
    const payload = {
      user_id: "meera_001",
      channel: "whatsapp_voice",
      input_type: "voice",
      raw_text: "I earned 800 from tailoring",
      normalized_text: "earned 800 tailoring",
      parsed_transaction: {
        type: "income",
        amount: 800,
        category: "tailoring"
      },
      confidence: 0.98
    };

    // First attempt
    const res1 = await request(app).post('/api/transactions').send(payload);
    expect(res1.status).toBe(201);

    // Duplicate attempt
    const res2 = await request(app).post('/api/transactions').send(payload);
    expect(res2.status).toBe(409);
    expect(res2.body.status).toBe('duplicate');
    expect(res2.body.message).toContain('Duplicate transaction detected');
  });

  it('records an audit log entry when a duplicate is blocked', async () => {
    const payload = {
      user_id: "meera_001",
      channel: "whatsapp_voice",
      input_type: "voice",
      raw_text: "Sold pickles for 500",
      normalized_text: "sold pickles 500",
      parsed_transaction: {
        type: "income",
        amount: 500,
        category: "pickle sales"
      },
      confidence: 0.92
    };

    // First transaction
    await request(app).post('/api/transactions').send(payload);

    // Duplicate transaction
    await request(app).post('/api/transactions').send(payload);

    // Verify Audit Log
    const auditRes = await request(app).get('/api/audit-log?user_id=meera_001');
    expect(auditRes.status).toBe(200);
    const dupLog = auditRes.body.logs.find(l => l.action === 'DUPLICATE_TRANSACTION_BLOCKED');
    expect(dupLog).toBeDefined();
    expect(dupLog.metadata.amount).toBe(500);
  });
});
