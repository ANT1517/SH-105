/**
 * Money Pot Map Calculator and Internal Category-to-Pot Mapper
 * Owned by Person B
 */

const CATEGORY_TO_POT_MAP = {
  // Business / Informal micro-enterprise
  'tailoring': 'business',
  'pickle sales': 'business',
  'pickle': 'business',
  'business': 'business',
  'sales': 'business',
  'shop': 'business',
  'vegetables': 'business',

  // Bank
  'bank': 'bank',
  'bank deposit': 'bank',
  'upi': 'bank',
  'transfer': 'bank',
  'salary': 'bank',

  // SHG (Self-Help Group)
  'shg': 'shg',
  'shg deposit': 'shg',
  'shg contribution': 'shg',
  'bachat gat': 'shg',

  // Chit Fund
  'chit': 'chit_committed',
  'chit fund': 'chit_committed',
  'chit commitment': 'chit_committed',
  'chit installment': 'chit_committed',

  // Post Office (Sukanya / RD / PPF)
  'post office': 'post_office',
  'post_office': 'post_office',
  'sukanya': 'post_office',
  'rd': 'post_office',
  'dak': 'post_office',

  // Cash in hand
  'cash': 'cash',
  'daily cash': 'cash',
  'groceries': 'cash',
  'household': 'cash',
  'personal': 'cash'
};

/**
 * Maps a transaction category to an internal Money Pot.
 * Default is 'cash' if unspecified or unrecognized.
 */
function mapCategoryToPot(category) {
  if (!category || typeof category !== 'string') {
    return 'cash';
  }
  const cleanCategory = category.trim().toLowerCase();
  
  if (CATEGORY_TO_POT_MAP[cleanCategory]) {
    return CATEGORY_TO_POT_MAP[cleanCategory];
  }

  // Substring match heuristic
  for (const [key, pot] of Object.entries(CATEGORY_TO_POT_MAP)) {
    if (cleanCategory.includes(key)) {
      return pot;
    }
  }

  return 'cash';
}

/**
 * Calculates total balance dynamically across the FIVE canonical Money Pot Map pots.
 * Business is a separately-tracked informal ledger pot and is NOT included in this sum.
 * Canonical pots: cash + bank + shg + chit_committed + post_office
 */
function calculateTotalBalance(pots) {
  if (!pots || typeof pots !== 'object') return 0;

  const values = [
    Number(pots.cash) || 0,
    Number(pots.bank) || 0,
    Number(pots.shg) || 0,
    Number(pots.chit_committed) || 0,
    Number(pots.post_office) || 0,
    // NOTE: pots.business is intentionally excluded from this sum.
  ];

  return values.reduce((sum, val) => sum + val, 0);
}

/**
 * Formats unified financial state payload for Person C & D.
 */
function formatUnifiedFinancialState(userData, pots, businessSummary, goal, recentTransactions = []) {
  const potMap = {
    cash: Number(pots.cash) || 0,
    bank: Number(pots.bank) || 0,
    shg: Number(pots.shg) || 0,
    chit_committed: Number(pots.chit_committed) || 0,
    post_office: Number(pots.post_office) || 0
  };

  // If business pot is tracked separately or as ledger
  if (pots.business !== undefined) {
    potMap.business = Number(pots.business) || 0;
  }

  const total = calculateTotalBalance(potMap);

  return {
    user_id: userData.id || userData.user_id || 'meera_001',
    pots: potMap,
    total_balance: total,
    business: businessSummary || {
      activity: "pickle sales + tailoring",
      last_entry: {
        revenue: 0,
        cost: 0,
        profit: 0
      }
    },
    goal: goal || {
      name: "Education",
      target: 20000,
      saved: 8000
    },
    recent_transactions: recentTransactions,
    updated_at: new Date().toISOString(),
    _meta: {
      pots_count: Object.keys(potMap).length,
      discrepancy_note: "Total balance is calculated dynamically from active pot values."
    }
  };
}

module.exports = {
  mapCategoryToPot,
  calculateTotalBalance,
  formatUnifiedFinancialState,
  CATEGORY_TO_POT_MAP
};
