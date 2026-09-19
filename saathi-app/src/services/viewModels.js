/**
 * Pure mappers: Person B API responses -> exactly what the screens render. No React, no network, so they are
 * unit-tested with node. Also the adapters that reshape the bundled sample fixture into the SAME API shapes, so a
 * screen has ONE rendering path whether the data is live or (explicitly, with a banner) offline sample data.
 *
 * Localization:  When a translator function `t` is passed, pot names, statuses, and relative dates are read from
 * i18n keys.  When `t` is omitted (e.g., in unit tests), the English defaults defined below are used unchanged.
 * Numeric amounts and financial calculations are NEVER translated — only display labels.
 */

export const formatINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const num = (v) => Number(v) || 0;

// English defaults — used when `t` is not provided (unit tests).
const POT_LABELS_EN = {
  bank:        { name: 'Bank',        subLabel: 'Bank savings',              status: 'Available' },
  cash:        { name: 'Cash',        subLabel: 'At home or bag',            status: 'In hand' },
  shg:         { name: 'SHG Bachat',  subLabel: 'Self-help group savings',   status: 'Group savings' },
  post_office: { name: 'Post Office', subLabel: 'Post office savings',       status: 'Savings' },
};
const POT_ORDER = ['bank', 'cash', 'shg', 'post_office'];

/** Resolve a translated (or English-default) label for a pot. */
function potLabel(id, t) {
  if (!t) return POT_LABELS_EN[id] || { name: id, subLabel: '', status: '' };
  return {
    name:     t(`pots.${id}.name`,     { defaultValue: (POT_LABELS_EN[id] || {}).name     || id }),
    subLabel: t(`pots.${id}.subLabel`, { defaultValue: (POT_LABELS_EN[id] || {}).subLabel || '' }),
    status:   t(`pots.${id}.status`,   { defaultValue: (POT_LABELS_EN[id] || {}).status   || '' }),
  };
}

/** GET /api/financial-state -> Money Pot Map view model
 * @param {object} state   – raw API response from Person B
 * @param {Function} [t]   – i18next translator (optional; omit in unit tests)
 */
export function buildPotsViewModel(state, t) {
  const pots = state.pots || {};
  const potCards = POT_ORDER.filter((id) => pots[id] !== undefined).map((id) => ({
    id, ...potLabel(id, t), amountNum: num(pots[id]), amount: formatINR(pots[id]),
  }));
  // Person B tracks the business pot separately and leaves it out of total_balance (see Person B potCalculator).
  if (pots.business !== undefined) {
    const biz = t
      ? { name: t('pots.business.name', { defaultValue: 'Business' }), subLabel: t('pots.business.subLabel', { defaultValue: 'Shop and tailoring income' }), status: t('pots.business.status', { defaultValue: 'Tracked separately' }) }
      : { name: 'Business', subLabel: 'Shop and tailoring income', status: 'Tracked separately' };
    potCards.push({ id: 'business', ...biz, amountNum: num(pots.business), amount: formatINR(pots.business) });
  }

  const goal = state.goal
    ? {
        title: state.goal.name, target: num(state.goal.target), saved: num(state.goal.saved),
        remaining: Math.max(0, num(state.goal.target) - num(state.goal.saved)),
        pct: num(state.goal.target) > 0 ? Math.min(100, Math.round((num(state.goal.saved) / num(state.goal.target)) * 100)) : 0,
      }
    : null;
  if (goal) { goal.savedText = formatINR(goal.saved); goal.targetText = formatINR(goal.target); goal.remainingText = formatINR(goal.remaining); }

  const last = state.business && state.business.last_entry;
  // Person B's total_balance leaves the business pot out, but the app shows it as a pot card, so the headline
  // total must be the sum of every pot shown (chit included) or it won't match the cards.
  const total = Object.values(pots).reduce((tot, v) => tot + num(v), 0);

  const chitName   = t ? t('pots.chit.name',   { defaultValue: 'Chit fund' })                             : 'Chit fund';
  const chitStatus = t ? t('pots.chit.status',  { defaultValue: 'Committed: cannot spend it now' })        : 'Committed: cannot spend it now';

  return {
    total,
    totalText: formatINR(total),
    pots: potCards,
    chit: { name: chitName, amountNum: num(pots.chit_committed), amount: formatINR(pots.chit_committed), status: chitStatus },
    goal,
    business: last
      ? { activity: state.business.activity, revenue: formatINR(last.revenue), cost: formatINR(last.cost), profit: formatINR(last.profit) }
      : null,
    recent: (state.recent_transactions || []).slice(0, 10).map((tx) => ({
      id: String(tx.id), text: tx.raw_text, type: tx.tx_type, amount: formatINR(tx.amount), pot: tx.target_pot,
    })),
    updatedAt: state.updated_at || null,
  };
}

