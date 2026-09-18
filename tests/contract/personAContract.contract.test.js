const request = require('supertest');
const app = require('../../src/server');
const { resetState } = require('../../src/services/financialStateStore');
const { clearCache } = require('../../src/services/deduplicationService');
const { clearAuditLogs } = require('../../src/services/auditLogger');

describe('Contract: Person A -> Person B Ingestion Contract (Part 5)', () => {
  beforeEach(() => {
    resetState();
    clearCache();
    clearAuditLogs();
  });

  it('accepts exact normalized-input contract payload without requiring pot_type', async () => {
    const validPersonAPayload = {
      user_id: "meera_001",
      channel: "whatsapp_voice",
      input_type: "voice",
      raw_text: "I earned 800 from tailoring today",
      normalized_text: "earned 800 from tailoring today",
      parsed_transaction: {
        type: "income",
        amount: 800,
        category: "tailoring"
      },
      confidence: 0.95
    };

    // Assert payload does NOT have pot_type
    expect(validPersonAPayload).not.toHaveProperty('pot_type');
    expect(validPersonAPayload.parsed_transaction).not.toHaveProperty('pot_type');

    const res = await request(app)
      .post('/api/transactions')
      .send(validPersonAPayload);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.transaction).toBeDefined();
    expect(res.body.transaction.user_id).toBe('meera_001');
    expect(res.body.transaction.amount).toBe(800);
    expect(res.body.transaction.category).toBe('tailoring');
    expect(res.body.pot_affected).toBe('business');
  });

  it('does not expose internal secrets or database credentials in API response', async () => {
    const payload = {
      user_id: "meera_001",
      channel: "whatsapp_text",
      input_type: "text",
      raw_text: "Saved 500 in bank",
      normalized_text: "saved 500 in bank",
      parsed_transaction: {
        type: "income",
        amount: 500,
        category: "bank deposit"
      },
      confidence: 1.0
    };

    const res = await request(app).post('/api/transactions').send(payload);
    const responseStr = JSON.stringify(res.body);

    expect(responseStr).not.toContain('postgres://');
    expect(responseStr).not.toContain('password');
    expect(responseStr).not.toContain('DATABASE_URL');
  });
});
