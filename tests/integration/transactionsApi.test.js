const request = require('supertest');
const app = require('../../src/server');
const { resetState } = require('../../src/services/financialStateStore');
const { clearCache } = require('../../src/services/deduplicationService');
const { clearAuditLogs } = require('../../src/services/auditLogger');

describe('Integration: Transactions API - Income/Expense Logic & Boundaries (Part 8)', () => {
  beforeEach(() => {
    resetState();
    clearCache();
    clearAuditLogs();
  });

  it('correctly increments balance on income transaction', async () => {
    const res = await request(app).post('/api/transactions').send({
      user_id: "meera_001",
      channel: "whatsapp_voice",
      input_type: "voice",
      raw_text: "Received 500 bank deposit",
      normalized_text: "received 500 bank deposit",
      parsed_transaction: { type: "income", amount: 500, category: "bank deposit" },
      confidence: 1.0
    });

    expect(res.status).toBe(201);
    expect(res.body.updated_financial_state.pots.bank).toBe(5500); // 5000 + 500
  });

  it('correctly decrements balance on expense transaction without increasing balance', async () => {
    const res = await request(app).post('/api/transactions').send({
      user_id: "meera_001",
      channel: "whatsapp_text",
      input_type: "text",
      raw_text: "Spent 300 from cash",
      normalized_text: "spent 300 cash",
      parsed_transaction: { type: "expense", amount: 300, category: "cash" },
      confidence: 1.0
    });

    expect(res.status).toBe(201);
    expect(res.body.updated_financial_state.pots.cash).toBe(1700); // 2000 - 300
  });

  it('handles small decimal amounts (0.01 boundary)', async () => {
    const res = await request(app).post('/api/transactions').send({
      user_id: "meera_001",
      channel: "whatsapp_text",
      input_type: "text",
      raw_text: "interest 0.01",
      normalized_text: "interest 0.01",
      parsed_transaction: { type: "income", amount: 0.01, category: "bank" },
      confidence: 1.0
    });

    expect(res.status).toBe(201);
    expect(res.body.updated_financial_state.pots.bank).toBe(5000.01);
  });

  it('handles standard and large valid amounts (1, 999.99, 1000, 50000)', async () => {
    const amounts = [1, 999.99, 1000];
    for (const amt of amounts) {
      clearCache();
      const res = await request(app).post('/api/transactions').send({
        user_id: "meera_001",
        channel: "whatsapp_text",
        input_type: "text",
        raw_text: `Deposit ${amt}`,
        normalized_text: `deposit ${amt}`,
        parsed_transaction: { type: "income", amount: amt, category: "bank deposit" },
        confidence: 1.0
      });
      expect(res.status).toBe(201);
    }
  });

  it('rejects zero, negative, and invalid amounts', async () => {
    const invalidAmounts = [0, -50, -0.01, 'invalid'];
    for (const amt of invalidAmounts) {
      const res = await request(app).post('/api/transactions').send({
        user_id: "meera_001",
        channel: "whatsapp_text",
        input_type: "text",
        raw_text: "Bad amount",
        normalized_text: "bad amount",
        parsed_transaction: { type: "income", amount: amt, category: "bank" },
        confidence: 1.0
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    }
  });
});