/**
 * "Today" / "Yesterday" / "3 days ago" / locale-formatted date.
 * @param {string} iso  – ISO date string
 * @param {Date} now    – current date (injectable for tests)
 * @param {Function} [t] – i18next translator (optional)
 */
export function relativeDate(iso, now = new Date(), t) {
  if (!iso) return ''; // new Date(null) would be 1 Jan 1970
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days <= 0) return t ? t('common.today',     { defaultValue: 'Today' })        : 'Today';
  if (days === 1) return t ? t('common.yesterday', { defaultValue: 'Yesterday' })   : 'Yesterday';
  if (days < 7)  return t ? t('common.daysAgo',   { count: days, defaultValue: `${days} days ago` }) : `${days} days ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * GET /api/ledger -> Business Ledger view model (totals are plain sums of the entries Person B returned).
 * @param {object} ledger  – raw API response from Person B
 * @param {Date} [now]     – current date (injectable for tests)
 * @param {Function} [t]   – i18next translator (optional)
 */
export function buildLedgerViewModel(ledger, now = new Date(), t) {
  const entries = (ledger.entries || []).map((e) => ({
    id: String(e.id), activity: e.activity, revenue: num(e.revenue), cost: num(e.cost), profit: num(e.profit), createdAt: e.created_at,
  }));
  const sum = (key) => entries.reduce((total, e) => total + e[key], 0);
  const businessLedgerLabel = t ? t('ledger.businessLedger', { defaultValue: 'Business ledger' }) : 'Business ledger';
  return {
    hasEntries: entries.length > 0,
    badgeLabel: entries.length ? entries[0].activity : businessLedgerLabel,
    revenue: formatINR(sum('revenue')),
    cost: formatINR(sum('cost')),
    profit: formatINR(sum('profit')),
    profitNum: sum('profit'),
    entries: entries.map((e) => ({
      id: e.id,
      name: e.activity,
      date: relativeDate(e.createdAt, now, t),
      amount: `${e.profit < 0 ? '-' : '+'}${formatINR(Math.abs(e.profit))}`,
      detail: t
        ? t('ledger.detailLine', { rev: formatINR(e.revenue), cost: formatINR(e.cost), defaultValue: `Revenue ${formatINR(e.revenue)} • Cost ${formatINR(e.cost)}` })
        : `Revenue ${formatINR(e.revenue)} • Cost ${formatINR(e.cost)}`,
    })),
  };
}

/** GET /api/goals -> Goals tab view model */
export function buildGoalViewModel(res) {
  const g = res.goal || {};
  const target = num(g.target);
  const saved = num(g.saved);
  const remaining = res.remaining !== undefined ? num(res.remaining) : Math.max(0, target - saved);
  const pct = res.progress_percentage !== undefined ? num(res.progress_percentage) : target > 0 ? Math.round((saved / target) * 100) : 0;
  return {
    name: g.name || 'Goal',
    target, saved, remaining, pct: Math.max(0, Math.min(100, pct)),
    targetText: formatINR(target), savedText: formatINR(saved), remainingText: formatINR(remaining),
    reached: target > 0 && saved >= target,
  };
}

// ── Offline sample data: the bundled fixture reshaped into the API responses above ─────────────────────────────

export function fixtureToFinancialState(fixture) {
  const p = fixture.pots;
  return {
    user_id: 'offline-sample',
    pots: { ...p },
    total_balance: p.cash + p.bank + p.shg + p.chit_committed + p.post_office,
    business: { activity: 'pickle sales + tailoring', last_entry: { revenue: fixture.ledger.summary.revenueNum, cost: fixture.ledger.summary.costNum, profit: fixture.ledger.summary.profitNum } },
    goal: { name: fixture.educationGoal.title, target: fixture.educationGoal.targetAmount, saved: fixture.educationGoal.savedAmount },
    recent_transactions: [],
    updated_at: null,
  };
}

export function fixtureToLedger(fixture) {
  const toNumber = (text) => Number(String(text).replace(/[^0-9.]/g, '')) || 0;
  return {
    user_id: 'offline-sample',
    count: fixture.ledger.recentEntries.length,
    entries: fixture.ledger.recentEntries.map((e) => ({
      id: e.id, activity: e.name, revenue: toNumber(e.amount), cost: 0, profit: toNumber(e.amount), created_at: null,
    })),
  };
}
