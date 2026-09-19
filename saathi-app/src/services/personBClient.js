/**
 * Person B (financial memory) client: the single source of truth for pots, ledger, goals and transactions.
 */
import { getPersonBApiUrl, getUserId } from './apiConfig.js';
import { requestJson } from './http.js';

const withUser = (path, userId) => `${getPersonBApiUrl()}${path}?user_id=${encodeURIComponent(userId)}`;

/** GET /api/financial-state -> { user_id, pots, total_balance, business, goal, recent_transactions, updated_at } */
export async function getFinancialState(userId = getUserId()) {
  return (await requestJson(withUser('/api/financial-state', userId))).body;
}

/** GET /api/ledger -> { user_id, count, entries: [{ id, activity, revenue, cost, profit, notes, created_at }] } */
export async function getLedger(userId = getUserId()) {
  return (await requestJson(withUser('/api/ledger', userId))).body;
}

/** GET /api/goals -> { user_id, goal: { name, target, saved }, remaining, progress_percentage } */
export async function getGoals(userId = getUserId()) {
  return (await requestJson(withUser('/api/goals', userId))).body;
}

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

/** The confirmation Meera sees, built ONLY from what Person B says it recorded. */
export function describeRecorded(body) {
  const tx = body.transaction;
  return `Recorded: ${tx.tx_type} of ${money(tx.amount)} (${tx.category}) in your ${body.pot_affected} pot.`;
}

/**
 * POST /api/transactions with a normalized-input object (contracts/normalized-input.schema.json shape).
 * @returns {Promise<{status: 'recorded'|'duplicate', confirmation: string, response: object}>}
 * Rejections (400 validation / insufficient funds, 404/422 unknown user or phone) throw an ApiError whose
 * message is Person B's own error text.
 */
export async function recordTransaction(normalizedInput) {
  const { status, body } = await requestJson(`${getPersonBApiUrl()}/api/transactions`, {
    method: 'POST',
    body: normalizedInput,
    okStatuses: [409],
  });
  if (status === 409) {
    return { status: 'duplicate', confirmation: 'I already recorded this one, so I did not add it again.', response: body };
  }
  return { status: 'recorded', confirmation: describeRecorded(body), response: body };
}

/** POST /api/ledger: a manual Khata entry. Person B credits the business pot with any profit. */
export async function addLedgerEntry({ activity, revenue, cost, notes }, userId = getUserId()) {
  return (await requestJson(`${getPersonBApiUrl()}/api/ledger`, {
    method: 'POST',
    body: { user_id: userId, activity, revenue, cost, notes },
  })).body;
}

/** POST /api/goals: makes this the active goal (Person B keeps one active goal and deactivates the previous). */
export async function createGoal({ name, target_amount, saved_amount }, userId = getUserId()) {
  return (await requestJson(`${getPersonBApiUrl()}/api/goals`, {
    method: 'POST',
    body: { user_id: userId, name, target_amount, saved_amount },
  })).body;
}

/** GET /api/transactions -> { count, transactions: [{ id, tx_type, amount, category, target_pot, raw_text, created_at }] } */
export async function getTransactions(userId = getUserId()) {
  return (await requestJson(withUser('/api/transactions', userId))).body;
}
