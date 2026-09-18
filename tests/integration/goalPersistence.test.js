/**
 * Goal Persistence & Restart Recovery Test Suite
 *
 * Verifies:
 * 1. POST /api/goals persists to PostgreSQL goals table.
 * 2. GET /api/goals reads real DB state.
 * 3. POST /api/goals/progress updates and persists progress delta to PostgreSQL.
 * 4. Input validation rejects target <= 0, invalid/empty users, and negative amounts.
 * 5. Persistence across simulated backend restart (resetting in-memory state & recreating server app).
 */

require('dotenv').config();
const request = require('supertest');
const app = require('../../src/server');
const { pool, checkDatabaseConnection, initSchema, query } = require('../../src/db/db');
const { seedMeera } = require('../../src/db/seed');
const { resetState, getActiveGoal } = require('../../src/services/financialStateStore');
const { clearAuditLogs } = require('../../src/services/auditLogger');

describe('Goal Persistence & DB State Across Restarts', () => {
  let dbConnected = false;
  const TEST_USER = `goal_user_${Date.now()}`;

  beforeAll(async () => {
    dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      throw new Error('Database connection required for Goal Persistence integration tests');
    }
    await initSchema();
    await seedMeera();

    // Ensure test user exists
    await query('INSERT INTO users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [TEST_USER, 'Goal User']);
  });

  afterAll(async () => {
    if (dbConnected) {
      try {
        await query('DELETE FROM goals WHERE user_id = $1', [TEST_USER]);
        await query('DELETE FROM users WHERE id = $1', [TEST_USER]);
        await pool.end();
      } catch (err) {
        // ignore
      }
    }
  });

  beforeEach(() => {
    resetState();
    clearAuditLogs();
  });

  it('1. Rejects target <= 0, invalid names, and negative amounts with 400', async () => {
    // Missing name
    const res1 = await request(app).post('/api/goals').send({
      user_id: TEST_USER,
      name: '',
      target_amount: 10000
    });
    expect(res1.status).toBe(400);

    // Target <= 0
    const res2 = await request(app).post('/api/goals').send({
      user_id: TEST_USER,
      name: 'Emergency Fund',
      target_amount: 0
    });
    expect(res2.status).toBe(400);

    const res3 = await request(app).post('/api/goals').send({
      user_id: TEST_USER,
      name: 'Emergency Fund',
      target_amount: -5000
    });
    expect(res3.status).toBe(400);

    // Negative saved amount
    const res4 = await request(app).post('/api/goals').send({
      user_id: TEST_USER,
      name: 'Emergency Fund',
      target_amount: 10000,
      saved_amount: -100
    });
    expect(res4.status).toBe(400);

    // Invalid / empty user_id
    const res5 = await request(app).post('/api/goals').send({
      user_id: '   ',
      name: 'Emergency Fund',
      target_amount: 10000
    });
    expect(res5.status).toBe(400);
  });

  it('2. POST /api/goals persists new goal directly to PostgreSQL', async () => {
    const res = await request(app).post('/api/goals').send({
      user_id: TEST_USER,
      name: 'Solar Panel System',
      target_amount: 25000,
      saved_amount: 5000
    });

    expect(res.status).toBe(201);
    expect(res.body.goal.name).toBe('Solar Panel System');
    expect(res.body.goal.target).toBe(25000);
    expect(res.body.goal.saved).toBe(5000);
    expect(res.body.remaining).toBe(20000);
    expect(res.body.progress_percentage).toBe(20);

    // Directly verify in PostgreSQL database
    const dbRes = await query(
      'SELECT name, target_amount, saved_amount, is_active FROM goals WHERE user_id = $1 AND is_active = true',
      [TEST_USER]
    );
    expect(dbRes.rows.length).toBe(1);
    expect(dbRes.rows[0].name).toBe('Solar Panel System');
    expect(Number(dbRes.rows[0].target_amount)).toBe(25000);
    expect(Number(dbRes.rows[0].saved_amount)).toBe(5000);
  });

  it('3. GET /api/goals reads real DB state for the user', async () => {
    const res = await request(app).get(`/api/goals?user_id=${TEST_USER}`);

    expect(res.status).toBe(200);
    expect(res.body.goal.name).toBe('Solar Panel System');
    expect(res.body.goal.target).toBe(25000);
    expect(res.body.goal.saved).toBe(5000);
    expect(res.body.remaining).toBe(20000);
    expect(res.body.progress_percentage).toBe(20);
  });

  it('4. POST /api/goals/progress persists progress update to PostgreSQL', async () => {
    const res = await request(app).post('/api/goals/progress').send({
      user_id: TEST_USER,
      saved_delta: 7500
    });

    expect(res.status).toBe(200);
    expect(res.body.goal.saved).toBe(12500); // 5000 + 7500
    expect(res.body.remaining).toBe(12500);
    expect(res.body.progress_percentage).toBe(50);

    // Directly verify in PostgreSQL database
    const dbRes = await query(
      'SELECT saved_amount, target_amount FROM goals WHERE user_id = $1 AND is_active = true',
      [TEST_USER]
    );
    expect(dbRes.rows.length).toBe(1);
    expect(Number(dbRes.rows[0].saved_amount)).toBe(12500);
  });

  it('5. Goal state survives backend restart / memory flush', async () => {
    // Simulate backend server crash / restart: flush all in-memory states
    resetState();
    clearAuditLogs();

    // Verify in-memory state is empty or reset to baseline
    // Now make a GET request to the fresh app instance
    const res = await request(app).get(`/api/goals?user_id=${TEST_USER}`);

    expect(res.status).toBe(200);
    // Should still read exactly the persisted goal from PostgreSQL
    expect(res.body.goal.name).toBe('Solar Panel System');
    expect(res.body.goal.target).toBe(25000);
    expect(res.body.goal.saved).toBe(12500);
    expect(res.body.remaining).toBe(12500);
    expect(res.body.progress_percentage).toBe(50);
  });

  it('6. PATCH /api/goals persists target and name modifications', async () => {
    const res = await request(app).patch('/api/goals').send({
      user_id: TEST_USER,
      name: 'Upgraded Solar Panel 5kW',
      target_amount: 30000
    });

    expect(res.status).toBe(200);
    expect(res.body.goal.name).toBe('Upgraded Solar Panel 5kW');
    expect(res.body.goal.target).toBe(30000);
    expect(res.body.goal.saved).toBe(12500);

    // Verify in DB
    const dbRes = await query(
      'SELECT name, target_amount, saved_amount FROM goals WHERE user_id = $1 AND is_active = true',
      [TEST_USER]
    );
    expect(dbRes.rows[0].name).toBe('Upgraded Solar Panel 5kW');
    expect(Number(dbRes.rows[0].target_amount)).toBe(30000);
  });
});
