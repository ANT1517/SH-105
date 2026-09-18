/**
 * Financial State Store
 * Manages Pots, Ledger, Goals, and Transactions across PostgreSQL and in-memory cache.
 * Owned by Person B
 */

const { query, isConnected } = require('../db/db');
const meeraFixture = require('../fixtures/meeraFixture.json');
const { formatUnifiedFinancialState, calculateTotalBalance } = require('./potCalculator');

// Active store in memory (initialized with exact Meera fixture values)
let activeUserState = {
  user_id: meeraFixture.user_id,
  pots: {
    cash: meeraFixture.cash,
    bank: meeraFixture.bank,
    shg: meeraFixture.shg,
    chit_committed: meeraFixture.chit_committed,
    post_office: meeraFixture.post_office,
    business: 0
  },
  business: { ...meeraFixture.business },
  goal: { ...meeraFixture.goal },
  transactions: [],
  ledger: [
    {
      id: 1,
      activity: "pickle sales + tailoring",
      revenue: meeraFixture.business.last_entry.revenue,
      cost: meeraFixture.business.last_entry.cost,
      profit: meeraFixture.business.last_entry.profit,
      created_at: new Date().toISOString()
    }
  ]
};

/**
 * Resets user state to Meera's demo fixture baseline.
 */
function resetState() {
  activeUserState = {
    user_id: meeraFixture.user_id,
    pots: {
      cash: meeraFixture.cash,
      bank: meeraFixture.bank,
      shg: meeraFixture.shg,
      chit_committed: meeraFixture.chit_committed,
      post_office: meeraFixture.post_office,
      business: 0
    },
    business: { ...meeraFixture.business },
    goal: { ...meeraFixture.goal },
    transactions: [],
    ledger: [
      {
        id: 1,
        activity: "pickle sales + tailoring",
        revenue: meeraFixture.business.last_entry.revenue,
        cost: meeraFixture.business.last_entry.cost,
        profit: meeraFixture.business.last_entry.profit,
        created_at: new Date().toISOString()
      }
    ]
  };
}

/**
 * Retrieves the current financial state for a user.
 */
async function getFinancialState(userId = 'meera_001') {
  if (isConnected()) {
    try {
      // Query PostgreSQL
      const potsRes = await query('SELECT pot_type, amount FROM pots WHERE user_id = $1', [userId]);
      const ledgerRes = await query('SELECT * FROM ledger_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
      const goalRes = await query('SELECT name, target_amount, saved_amount FROM goals WHERE user_id = $1 AND is_active = true LIMIT 1', [userId]);
      const txRes = await query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [userId]);

      if (potsRes.rows.length > 0) {
        const potsMap = {};
        potsRes.rows.forEach(r => {
          potsMap[r.pot_type] = Number(r.amount);
        });

        const businessData = ledgerRes.rows[0] ? {
          activity: ledgerRes.rows[0].activity,
          last_entry: {
            revenue: Number(ledgerRes.rows[0].revenue),
            cost: Number(ledgerRes.rows[0].cost),
            profit: Number(ledgerRes.rows[0].profit)
          }
        } : activeUserState.business;

        const goalData = goalRes.rows[0] ? {
          name: goalRes.rows[0].name,
          target: Number(goalRes.rows[0].target_amount),
          saved: Number(goalRes.rows[0].saved_amount)
        } : activeUserState.goal;

        return formatUnifiedFinancialState(
          { user_id: userId },
          potsMap,
          businessData,
          goalData,
          txRes.rows
        );
      }
    } catch (err) {
      console.warn('[Store] Falling back to memory store:', err.message);
    }
  }

  // Memory store fallback
  return formatUnifiedFinancialState(
    { user_id: activeUserState.user_id },
    activeUserState.pots,
    activeUserState.business,
    activeUserState.goal,
    activeUserState.transactions.slice(0, 10)
  );
}

/**
 * Updates a specific pot balance.
 */
