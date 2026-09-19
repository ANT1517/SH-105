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

/**
 * The confirmation Meera sees, built ONLY from what Person B says it recorded.
 * If a translator `t` is provided the string is fully localized; otherwise English fallback is used.
 * Financial values (amount, category, pot name) are NEVER translated — only the surrounding phrase.
 *
 * @param {object} body  – Person B's POST /api/transactions response body
 * @param {Function} [t] – i18next translator (optional)
 */
export function describeRecorded(body, t) {
  const tx = body.transaction;
  if (!t) {
    // English fallback (used in unit tests or if called before i18next is ready)
    return `Recorded: ${tx.tx_type} of ${money(tx.amount)} (${tx.category}) in your ${body.pot_affected} pot.`;
  }
  const typeKey = `transactions.type.${tx.tx_type}`;
  const localizedType = t(typeKey, { defaultValue: tx.tx_type });
  const potKey = `pots.${body.pot_affected}.name`;
  const localizedPot = t(potKey, { defaultValue: body.pot_affected });
  return t('transactions.recorded', {
    amount: Number(tx.amount).toLocaleString('en-IN'),
    type: localizedType,
    category: tx.category,
    pot: localizedPot,
    defaultValue: `Recorded: ${localizedType} of ${money(tx.amount)} (${tx.category}) in your ${localizedPot} pot.`,
  });
}

/**
 * POST /api/transactions with a normalized-input object (contracts/normalized-input.schema.json shape).
 * @param {object} normalizedInput – NLP output (tx_type, amount, category, etc.)
 * @param {object} [opts]          – { t: Function } optional translator for localized confirmation
 * @returns {Promise<{status: 'recorded'|'duplicate', confirmation: string, response: object}>}
 * Rejections (400 validation / insufficient funds, 404/422 unknown user or phone) throw an ApiError whose
 * message is Person B's own error text.
 */
export async function recordTransaction(normalizedInput, { t } = {}) {
  const { status, body } = await requestJson(`${getPersonBApiUrl()}/api/transactions`, {
    method: 'POST',
    body: normalizedInput,
    okStatuses: [409],
  });
  if (status === 409) {
    const dupMsg = t
      ? t('transactions.duplicate', { defaultValue: 'Already recorded this one — not added again.' })
      : 'I already recorded this one, so I did not add it again.';
    return { status: 'duplicate', confirmation: dupMsg, response: body };
  }
  return { status: 'recorded', confirmation: describeRecorded(body, t), response: body };
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
