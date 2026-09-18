const request = require('supertest');
const app = require('../src/server');
const meeraFixture = require('../src/fixtures/meeraFixture.json');
const { resetState } = require('../src/services/financialStateStore');
const { clearCache } = require('../src/services/deduplicationService');
const { clearAuditLogs } = require('../src/services/auditLogger');

describe('Person B: Financial State & API Test Suite', () => {
  beforeEach(() => {
    resetState();
    clearCache();
    clearAuditLogs();
  });

  describe('Hour 0–2 Mock Contract', () => {
    it('GET /api/financial-state/mock returns exact Section 2 Meera demo fixture', async () => {
      const res = await request(app).get('/api/financial-state/mock');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(meeraFixture);
      expect(res.body.cash).toBe(2000);
      expect(res.body.bank).toBe(5000);
      expect(res.body.shg).toBe(2500);
      expect(res.body.chit_committed).toBe(4000);
      expect(res.body.post_office).toBe(5000);
      expect(res.body.business.activity).toBe("pickle sales + tailoring");
      expect(res.body.goal.name).toBe("Education");
      expect(res.body.goal.target).toBe(20000);
      expect(res.body.goal.saved).toBe(8000);
    });
  });

  describe('Financial State Dynamic Aggregation', () => {
    it('GET /api/financial-state computes total_balance dynamically from individual pots', async () => {
      const res = await request(app).get('/api/financial-state');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('pots');
      expect(res.body).toHaveProperty('total_balance');
      
      const pots = res.body.pots;
      const expectedDynamicSum = Number(pots.cash) + Number(pots.bank) + Number(pots.shg) + 
                                Number(pots.chit_committed) + Number(pots.post_office) + 
                                (Number(pots.business) || 0);

      expect(res.body.total_balance).toBe(expectedDynamicSum);
      expect(res.body.total_balance).toBe(18500); // Dynamic sum of fixture pots
    });
  });

  describe('Person A Transaction Ingestion (Strict Contract Compliance)', () => {
    it('POST /api/transactions accepts Person A normalized payload and updates target pot', async () => {
      // Exactly matches Person A contract schema without modifying fields
      const personAPayload = {
        user_id: "meera_001",
        channel: "whatsapp_voice",
        input_type: "voice",
        raw_text: "I earned 800 from tailoring today",
        normalized_text: "earned 800 from tailoring",
        parsed_transaction: {
          type: "income",
          amount: 800,
          category: "tailoring"
        },
        confidence: 0.95
      };

      const res = await request(app)
        .post('/api/transactions')
        .send(personAPayload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.pot_affected).toBe('business');
      expect(res.body.updated_financial_state.pots.business).toBe(800);
    });

    it('POST /api/transactions maps bank deposit category to bank pot', async () => {
      const personAPayload = {
        user_id: "meera_001",
        channel: "whatsapp_text",
        input_type: "text",
        raw_text: "Deposited 1000 in bank",
        normalized_text: "deposited 1000 in bank",
        parsed_transaction: {
          type: "income",
          amount: 1000,
          category: "bank deposit"
        },
        confidence: 0.98
      };

      const res = await request(app)
        .post('/api/transactions')
        .send(personAPayload);

      expect(res.status).toBe(201);
      expect(res.body.pot_affected).toBe('bank');
      expect(res.body.updated_financial_state.pots.bank).toBe(6000); // 5000 + 1000
    });
  });

  describe('Informal Business Ledger', () => {
    it('POST /api/ledger records sales/cost and computes profit accurately', async () => {
      // Demo story: sold 10 pickle bottles for 1,000, cost 600 -> profit 400
      const ledgerPayload = {
        user_id: "meera_001",
        activity: "pickle sales",
        revenue: 1000,
        cost: 600,
        notes: "Sold 10 pickle bottles"
      };

      const res = await request(app)
        .post('/api/ledger')
        .send(ledgerPayload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.ledger_entry.revenue).toBe(1000);
      expect(res.body.ledger_entry.cost).toBe(600);
      expect(res.body.ledger_entry.profit).toBe(400);
      expect(res.body.updated_financial_state.business.last_entry.profit).toBe(400);
    });
  });

  describe('Goals & Progress', () => {
    it('POST /api/goals/progress updates savings progress for Education goal', async () => {
      const res = await request(app)
        .post('/api/goals/progress')
        .send({
          user_id: "meera_001",
          saved_delta: 2000
        });

      expect(res.status).toBe(200);
      expect(res.body.goal.saved).toBe(10000); // 8000 + 2000
      expect(res.body.progress_percentage).toBe(50); // 10000 / 20000 = 50%
    });
  });

  describe('Immutable Audit Logging', () => {
    it('GET /api/audit-log returns recorded system events', async () => {
      // Trigger a state change
      await request(app)
        .post('/api/ledger')
        .send({ user_id: "meera_001", activity: "pickle sales", revenue: 500, cost: 200 });

      const res = await request(app).get('/api/audit-log?user_id=meera_001');
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThan(0);
      expect(res.body.logs.some(l => l.action === 'LEDGER_ENTRY_RECORDED')).toBe(true);
    });
  });
});