async function updatePotBalance(userId, potType, amountDelta, operation = 'add') {
  const currentAmount = Number(activeUserState.pots[potType]) || 0;
  const newAmount = operation === 'subtract' ? Math.max(0, currentAmount - amountDelta) : currentAmount + amountDelta;
  
  activeUserState.pots[potType] = newAmount;

  if (isConnected()) {
    try {
      await query(
        `INSERT INTO pots (user_id, pot_type, amount, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, pot_type)
         DO UPDATE SET amount = $3, updated_at = NOW()`,
        [userId, potType, newAmount]
      );
    } catch (err) {
      console.warn('[Store] DB pot update failed:', err.message);
    }
  }

  return { potType, previousAmount: currentAmount, newAmount };
}

/**
 * Adds a new transaction.
 */
async function addTransaction(txRecord) {
  activeUserState.transactions.unshift(txRecord);

  if (isConnected()) {
    try {
      await query(
        `INSERT INTO transactions (transaction_hash, user_id, channel, input_type, raw_text, normalized_text, tx_type, amount, category, target_pot, confidence, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          txRecord.transaction_hash,
          txRecord.user_id,
          txRecord.channel,
          txRecord.input_type,
          txRecord.raw_text,
          txRecord.normalized_text,
          txRecord.tx_type,
          txRecord.amount,
          txRecord.category,
          txRecord.target_pot,
          txRecord.confidence,
          txRecord.created_at
        ]
      );
    } catch (err) {
      console.warn('[Store] DB transaction insert failed:', err.message);
    }
  }

  return txRecord;
}

/**
 * Adds an informal business ledger entry.
 */
async function addLedgerEntry(userId, { activity, revenue, cost, notes }) {
  const rev = Number(revenue) || 0;
  const cst = Number(cost) || 0;
  const profit = rev - cst;

  const entry = {
    id: activeUserState.ledger.length + 1,
    user_id: userId,
    activity: activity || "pickle sales + tailoring",
    revenue: rev,
    cost: cst,
    profit,
    notes: notes || null,
    created_at: new Date().toISOString()
  };

  activeUserState.ledger.unshift(entry);
  activeUserState.business = {
    activity: entry.activity,
    last_entry: {
      revenue: rev,
      cost: cst,
      profit
    }
  };

  // Update business pot by profit amount
  if (profit > 0) {
    await updatePotBalance(userId, 'business', profit, 'add');
  }

  if (isConnected()) {
    try {
      await query(
        `INSERT INTO ledger_entries (user_id, activity, revenue, cost, profit, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, entry.activity, rev, cst, profit, entry.notes, entry.created_at]
      );
    } catch (err) {
      console.warn('[Store] DB ledger entry failed:', err.message);
    }
  }

  return entry;
}

/**
 * Retrieves ledger entries.
 */
async function getLedgerEntries(userId) {
  if (isConnected()) {
    try {
      const res = await query('SELECT * FROM ledger_entries WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      if (res.rows.length > 0) return res.rows;
    } catch (err) {
      console.warn('[Store] DB ledger query fallback:', err.message);
    }
  }
  return activeUserState.ledger;
}

/**
 * Updates goal progress.
 */
async function updateGoalProgress(userId, savedDelta, targetAmount = null) {
  const currentSaved = Number(activeUserState.goal.saved) || 0;
  const newSaved = currentSaved + Number(savedDelta);
  
  if (targetAmount) {
    activeUserState.goal.target = Number(targetAmount);
  }
  activeUserState.goal.saved = newSaved;

  if (isConnected()) {
    try {
      await query(
        `UPDATE goals SET saved_amount = $1, target_amount = COALESCE($2, target_amount), updated_at = NOW() WHERE user_id = $3 AND is_active = true`,
        [newSaved, targetAmount, userId]
      );
    } catch (err) {
      console.warn('[Store] DB goal update failed:', err.message);
    }
  }

  return activeUserState.goal;
}

module.exports = {
  getFinancialState,
  updatePotBalance,
  addTransaction,
  addLedgerEntry,
  getLedgerEntries,
  updateGoalProgress,
  resetState,
  activeUserState
};
