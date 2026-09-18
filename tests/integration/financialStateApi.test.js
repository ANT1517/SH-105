const request = require('supertest');
const app = require('../../src/server');
const { resetState } = require('../../src/services/financialStateStore');

describe('Integration: Financial State API (Part 3)', () => {
  beforeEach(() => {
    resetState();
  });

  it('GET /api/financial-state returns HTTP 200 and valid JSON', async () => {
    const res = await request(app).get('/api/financial-state');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(typeof res.body).toBe('object');
  });

  it('contains all required numeric pots and derived total balance', async () => {
    const res = await request(app).get('/api/financial-state');
    const { pots, total_balance } = res.body;

    expect(typeof pots.cash).toBe('number');
    expect(typeof pots.bank).toBe('number');
    expect(typeof pots.shg).toBe('number');
    expect(typeof pots.chit_committed).toBe('number');
    expect(typeof pots.post_office).toBe('number');
    expect(typeof total_balance).toBe('number');
    expect(total_balance).toBe(18500);
  });

  it('repeated GET requests return consistent immutable state without unintended mutations', async () => {
    const res1 = await request(app).get('/api/financial-state');
    const res2 = await request(app).get('/api/financial-state');
    const res3 = await request(app).get('/api/financial-state');

    expect(res1.body.total_balance).toBe(res2.body.total_balance);
    expect(res2.body.total_balance).toBe(res3.body.total_balance);
    expect(res1.body.pots).toEqual(res3.body.pots);
  });

  it('handles custom user_id queries gracefully', async () => {
    const res = await request(app).get('/api/financial-state?user_id=new_user_999');
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBeDefined();
  });
});
