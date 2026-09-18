const {
  logEvent,
  getAuditLogs,
  clearAuditLogs
} = require('../../src/services/auditLogger');

describe('Unit: Audit Logger Service', () => {
  beforeEach(() => {
    clearAuditLogs();
  });

  it('records an audit event with timestamps and entity metadata', async () => {
    const entry = await logEvent({
      user_id: 'meera_001',
      action: 'TRANSACTION_INGESTED',
      entity_type: 'transaction',
      entity_id: 'tx_123',
      previous_state: { cash: 2000 },
      new_state: { cash: 2800 },
      metadata: { channel: 'whatsapp_voice' }
    });

    expect(entry.id).toBeDefined();
    expect(entry.action).toBe('TRANSACTION_INGESTED');
    expect(entry.created_at).toBeDefined();

    const logs = await getAuditLogs('meera_001');
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('TRANSACTION_INGESTED');
  });

  it('maintains chronological ordering (newest first)', async () => {
    await logEvent({ user_id: 'meera_001', action: 'EVENT_1', entity_type: 'test' });
    await logEvent({ user_id: 'meera_001', action: 'EVENT_2', entity_type: 'test' });

    const logs = await getAuditLogs('meera_001');
    expect(logs).toHaveLength(2);
    expect(logs[0].action).toBe('EVENT_2');
    expect(logs[1].action).toBe('EVENT_1');
  });

  it('does not overwrite or delete previous audit events during normal logging', async () => {
    for (let i = 1; i <= 5; i++) {
      await logEvent({ user_id: 'meera_001', action: `EVENT_${i}`, entity_type: 'test' });
    }

    const logs = await getAuditLogs('meera_001');
    expect(logs).toHaveLength(5);
  });
});
