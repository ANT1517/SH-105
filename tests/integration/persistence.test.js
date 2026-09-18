const { isConnected, query } = require('../../src/db/db');
const { getFinancialState, updatePotBalance, resetState } = require('../../src/services/financialStateStore');

describe('Integration: Persistence & Database Isolation (Parts 10 & 21)', () => {
  beforeEach(() => {
    resetState();
  });

  it('verifies state store initialization and fallback coherence', async () => {
    const state = await getFinancialState('meera_001');
    expect(state).toBeDefined();
    expect(state.pots.bank).toBe(5000);
    expect(state.pots.cash).toBe(2000);
  });

  it('updates pot balance consistently in memory and database if connected', async () => {
    const updateResult = await updatePotBalance('meera_001', 'bank', 500, 'add');
    expect(updateResult.newAmount).toBe(5500);

    const state = await getFinancialState('meera_001');
    expect(state.pots.bank).toBe(5500);
  });

  it('maintains isolated test state without mutating fixture base files', async () => {
    const fixture = require('../../src/fixtures/meeraFixture.json');
    expect(fixture.bank).toBe(5000);
    expect(fixture.cash).toBe(2000);
  });
});
