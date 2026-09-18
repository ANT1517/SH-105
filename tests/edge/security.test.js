const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../src/server');

describe('Edge: Security Verification (Part 20)', () => {
  it('verifies .gitignore contains .env and node_modules', () => {
    const gitignorePath = path.join(__dirname, '../../.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    expect(gitignoreContent).toContain('.env');
    expect(gitignoreContent).toContain('node_modules');
  });

  it('verifies .env.example contains placeholder values and no hardcoded production secrets', () => {
    const envExamplePath = path.join(__dirname, '../../.env.example');
    expect(fs.existsSync(envExamplePath)).toBe(true);
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
    expect(envExampleContent).toContain('localhost');
    expect(envExampleContent).not.toContain('production-secret');
  });

  it('resists SQL injection payloads in user inputs without database error leaks', async () => {
    const sqlInjectionPayload = {
      user_id: "meera_001'; DROP TABLE users; --",
      channel: "whatsapp_voice",
      input_type: "voice",
      raw_text: " earned 500 tailoring ",
      normalized_text: " earned 500 tailoring ",
      parsed_transaction: {
        type: "income",
        amount: 500,
        category: "tailoring'; DROP TABLE pots; --"
      },
      confidence: 1.0
    };

    const res = await request(app).post('/api/transactions').send(sqlInjectionPayload);
    // Should be safely handled and sanitized
    expect([201, 400, 409]).toContain(res.status);

    const resStr = JSON.stringify(res.body);
    expect(resStr).not.toContain('syntax error');
    expect(resStr).not.toContain('pg_catalog');
  });
});
