const request = require('supertest');
const app = require('../../src/server');
const { resetState } = require('../../src/services/financialStateStore');
const { clearCache } = require('../../src/services/deduplicationService');
const { clearAuditLogs } = require('../../src/services/auditLogger');

describe('Integration: Full End-to-End Meera Story (Part 18)', () => {
  beforeEach(() => {
    resetState();
    clearCache();
    clearAuditLogs();
  });

  it('executes Meera 10-step demo story cleanly end-to-end', async () => {
    // Step 1: Initial financial state is loaded
    const initialRes = await request(app).get('/api/financial-state');
    expect(initialRes.status).toBe(200);
    expect(initialRes.body.pots.cash).toBe(2000);
    expect(initialRes.body.pots.bank).toBe(5000);
    expect(initialRes.body.pots.shg).toBe(2500);
    expect(initialRes.body.pots.chit_committed).toBe(4000);
    expect(initialRes.body.pots.post_office).toBe(5000);
    expect(initialRes.body.total_balance).toBe(18500);

    // Step 2 & 3: Submit "I earned 800 from tailoring today" via Person A contract
    const tailoringTx = {
      user_id: "meera_001",
      channel: "whatsapp_voice",
      input_type: "voice",
      raw_text: "I earned 800 from tailoring today",
      normalized_text: "earned 800 from tailoring today",
      parsed_transaction: {
        type: "income",
        amount: 800,
        category: "tailoring"
      },
      confidence: 0.95
    };

    const txRes = await request(app).post('/api/transactions').send(tailoringTx);
    expect(txRes.status).toBe(201);
    expect(txRes.body.status).toBe('success');

    // Step 4: Verify appropriate financial state changes
    expect(txRes.body.pot_affected).toBe('business');
    expect(txRes.body.updated_financial_state.pots.business).toBe(800);

    // Step 5: Log pickle sales in Business Ledger and verify business state math
    const ledgerRes = await request(app).post('/api/ledger').send({
      user_id: "meera_001",
      activity: "pickle sales",
      revenue: 1000,
      cost: 600,
      notes: "Sold 10 pickle bottles"
    });
    expect(ledgerRes.status).toBe(201);
    expect(ledgerRes.body.ledger_entry.profit).toBe(400);

    // Step 6: Verify and update Education Goal (target 20000, saved 8000 -> add 2000 savings)
    const goalRes = await request(app).post('/api/goals/progress').send({
      user_id: "meera_001",
      saved_delta: 2000
    });
    expect(goalRes.status).toBe(200);
    expect(goalRes.body.goal.saved).toBe(10000);
    expect(goalRes.body.progress_percentage).toBe(50);

    // Step 7 & 8: Read financial state again and verify all required fixture information remains intact
    const finalStateRes = await request(app).get('/api/financial-state');
    expect(finalStateRes.status).toBe(200);
    expect(finalStateRes.body.pots.bank).toBe(5000);
    expect(finalStateRes.body.goal.name).toBe('Education');
    expect(finalStateRes.body.goal.saved).toBe(10000);

    // Step 9 & 10: Submit the exact same tailoring transaction again and verify duplicate protection
    const dupRes = await request(app).post('/api/transactions').send(tailoringTx);
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.status).toBe('duplicate');

    // Confirm pot balance did not mutate a second time
    const verifyState = await request(app).get('/api/financial-state');
    expect(verifyState.body.pots.business).toBe(1200); // 800 (tailoring) + 400 (pickle profit), not double counted!
  });
});
