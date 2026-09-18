const meeraFixture = require('../../src/fixtures/meeraFixture.json');
const { calculateTotalBalance } = require('../../src/services/potCalculator');

describe('Contract: Meera Fixture Integrity & Contracts (Part 2)', () => {
  it('contains every required top-level field from Section 2 of Build Plan v3', () => {
    expect(meeraFixture).toHaveProperty('cash');
    expect(meeraFixture).toHaveProperty('bank');
    expect(meeraFixture).toHaveProperty('shg');
    expect(meeraFixture).toHaveProperty('chit_committed');
    expect(meeraFixture).toHaveProperty('post_office');
    expect(meeraFixture).toHaveProperty('business');
    expect(meeraFixture).toHaveProperty('goal');
  });

  it('preserves exact pot names and numeric values without alteration', () => {
    expect(meeraFixture.cash).toBe(2000);
    expect(meeraFixture.bank).toBe(5000);
    expect(meeraFixture.shg).toBe(2500);
    expect(meeraFixture.chit_committed).toBe(4000);
    expect(meeraFixture.post_office).toBe(5000);
  });

  it('preserves business activity and last entry values', () => {
    expect(meeraFixture.business.activity).toBe('pickle sales + tailoring');
    expect(meeraFixture.business.last_entry.revenue).toBe(1000);
    expect(meeraFixture.business.last_entry.cost).toBe(600);
    expect(meeraFixture.business.last_entry.profit).toBe(400);
  });

  it('preserves goal name, target, and saved amount', () => {
    expect(meeraFixture.goal.name).toBe('Education');
    expect(meeraFixture.goal.target).toBe(20000);
    expect(meeraFixture.goal.saved).toBe(8000);
  });

  it('calculates dynamic sum of 5 pots to exactly 18500 without hardcoding 19500', () => {
    const dynamicSum = calculateTotalBalance({
      cash: meeraFixture.cash,
      bank: meeraFixture.bank,
      shg: meeraFixture.shg,
      chit_committed: meeraFixture.chit_committed,
      post_office: meeraFixture.post_office
    });

    expect(dynamicSum).toBe(18500);
    // Discrepancy assertion: Verify it equals the actual mathematical sum (18500), not the narrative 19500
    expect(dynamicSum).not.toBe(19500);
  });
});
