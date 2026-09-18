const {
  mapCategoryToPot,
  calculateTotalBalance,
  formatUnifiedFinancialState,
  CATEGORY_TO_POT_MAP
} = require('../../src/services/potCalculator');

describe('Unit: Pot Calculator & Category-to-Pot Mapping', () => {
  describe('Category to Pot Mapping', () => {
    it('maps tailoring to business pot', () => {
      expect(mapCategoryToPot('tailoring')).toBe('business');
      expect(mapCategoryToPot('Tailoring Work')).toBe('business');
      expect(mapCategoryToPot('  TAILORING  ')).toBe('business');
    });

    it('maps pickle sales to business pot', () => {
      expect(mapCategoryToPot('pickle sales')).toBe('business');
      expect(mapCategoryToPot('pickle')).toBe('business');
    });

    it('maps bank deposit and transfer to bank pot', () => {
      expect(mapCategoryToPot('bank deposit')).toBe('bank');
      expect(mapCategoryToPot('bank')).toBe('bank');
      expect(mapCategoryToPot('transfer')).toBe('bank');
      expect(mapCategoryToPot('upi')).toBe('bank');
    });

    it('maps SHG contributions to shg pot', () => {
      expect(mapCategoryToPot('shg contribution')).toBe('shg');
      expect(mapCategoryToPot('shg deposit')).toBe('shg');
      expect(mapCategoryToPot('bachat gat')).toBe('shg');
    });

    it('maps chit fund installments to chit_committed pot', () => {
      expect(mapCategoryToPot('chit')).toBe('chit_committed');
      expect(mapCategoryToPot('chit fund')).toBe('chit_committed');
      expect(mapCategoryToPot('chit installment')).toBe('chit_committed');
    });

    it('maps post office savings to post_office pot', () => {
      expect(mapCategoryToPot('post office')).toBe('post_office');
      expect(mapCategoryToPot('sukanya')).toBe('post_office');
      expect(mapCategoryToPot('rd')).toBe('post_office');
      expect(mapCategoryToPot('dak')).toBe('post_office');
    });

    it('maps cash-related and household to cash pot', () => {
      expect(mapCategoryToPot('cash')).toBe('cash');
      expect(mapCategoryToPot('daily cash')).toBe('cash');
      expect(mapCategoryToPot('groceries')).toBe('cash');
    });

    it('deterministically maps unknown categories to cash fallback without throwing', () => {
      expect(mapCategoryToPot('astronomy')).toBe('cash');
      expect(mapCategoryToPot('unknown_xyz')).toBe('cash');
      expect(mapCategoryToPot('')).toBe('cash');
      expect(mapCategoryToPot(null)).toBe('cash');
      expect(mapCategoryToPot(undefined)).toBe('cash');
    });
  });

  describe('Dynamic Total Balance Calculation', () => {
    it('calculates dynamic sum of 5 pots accurately', () => {
      const pots = {
        cash: 2000,
        bank: 5000,
        shg: 2500,
        chit_committed: 4000,
        post_office: 5000
      };
      expect(calculateTotalBalance(pots)).toBe(18500);
    });

    it('handles zero balances and missing pot values gracefully', () => {
      expect(calculateTotalBalance({})).toBe(0);
      expect(calculateTotalBalance({ cash: 500 })).toBe(500);
      expect(calculateTotalBalance({ cash: '500', bank: '1000' })).toBe(1500);
      expect(calculateTotalBalance(null)).toBe(0);
    });
  });

  describe('Format Unified Financial State', () => {
    it('formats valid unified state payload for Person C & D', () => {
      const formatted = formatUnifiedFinancialState(
        { user_id: 'meera_001' },
        { cash: 2000, bank: 5000, shg: 2500, chit_committed: 4000, post_office: 5000 },
        { activity: 'pickle sales', last_entry: { revenue: 1000, cost: 600, profit: 400 } },
        { name: 'Education', target: 20000, saved: 8000 },
        []
      );

      expect(formatted.user_id).toBe('meera_001');
      expect(formatted.pots.cash).toBe(2000);
      expect(formatted.total_balance).toBe(18500);
      expect(formatted.business.last_entry.profit).toBe(400);
      expect(formatted.goal.name).toBe('Education');
    });
  });
});
