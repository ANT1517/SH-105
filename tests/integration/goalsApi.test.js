const request = require('supertest');
const app = require('../../src/server');
const { resetState } = require('../../src/services/financialStateStore');
const { clearAuditLogs } = require('../../src/services/auditLogger');

describe('Integration: Goals API & Savings Progress (Part 12)', () => {
  beforeEach(() => {
    resetState();
    clearAuditLogs();
  });

  it('GET /api/goals returns current goal and derivable remaining amount (12000 for Meera)', async () => {
    const res = await request(app).get('/api/goals');
    expect(res.status).toBe(200);
    expect(res.body.goal.name).toBe('Education');
    expect(res.body.goal.target).toBe(20000);
    expect(res.body.goal.saved).toBe(8000);
    expect(res.body.remaining).toBe(12000);
    expect(res.body.progress_percentage).toBe(40);
  });

  it('POST /api/goals creates a new goal', async () => {
    const res = await request(app).post('/api/goals').send({
      user_id: "meera_001",
      name: "Sewing Machine",
      target_amount: 15000,
      saved_amount: 3000
    });

    expect(res.status).toBe(201);
    expect(res.body.goal.name).toBe('Sewing Machine');
    expect(res.body.goal.target).toBe(15000);
    expect(res.body.goal.saved).toBe(3000);
    expect(res.body.remaining).toBe(12000);
    expect(res.body.progress_percentage).toBe(20);
  });

  it('POST /api/goals/progress updates savings progress delta', async () => {
    const res = await request(app).post('/api/goals/progress').send({
      user_id: "meera_001",
      saved_delta: 2000
    });

    expect(res.status).toBe(200);
    expect(res.body.goal.saved).toBe(10000); // 8000 + 2000
    expect(res.body.remaining).toBe(10000);
    expect(res.body.progress_percentage).toBe(50);
  });

  it('handles saved >= target correctly (100% completion)', async () => {
    const res = await request(app).post('/api/goals/progress').send({
      user_id: "meera_001",
      saved_delta: 12000
    });

    expect(res.status).toBe(200);
    expect(res.body.goal.saved).toBe(20000);
    expect(res.body.remaining).toBe(0);
    expect(res.body.progress_percentage).toBe(100);
  });

  it('rejects invalid targets, missing names, and negative numbers with 400', async () => {
    const res1 = await request(app).post('/api/goals').send({ name: "", target_amount: 5000 });
    expect(res1.status).toBe(400);

    const res2 = await request(app).post('/api/goals').send({ name: "Invalid", target_amount: -5000 });
    expect(res2.status).toBe(400);

    const res3 = await request(app).post('/api/goals').send({ name: "Invalid", target_amount: 0 });
    expect(res3.status).toBe(400);
  });
});
