const request = require('supertest');
const app = require('../../src/server');
const { resetState } = require('../../src/services/financialStateStore');
const { clearAuditLogs } = require('../../src/services/auditLogger');

describe('Integration: Business Ledger API & Profit Logic (Part 11)', () => {
  beforeEach(() => {
    resetState();
    clearAuditLogs();
  });

  it('POST /api/ledger records sales/cost and computes profit = revenue - cost (1000 - 600 = 400)', async () => {
    const res = await request(app).post('/api/ledger').send({
      user_id: "meera_001",
      activity: "pickle sales",
      revenue: 1000,
      cost: 600,
      notes: "Sold 10 bottles"
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.ledger_entry.revenue).toBe(1000);
    expect(res.body.ledger_entry.cost).toBe(600);
    expect(res.body.ledger_entry.profit).toBe(400);

    // Check financial state reflects the profit
    expect(res.body.updated_financial_state.business.last_entry.profit).toBe(400);
  });

  it('handles revenue only (cost defaults to 0)', async () => {
    const res = await request(app).post('/api/ledger').send({
      user_id: "meera_001",
      activity: "tailoring",
      revenue: 800
    });

    expect(res.status).toBe(201);
    expect(res.body.ledger_entry.revenue).toBe(800);
    expect(res.body.ledger_entry.cost).toBe(0);
    expect(res.body.ledger_entry.profit).toBe(800);
  });

  it('handles cost only (revenue defaults to 0 -> negative profit/loss)', async () => {
    const res = await request(app).post('/api/ledger').send({
      user_id: "meera_001",
      activity: "fabric purchase",
      cost: 300
    });

    expect(res.status).toBe(201);
    expect(res.body.ledger_entry.revenue).toBe(0);
    expect(res.body.ledger_entry.cost).toBe(300);
    expect(res.body.ledger_entry.profit).toBe(-300);
  });

  it('handles zero revenue and zero cost (profit = 0)', async () => {
    const res = await request(app).post('/api/ledger').send({
      user_id: "meera_001",
      activity: "market visit",
      revenue: 0,
      cost: 0
    });

    expect(res.status).toBe(201);
    expect(res.body.ledger_entry.profit).toBe(0);
  });

  it('handles decimal values with financial precision', async () => {
    const res = await request(app).post('/api/ledger').send({
      user_id: "meera_001",
      activity: "lemon pickle",
      revenue: 125.50,
      cost: 45.25
    });

    expect(res.status).toBe(201);
    expect(res.body.ledger_entry.revenue).toBe(125.50);
    expect(res.body.ledger_entry.cost).toBe(45.25);
    expect(res.body.ledger_entry.profit).toBe(80.25);
  });

  it('rejects negative values for revenue and cost with 400 Bad Request', async () => {
    const res1 = await request(app).post('/api/ledger').send({ user_id: "meera_001", revenue: -500, cost: 100 });
    expect(res1.status).toBe(400);

    const res2 = await request(app).post('/api/ledger').send({ user_id: "meera_001", revenue: 500, cost: -100 });
    expect(res2.status).toBe(400);
  });

  it('GET /api/ledger returns ledger history', async () => {
    await request(app).post('/api/ledger').send({ user_id: "meera_001", activity: "sale 1", revenue: 500, cost: 200 });
    await request(app).post('/api/ledger').send({ user_id: "meera_001", activity: "sale 2", revenue: 600, cost: 300 });

    const res = await request(app).get('/api/ledger?user_id=meera_001');
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(2);
  });
});
