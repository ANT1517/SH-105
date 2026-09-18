const request = require('supertest');
const app = require('../../src/server');

describe('Contract: Mock -> Real Financial-State Contract Compatibility (Part 17)', () => {
  it('ensures real GET /api/financial-state has structural parity with mock fixture', async () => {
    const mockRes = await request(app).get('/api/financial-state/mock');
    const realRes = await request(app).get('/api/financial-state');

    expect(mockRes.status).toBe(200);
    expect(realRes.status).toBe(200);

    const mockData = mockRes.body;
    const realData = realRes.body;

    // Both must contain core pots
    const requiredPots = ['cash', 'bank', 'shg', 'chit_committed', 'post_office'];
    requiredPots.forEach(pot => {
      // In mock: top level keys
      expect(typeof mockData[pot]).toBe('number');
      // In real: pots object keys
      expect(typeof realData.pots[pot]).toBe('number');
    });

    // Both must contain business summary
    expect(realData.business).toBeDefined();
    expect(typeof realData.business.activity).toBe('string');
    expect(typeof realData.business.last_entry.revenue).toBe('number');
    expect(typeof realData.business.last_entry.cost).toBe('number');
    expect(typeof realData.business.last_entry.profit).toBe('number');

    // Both must contain goal
    expect(realData.goal).toBeDefined();
    expect(typeof realData.goal.name).toBe('string');
    expect(typeof realData.goal.target).toBe('number');
    expect(typeof realData.goal.saved).toBe('number');

    // Real API provides total_balance
    expect(typeof realData.total_balance).toBe('number');
  });
});
