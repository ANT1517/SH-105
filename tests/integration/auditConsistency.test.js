const request = require('supertest');
const app = require('../../src/server');
const { resetState } = require('../../src/services/financialStateStore');
const { clearCache } = require('../../src/services/deduplicationService');
const { clearAuditLogs } = require('../../src/services/auditLogger');
const { checkDatabaseConnection, initSchema, query } = require('../../src/db/db');

const TEST_USER = `audit_cons_${Date.now()}`;
let dbConnected = false;

beforeAll(async () => {
  dbConnected = await checkDatabaseConnection();
  if (dbConnected) {
    await initSchema();
    await query('INSERT INTO users (id, name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING', [TEST_USER, 'AuditConsistencyUser']);
    await query('INSERT INTO pots (user_id, pot_type, amount) VALUES ($1,$2,$3) ON CONFLICT (user_id, pot_type) DO UPDATE SET amount=$3', [TEST_USER, 'cash', 5000]);
  }
});

afterAll(async () => {
  if (dbConnected) {
    try { await query('DELETE FROM users WHERE id=$1', [TEST_USER]); } catch(_){}
  }
});

beforeEach(() => {
  resetState();
  clearCache();
  clearAuditLogs();
});

describe('Audit-Log Consistency: Mutation + Audit share the same DB transaction', () => {
  it('both ledger_entry and audit_log row appear after a successful ledger POST', async () => {
    if (!dbConnected) { console.warn('Skipping: no DB'); return; }

    const auditBefore = Number((await query('SELECT COUNT(*) FROM audit_logs WHERE user_id=$1', [TEST_USER])).rows[0].count);
    const ledgerBefore = Number((await query('SELECT COUNT(*) FROM ledger_entries WHERE user_id=$1', [TEST_USER])).rows[0].count);

    const res = await request(app).post('/api/ledger').send({
      user_id: TEST_USER, activity: 'test tailoring', revenue: 1000, cost: 400
    });
    expect(res.status).toBe(201);

    const auditAfter = Number((await query('SELECT COUNT(*) FROM audit_logs WHERE user_id=$1', [TEST_USER])).rows[0].count);
    const ledgerAfter = Number((await query('SELECT COUNT(*) FROM ledger_entries WHERE user_id=$1', [TEST_USER])).rows[0].count);

    expect(auditAfter).toBe(auditBefore + 1);
    expect(ledgerAfter).toBe(ledgerBefore + 1);
  });

  it('both goal row and audit_log appear after a successful goal POST', async () => {
    if (!dbConnected) { console.warn('Skipping: no DB'); return; }

    const auditBefore = Number((await query('SELECT COUNT(*) FROM audit_logs WHERE user_id=$1', [TEST_USER])).rows[0].count);

    const res = await request(app).post('/api/goals').send({
      user_id: TEST_USER, name: 'Audit Test Goal', target_amount: 5000, saved_amount: 0
    });
    expect(res.status).toBe(201);

    const auditAfter = Number((await query('SELECT COUNT(*) FROM audit_logs WHERE user_id=$1', [TEST_USER])).rows[0].count);
    const goalRows = await query('SELECT * FROM goals WHERE user_id=$1 AND is_active=true', [TEST_USER]);

    expect(auditAfter).toBe(auditBefore + 1);
    expect(goalRows.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('rollback: insufficient-funds leaves zero mutations — no transaction, pot, or audit row added', async () => {
    if (!dbConnected) { console.warn('Skipping: no DB'); return; }

    const potBefore = Number((await query('SELECT amount FROM pots WHERE user_id=$1 AND pot_type=$2', [TEST_USER, 'cash'])).rows[0]?.amount ?? 5000);
    const auditBefore = Number((await query("SELECT COUNT(*) FROM audit_logs WHERE user_id=$1 AND action='TRANSACTION_INGESTED'", [TEST_USER])).rows[0].count);
    const txBefore = Number((await query('SELECT COUNT(*) FROM transactions WHERE user_id=$1', [TEST_USER])).rows[0].count);

    const res = await request(app).post('/api/transactions').send({
      user_id: TEST_USER,
      channel: 'whatsapp_voice',
      input_type: 'voice',
      raw_text: `overdraft ${Date.now()}`,
      normalized_text: `overdraft-${Date.now()}`,
      parsed_transaction: { type: 'expense', amount: 999999, category: 'cash' },
      confidence: 1.0
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Insufficient funds');

    const potAfter = Number((await query('SELECT amount FROM pots WHERE user_id=$1 AND pot_type=$2', [TEST_USER, 'cash'])).rows[0].amount);
    const auditAfter = Number((await query("SELECT COUNT(*) FROM audit_logs WHERE user_id=$1 AND action='TRANSACTION_INGESTED'", [TEST_USER])).rows[0].count);
    const txAfter = Number((await query('SELECT COUNT(*) FROM transactions WHERE user_id=$1', [TEST_USER])).rows[0].count);

    expect(potAfter).toBe(potBefore);
    expect(auditAfter).toBe(auditBefore);
    expect(txAfter).toBe(txBefore);
  });
});
