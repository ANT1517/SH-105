import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildGoalViewModel, buildLedgerViewModel, buildPotsViewModel, fixtureToFinancialState, fixtureToLedger, formatINR, relativeDate } from '../viewModels.js';
import { loadWithFallback } from '../liveData.js';
import { MEERA_FIXTURE } from '../../api/fixture.js';
import { LIVE_STATE } from './helpers.mjs';

describe('Money Pot Map view model (from GET /api/financial-state)', () => {
  test('shows Person B\'s balances, total and goal', () => {
    const vm = buildPotsViewModel(LIVE_STATE);
    assert.equal(vm.totalText, '₹18,500');
    assert.deepEqual(vm.pots.map((p) => [p.id, p.amountNum]), [['bank', 5000], ['cash', 2000], ['shg', 2500], ['post_office', 5000]]);
    assert.equal(vm.chit.amount, '₹4,000');
    assert.deepEqual([vm.goal.saved, vm.goal.target, vm.goal.remaining, vm.goal.pct], [8000, 20000, 12000, 40]);
    assert.deepEqual(vm.business, { activity: 'pickle sales + tailoring', revenue: '₹1,000', cost: '₹600', profit: '₹400' });
  });

  test('different live numbers produce different output (nothing is hardcoded)', () => {
    const vm = buildPotsViewModel({ ...LIVE_STATE, pots: { cash: 1, bank: 2, shg: 3, chit_committed: 4, post_office: 5, business: 800 }, total_balance: 15, goal: { name: 'Bike', target: 100, saved: 100 } });
    assert.equal(vm.totalText, '₹815'); // sum of every pot shown, business included
    assert.equal(vm.chit.amount, '₹4');
    assert.equal(vm.pots.find((p) => p.id === 'business').amount, '₹800'); // business pot shown when present
    assert.equal(vm.goal.pct, 100);
    assert.equal(vm.goal.title, 'Bike');
  });

  test('missing goal / business degrade to null instead of throwing', () => {
    const vm = buildPotsViewModel({ user_id: 'x', pots: { cash: 0 }, total_balance: 0 });
    assert.equal(vm.goal, null);
    assert.equal(vm.business, null);
    assert.equal(vm.totalText, '₹0');
  });
});

describe('Business Ledger view model (from GET /api/ledger)', () => {
  const now = new Date('2026-09-19T12:00:00');
  test('sums and lists the entries Person B returned (DB rows carry numbers as strings)', () => {
    const vm = buildLedgerViewModel({ entries: [
      { id: 2, activity: 'tailoring', revenue: '800.00', cost: '0.00', profit: '800.00', created_at: '2026-09-19T08:00:00' },
      { id: 1, activity: 'pickle sales', revenue: '1000.00', cost: '600.00', profit: '400.00', created_at: '2026-09-18T20:00:00' },
    ] }, now);
    assert.equal(vm.hasEntries, true);
    assert.equal(vm.revenue, '₹1,800');
    assert.equal(vm.cost, '₹600');
    assert.equal(vm.profit, '₹1,200');
    assert.equal(vm.badgeLabel, 'tailoring');
    assert.deepEqual(vm.entries.map((e) => [e.name, e.date, e.amount]), [['tailoring', 'Today', '+₹800'], ['pickle sales', 'Yesterday', '+₹400']]);
    assert.equal(vm.entries[1].detail, 'Revenue ₹1,000 • Cost ₹600');
  });

  test('an empty ledger is an empty state, and a loss shows a minus sign', () => {
    assert.equal(buildLedgerViewModel({ entries: [] }).hasEntries, false);
    assert.equal(buildLedgerViewModel({ entries: [{ id: 1, activity: 'x', revenue: 100, cost: 300, profit: -200, created_at: null }] }).entries[0].amount, '-₹200');
  });

  test('relativeDate', () => {
    assert.equal(relativeDate('2026-09-19T01:00:00', now), 'Today');
    assert.equal(relativeDate('2026-09-18T23:00:00', now), 'Yesterday');
    assert.equal(relativeDate('2026-09-16T10:00:00', now), '3 days ago');
    assert.equal(relativeDate(null, now), '');
  });
});

describe('Goals view model (from GET /api/goals)', () => {
  test('uses Person B\'s goal, remaining and percentage', () => {
    const vm = buildGoalViewModel({ goal: { name: 'Education', target: 20000, saved: 8000 }, remaining: 12000, progress_percentage: 40 });
    assert.deepEqual([vm.name, vm.savedText, vm.targetText, vm.remainingText, vm.pct, vm.reached], ['Education', '₹8,000', '₹20,000', '₹12,000', 40, false]);
  });
  test('reached goal and a target of zero are handled', () => {
    assert.equal(buildGoalViewModel({ goal: { name: 'x', target: 100, saved: 150 }, remaining: 0, progress_percentage: 150 }).pct, 100);
    assert.equal(buildGoalViewModel({ goal: { name: 'x', target: 100, saved: 150 } }).reached, true);
    assert.equal(buildGoalViewModel({ goal: { name: 'x', target: 0, saved: 0 } }).pct, 0);
  });
});

describe('explicit offline fallback (fixture) uses the same rendering path', () => {
  test('fixture is reshaped into the API shapes and renders through the same builders', () => {
    const vm = buildPotsViewModel(fixtureToFinancialState(MEERA_FIXTURE));
    assert.equal(vm.totalText, '₹18,500');
    assert.equal(vm.goal.pct, 40);
    const lv = buildLedgerViewModel(fixtureToLedger(MEERA_FIXTURE));
    assert.equal(lv.hasEntries, true);
  });

  test('loadWithFallback: live wins; on failure fallback is flagged "offline"; without a fallback the error is surfaced', async () => {
    const live = await loadWithFallback(async () => 'LIVE', () => 'SAMPLE');
    assert.deepEqual([live.status, live.data], ['live', 'LIVE']);

    const boom = new Error('unreachable');
    const off = await loadWithFallback(async () => { throw boom; }, () => 'SAMPLE');
    assert.deepEqual([off.status, off.data, off.error], ['offline', 'SAMPLE', boom]);

    const err = await loadWithFallback(async () => { throw boom; });
    assert.deepEqual([err.status, err.data, err.error], ['error', null, boom]);
  });

  test('formatINR', () => {
    assert.equal(formatINR(1234567), '₹12,34,567'); // Indian digit grouping
    assert.equal(formatINR(undefined), '₹0');
  });
});
