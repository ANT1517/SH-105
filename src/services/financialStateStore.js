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
      // In STRICT_POSTGRES mode: never silently fall back to memory
      if (process.env.STRICT_POSTGRES === 'true') {
        throw new Error(`[Store] PostgreSQL query failed in STRICT_POSTGRES mode: ${err.message}`);
      }
      console.warn('[Store] Falling back to memory store:', err.message);
    }
  }

  // Memory store fallback (only in non-strict / development mode)
  return formatUnifiedFinancialState(
    { user_id: activeUserState.user_id },
    activeUserState.pots,
    activeUserState.business,
    activeUserState.goal,
    activeUserState.transactions.slice(0, 10)
  );
}

/**
 * Syncs a single pot value in memory from the confirmed PostgreSQL result.
 * Called ONLY after a successful database COMMIT — never before.
 * This keeps the memory cache consistent with the real source of truth.
 */
function syncMemoryPotFromDb(potType, confirmedAmount) {
  activeUserState.pots[potType] = Number(confirmedAmount);
}

/**
 * Updates a specific pot balance.
 */
async function updatePotBalance(userId, potType, amountDelta, operation = 'add') {
  const currentAmount = Number(activeUserState.pots[potType]) || 0;
  if (operation === 'subtract' && currentAmount < amountDelta) {
    const err = new Error('Insufficient funds in pot');
    err.status = 400;
    throw err;
  }
  const newAmount = operation === 'subtract' ? currentAmount - amountDelta : currentAmount + amountDelta;
  
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
  const existing = activeUserState.transactions.find(t => t.transaction_hash === txRecord.transaction_hash);
  if (existing) {
    const dupErr = new Error('Duplicate transaction detected in memory store');
    dupErr.isDuplicate = true;
    throw dupErr;
  }
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
 * Synchronizes ledger memory after an atomic DB commit.
 */
function syncLedgerMemory(entry) {
  activeUserState.ledger.unshift(entry);
  activeUserState.business = {
    activity: entry.activity,
    last_entry: {
      revenue: entry.revenue,
      cost: entry.cost,
      profit: entry.profit
    }
  };
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
 * Retrieves the active goal for a user (DB authoritative if connected).
 */
async function getActiveGoal(userId = 'meera_001') {
  if (isConnected()) {
    try {
      const res = await query(
        `SELECT id, user_id, name, target_amount, saved_amount, is_active, created_at, updated_at
         FROM goals
         WHERE user_id = $1 AND is_active = true
         ORDER BY updated_at DESC, id DESC
         LIMIT 1`,
        [userId]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        const goalData = {
          name: row.name,
          target: Number(row.target_amount),
          saved: Number(row.saved_amount)
        };
        // Keep activeUserState.goal in sync
        if (userId === activeUserState.user_id) {
          activeUserState.goal = { ...goalData };
        }
        return goalData;
      }
    } catch (err) {
      if (process.env.STRICT_POSTGRES === 'true') {
        throw new Error(`[Store] PostgreSQL goal query failed in STRICT_POSTGRES mode: ${err.message}`);
      }
      console.warn('[Store] DB goal query fallback:', err.message);
    }
  }
  return activeUserState.goal;
}

/**
 * Creates or resets the active goal for a user.
 * Persists to PostgreSQL goals table and deactivates any previous goals.
 */
async function createGoal(userId, { name, target, saved = 0 }) {
  const goalObj = {
    name: name.trim(),
    target: Number(target),
    saved: Number(saved)
  };

  if (isConnected()) {
    try {
      // Ensure user exists first
      await query(
        `INSERT INTO users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [userId, userId]
      );

      // Deactivate older active goals for this user
      await query(
        `UPDATE goals SET is_active = false, updated_at = NOW() WHERE user_id = $1 AND is_active = true`,
        [userId]
      );

      // Insert the new active goal
      await query(
        `INSERT INTO goals (user_id, name, target_amount, saved_amount, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
        [userId, goalObj.name, goalObj.target, goalObj.saved]
      );
    } catch (err) {
      if (process.env.STRICT_POSTGRES === 'true') {
        throw new Error(`[Store] PostgreSQL goal insert failed in STRICT_POSTGRES mode: ${err.message}`);
      }
      console.warn('[Store] DB goal insert fallback:', err.message);
    }
  }

  // Update in-memory state
  if (userId === activeUserState.user_id) {
    activeUserState.goal = { ...goalObj };
  }

  return goalObj;
}

/**
 * Updates goal progress.
 */
async function updateGoalProgress(userId, savedDelta, targetAmount = null) {
  let currentTarget = Number(activeUserState.goal.target) || 0;
  let currentSaved = Number(activeUserState.goal.saved) || 0;

  if (isConnected()) {
    try {
      // Ensure user exists first
      await query(
        `INSERT INTO users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [userId, userId]
      );

      // Look up current active goal in DB first
      const existing = await query(
        `SELECT id, name, target_amount, saved_amount
         FROM goals
         WHERE user_id = $1 AND is_active = true
         ORDER BY updated_at DESC, id DESC
         LIMIT 1`,
        [userId]
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        const newSaved = Number(row.saved_amount) + Number(savedDelta);
        const newTarget = targetAmount !== null ? Number(targetAmount) : Number(row.target_amount);

        await query(
          `UPDATE goals
           SET saved_amount = $1, target_amount = $2, updated_at = NOW()
           WHERE id = $3`,
          [newSaved, newTarget, row.id]
        );

        const updated = {
          name: row.name,
          target: newTarget,
          saved: newSaved
        };

        if (userId === activeUserState.user_id) {
          activeUserState.goal = { ...updated };
        }

        return updated;
      } else {
        // If no active goal in DB, create one from in-memory fallback + delta
        const newSaved = currentSaved + Number(savedDelta);
        const newTarget = targetAmount !== null ? Number(targetAmount) : currentTarget;
        const name = activeUserState.goal.name || 'Savings Goal';

        await query(
          `INSERT INTO goals (user_id, name, target_amount, saved_amount, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
          [userId, name, newTarget, newSaved]
        );

        const updated = {
          name,
          target: newTarget,
          saved: newSaved
        };

        if (userId === activeUserState.user_id) {
          activeUserState.goal = { ...updated };
        }

        return updated;
      }
    } catch (err) {
      if (process.env.STRICT_POSTGRES === 'true') {
        throw new Error(`[Store] PostgreSQL goal update failed in STRICT_POSTGRES mode: ${err.message}`);
      }
      console.warn('[Store] DB goal update fallback:', err.message);
    }
  }

  // In-memory update fallback
  const newSaved = currentSaved + Number(savedDelta);
  if (targetAmount) {
    activeUserState.goal.target = Number(targetAmount);
  }
  activeUserState.goal.saved = newSaved;

  return activeUserState.goal;
}

/**
 * Synchronizes goal memory after an atomic DB commit.
 */
function syncGoalMemory(goal) {
  activeUserState.goal = {
    name: goal.name,
    target: goal.target,
    saved: goal.saved
  };
}

module.exports = {
  getFinancialState,
  updatePotBalance,
  addTransaction,
  addLedgerEntry,
  getLedgerEntries,
  getActiveGoal,
  createGoal,
  updateGoalProgress,
  resetState,
  syncMemoryPotFromDb,
  syncLedgerMemory,
  syncGoalMemory,
  activeUserState
};
