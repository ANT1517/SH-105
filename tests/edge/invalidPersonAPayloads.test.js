const request = require('supertest');
const app = require('../../src/server');
const { resetState } = require('../../src/services/financialStateStore');
const { clearCache } = require('../../src/services/deduplicationService');

describe('Edge: Invalid Person A Payload Handling (Part 6 - 20 Test Cases)', () => {
  beforeEach(() => {
    resetState();
    clearCache();
  });

  const validBase = {
    user_id: "meera_001",
    channel: "whatsapp_voice",
    input_type: "voice",
    raw_text: "earned 800 tailoring",
    normalized_text: "earned 800 tailoring",
    parsed_transaction: {
      type: "income",
      amount: 800,
      category: "tailoring"
    },
    confidence: 0.95
  };

  async function assertRejected(payload, testName) {
    const res = await request(app).post('/api/transactions').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();

    // Verify state was not partially updated
    const state = await request(app).get('/api/financial-state');
    expect(state.body.pots.bank).toBe(5000);
    expect(state.body.pots.cash).toBe(2000);
  }

  it('1. missing user_id', async () => {
    const p = { ...validBase };
    delete p.user_id;
    await assertRejected(p);
  });

  it('2. missing channel', async () => {
    const p = { ...validBase };
    delete p.channel;
    await assertRejected(p);
  });

  it('3. missing input_type', async () => {
    const p = { ...validBase };
    delete p.input_type;
    await assertRejected(p);
  });

  it('4. missing raw_text', async () => {
    const p = { ...validBase };
    delete p.raw_text;
    await assertRejected(p);
  });

  it('5. missing normalized_text', async () => {
    const p = { ...validBase };
    delete p.normalized_text;
    await assertRejected(p);
  });

  it('6. missing parsed_transaction', async () => {
    const p = { ...validBase };
    delete p.parsed_transaction;
    await assertRejected(p);
  });

  it('7. missing transaction type', async () => {
    const p = { ...validBase, parsed_transaction: { amount: 800, category: "tailoring" } };
    await assertRejected(p);
  });

  it('8. missing amount', async () => {
    const p = { ...validBase, parsed_transaction: { type: "income", category: "tailoring" } };
    await assertRejected(p);
  });

  it('9. missing category', async () => {
    const p = { ...validBase, parsed_transaction: { type: "income", amount: 800 } };
    await assertRejected(p);
  });

  it('10. invalid amount string', async () => {
    const p = { ...validBase, parsed_transaction: { type: "income", amount: "eight-hundred", category: "tailoring" } };
    await assertRejected(p);
  });

  it('11. negative amount', async () => {
    const p = { ...validBase, parsed_transaction: { type: "income", amount: -800, category: "tailoring" } };
    await assertRejected(p);
  });

  it('12. zero amount', async () => {
    const p = { ...validBase, parsed_transaction: { type: "income", amount: 0, category: "tailoring" } };
    await assertRejected(p);
  });

  it('13. null amount', async () => {
    const p = { ...validBase, parsed_transaction: { type: "income", amount: null, category: "tailoring" } };
    await assertRejected(p);
  });

  it('14. null category', async () => {
    const p = { ...validBase, parsed_transaction: { type: "income", amount: 800, category: null } };
    await assertRejected(p);
  });

  it('15. empty category string', async () => {
    const p = { ...validBase, parsed_transaction: { type: "income", amount: 800, category: "   " } };
    await assertRejected(p);
  });

  it('16. malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Content-Type', 'application/json')
      .send('{"user_id": "meera", amount: }');
    expect(res.status).toBe(400);
  });

  it('17. completely empty body', async () => {
    const res = await request(app).post('/api/transactions').send({});
    expect(res.status).toBe(400);
  });

  it('18. extra unexpected fields do not bypass validation or crash server', async () => {
    const p = { ...validBase, unexpected_hacker_field: "inject", parsed_transaction: { ...validBase.parsed_transaction, amount: -100 } };
    await assertRejected(p);
  });

  it('19. invalid confidence string', async () => {
    const p = { ...validBase, confidence: "very_high" };
    await assertRejected(p);
  });

  it('20. confidence outside valid range (e.g. 1.5 or -0.2)', async () => {
    const p1 = { ...validBase, confidence: 1.5 };
    await assertRejected(p1);

    const p2 = { ...validBase, confidence: -0.2 };
    await assertRejected(p2);
  });
});
