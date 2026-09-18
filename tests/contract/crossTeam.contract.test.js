const request = require('supertest');
const app = require('../../src/server');

describe('Contract: Cross-Team C & D Read Compatibility (Parts 16 & 19)', () => {
  it('serves state readable by Person C (RAG / Guidance) without DB internals', async () => {
    const res = await request(app).get('/api/financial-state?user_id=meera_001');
    expect(res.status).toBe(200);

    const data = res.body;

    // Person C checks available balances and goal gap for guidance
    expect(data.pots.bank).toBeGreaterThan(0);
    expect(data.goal.target).toBe(20000);
    expect(data.goal.saved).toBe(8000);

    const goalGap = data.goal.target - data.goal.saved;
    expect(goalGap).toBe(12000);

    // No leakage of internal DB query properties or pg specifics
    expect(data).not.toHaveProperty('client');
    expect(data).not.toHaveProperty('rows');
    expect(data).not.toHaveProperty('oid');
  });

  it('serves state readable by Person D (Money Pot Map Dashboard)', async () => {
    const res = await request(app).get('/api/financial-state');
    expect(res.status).toBe(200);

    const data = res.body;

    // Person D dashboard requires pots block & dynamic total balance
    expect(data.pots).toBeDefined();
    expect(data.pots.cash).toBe(2000);
    expect(data.pots.bank).toBe(5000);
    expect(data.pots.shg).toBe(2500);
    expect(data.pots.chit_committed).toBe(4000);
    expect(data.pots.post_office).toBe(5000);

    expect(data.total_balance).toBe(18500);
  });
});
