const request = require('supertest');
const app = require('../../src/server');

describe('Edge: API Error Handling & Sanitization (Part 14)', () => {
  it('returns HTTP 404 with structured JSON for unknown routes', async () => {
    const res = await request(app).get('/api/unknown-route-xyz');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Endpoint not found');
  });

  it('returns HTTP 400 for malformed JSON bodies without stack traces', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Content-Type', 'application/json')
      .send('{ bad_json: ');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Malformed JSON body');
    expect(res.body).not.toHaveProperty('stack');
  });

  it('does not leak internal database credentials or secrets on unexpected errors', async () => {
    const res = await request(app).get('/api/financial-state');
    const resStr = JSON.stringify(res.body);

    expect(resStr).not.toContain('postgres://');
    expect(resStr).not.toContain('password');
    expect(resStr).not.toContain('DATABASE_URL');
    expect(res.body).not.toHaveProperty('stack');
  });
});
