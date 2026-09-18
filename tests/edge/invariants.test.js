const request = require('supertest');
const app = require('../../src/server');
const { resetState } = require('../../src/services/financialStateStore');
const { clearCache } = require('../../src/services/deduplicationService');

describe('Edge: Financial State Invariants (Part 4)', () => {
  beforeEach(() => {
    resetState();
    clearCache();
  });

  async function checkAllInvariants() {
    const res = await request(app).get('/api/financial-state');
    expect(res.status).toBe(200);

    const data = res.body;

    // Invariant 1: State is valid JSON object
    expect(typeof data).toBe('object');
    expect(data).not.toBeNull();

    // Invariant 2: No required pot disappears
    const requiredPots = ['cash', 'bank', 'shg', 'chit_committed', 'post_office'];
    requiredPots.forEach(pot => {
      expect(data.pots).toHaveProperty(pot);
    });

    // Invariant 3 & 4: No pot is NaN or undefined
    requiredPots.forEach(pot => {
      expect(data.pots[pot]).not.toBeUndefined();
      expect(Number.isNaN(data.pots[pot])).toBe(false);
    });

    // Invariant 5: Numeric balances remain numeric
    requiredPots.forEach(pot => {
      expect(typeof data.pots[pot]).toBe('number');
    });

    // Invariant 6: Business profit mathematically consistent
    if (data.business && data.business.last_entry) {
      const { revenue, cost, profit } = data.business.last_entry;
      expect(profit).toBe(revenue - cost);
    }

    // Invariant 7: Goal saved amount remains consistent
    expect(typeof data.goal.target).toBe('number');
    expect(typeof data.goal.saved).toBe('number');

    // Invariant 8: Total balance internally consistent
    const potSum = Object.values(data.pots).reduce((sum, v) => sum + Number(v), 0);
    expect(data.total_balance).toBe(potSum);
  }

  it('preserves all invariants before and after multiple valid mutations', async () => {
    await checkAllInvariants();

    // Ingest transaction
    await request(app).post('/api/transactions').send({
      user_id: "meera_001",
      channel: "whatsapp_voice",
      input_type: "voice",
      raw_text: "earned 500 tailoring",
      normalized_text: "earned 500 tailoring",
      parsed_transaction: { type: "income", amount: 500, category: "tailoring" },
      confidence: 0.95
    });
    await checkAllInvariants();

    // Ingest ledger entry
    await request(app).post('/api/ledger').send({
      user_id: "meera_001",
      activity: "pickle sales",
      revenue: 1200,
      cost: 700
    });
    await checkAllInvariants();

    // Update goal
    await request(app).post('/api/goals/progress').send({
      user_id: "meera_001",
      saved_delta: 1500
    });
    await checkAllInvariants();
  });

  it('preserves all invariants and does not partially mutate state on failed requests', async () => {
    const stateBefore = (await request(app).get('/api/financial-state')).body;

    // Send invalid transaction
    const failedRes = await request(app).post('/api/transactions').send({
      user_id: "meera_001",
      channel: "whatsapp_voice",
      input_type: "voice",
      raw_text: "bad tx",
      normalized_text: "bad tx",
      parsed_transaction: { type: "income", amount: -500, category: "bank" }
    });
    expect(failedRes.status).toBe(400);

    const stateAfter = (await request(app).get('/api/financial-state')).body;
    expect(stateAfter.pots).toEqual(stateBefore.pots);
    expect(stateAfter.total_balance).toBe(stateBefore.total_balance);
  });
});
