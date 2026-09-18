const request = require('supertest');
const app = require('../../src/server');
const { resetState } = require('../../src/services/financialStateStore');
const { clearCache } = require('../../src/services/deduplicationService');
const { clearAuditLogs } = require('../../src/services/auditLogger');

describe('Integration: Concurrency & Race Condition Safety (Parts 9H & 15)', () => {
  beforeEach(() => {
    resetState();
    clearCache();
    clearAuditLogs();
  });

  it('handles 10 independent valid concurrent transactions without losing updates', async () => {
    const promises = [];
    for (let i = 1; i <= 10; i++) {
      promises.push(
        request(app).post('/api/transactions').send({
          user_id: "meera_001",
          channel: "whatsapp_text",
          input_type: "text",
          raw_text: `Deposit ${i * 10}`,
          normalized_text: `deposit ${i * 10}`,
          parsed_transaction: {
            type: "income",
            amount: 100,
            category: "bank deposit"
          },
          confidence: 1.0
        })
      );
    }

    const responses = await Promise.all(promises);
    responses.forEach(res => {
      expect(res.status).toBe(201);
    });

    const finalState = await request(app).get('/api/financial-state');
    // Starting bank balance was 5000 + (10 * 100) = 6000
    expect(finalState.body.pots.bank).toBe(6000);
  });

  it('handles concurrent duplicate submissions safely preventing double counting', async () => {
    const tx = {
      user_id: "meera_001",
      channel: "whatsapp_voice",
      input_type: "voice",
      raw_text: "Earned 500 tailoring",
      normalized_text: "earned 500 tailoring",
      parsed_transaction: {
        type: "income",
        amount: 500,
        category: "tailoring"
      },
      confidence: 0.9
    };

    // Send 5 identical requests simultaneously
    const promises = [
      request(app).post('/api/transactions').send(tx),
      request(app).post('/api/transactions').send(tx),
      request(app).post('/api/transactions').send(tx),
      request(app).post('/api/transactions').send(tx),
      request(app).post('/api/transactions').send(tx)
    ];

    const responses = await Promise.all(promises);
    const successCount = responses.filter(r => r.status === 201).length;
    const duplicateCount = responses.filter(r => r.status === 409).length;

    expect(successCount).toBe(1);
    expect(duplicateCount).toBe(4);

    const finalState = await request(app).get('/api/financial-state');
    expect(finalState.body.pots.business).toBe(500); // Only applied once!
  });
});
