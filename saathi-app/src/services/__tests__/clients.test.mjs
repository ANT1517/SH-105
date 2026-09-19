import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getFinancialState, getGoals, getLedger, recordTransaction } from '../personBClient.js';
import { checkSafety, getGuidance } from '../personCClient.js';
import { ApiError } from '../http.js';
import { installFetch, LIVE_STATE, RECORDED_RESPONSE, withEnv } from './helpers.mjs';

let fetchStub;
afterEach(() => fetchStub && fetchStub.restore());

const ENV = { EXPO_PUBLIC_PERSON_B_API_URL: 'http://b.test:5000', EXPO_PUBLIC_PERSON_C_API_URL: 'http://c.test:8000', EXPO_PUBLIC_USER_ID: 'meera_001' };

describe('Person B client', () => {
  test('reads state, ledger and goals from the configured base URL for the configured user', () =>
    withEnv(ENV, async () => {
      fetchStub = installFetch({
        'GET /api/financial-state': LIVE_STATE,
        'GET /api/ledger': { user_id: 'meera_001', count: 0, entries: [] },
        'GET /api/goals': { user_id: 'meera_001', goal: { name: 'Education', target: 20000, saved: 8000 }, remaining: 12000, progress_percentage: 40 },
      });
      assert.equal((await getFinancialState()).total_balance, 18500);
      assert.equal((await getLedger()).count, 0);
      assert.equal((await getGoals()).remaining, 12000);
      assert.deepEqual(fetchStub.calls.map((c) => [c.origin, c.key, c.query.user_id]), [
        ['http://b.test:5000', 'GET /api/financial-state', 'meera_001'],
        ['http://b.test:5000', 'GET /api/ledger', 'meera_001'],
        ['http://b.test:5000', 'GET /api/goals', 'meera_001'],
      ]);
    }));

  test('a 404 unknown_user surfaces as an ApiError with Person B\'s own message (not swallowed)', () =>
    withEnv(ENV, async () => {
      fetchStub = installFetch({ 'GET /api/financial-state': [{ error: 'unknown_user', message: 'No financial state exists for user_id "x"' }, 404] });
      await assert.rejects(getFinancialState('x'), (e) => e instanceof ApiError && e.status === 404 && /unknown_user/.test(e.message) && !e.isNetworkError);
    }));

  test('network failure is flagged isNetworkError', () =>
    withEnv(ENV, async () => {
      fetchStub = installFetch({ 'GET /api/financial-state': new Error('ECONNREFUSED') });
      await assert.rejects(getFinancialState(), (e) => e instanceof ApiError && e.isNetworkError === true);
    }));

  test('recordTransaction posts the normalized input and the confirmation comes only from Person B\'s response', () =>
    withEnv(ENV, async () => {
      fetchStub = installFetch({ 'POST /api/transactions': [RECORDED_RESPONSE, 201] });
      const payload = { user_id: 'meera_001', channel: 'react_native_chat', input_type: 'text', raw_text: 'x', normalized_text: 'x', parsed_transaction: { type: 'income', amount: 800, category: 'tailoring' }, confidence: 0.97 };
      const result = await recordTransaction(payload);
      assert.equal(result.status, 'recorded');
      assert.equal(result.confirmation, 'Recorded: income of ₹800 (tailoring) in your business pot.');
      assert.deepEqual(fetchStub.calls[0].body, payload);
      assert.equal(fetchStub.calls[0].origin, 'http://b.test:5000');
    }));

  test('duplicate (409) and rejections (400 insufficient funds) are distinguished', () =>
    withEnv(ENV, async () => {
      fetchStub = installFetch({ 'POST /api/transactions': [{ status: 'duplicate' }, 409] });
      assert.equal((await recordTransaction({})).status, 'duplicate');
      fetchStub.restore();
      fetchStub = installFetch({ 'POST /api/transactions': [{ error: 'Insufficient funds in pot' }, 400] });
      await assert.rejects(recordTransaction({}), (e) => e.status === 400 && e.message === 'Insufficient funds in pot');
    }));
});

describe('Person C client', () => {
  test('guidance posts the question for the user in personalized mode and returns Person C\'s text', () =>
    withEnv(ENV, async () => {
      fetchStub = installFetch({ 'POST /api/v1/integration/person_a/guidance': { response_text: 'Person C says hi', source_class: 'SEBI', mode: 'personalized', disclaimer: true } });
      const r = await getGuidance({ question: 'how can I reach my goal?' });
      assert.deepEqual(r, { text: 'Person C says hi', sourceClass: 'SEBI', mode: 'personalized' });
      assert.deepEqual(fetchStub.calls[0].body, { user_id: 'meera_001', question: 'how can I reach my goal?', request_mode: 'personalized' });
      assert.equal(fetchStub.calls[0].origin, 'http://c.test:8000');
    }));

  test('safety check posts the message and returns Person C\'s explanation', () =>
    withEnv(ENV, async () => {
      fetchStub = installFetch({ 'POST /api/v1/safety/check': { response_text: 'This looks suspicious.', source_class: 'system', mode: 'safety', disclaimer: true } });
      const r = await checkSafety({ message: 'Your KYC will expire, click to verify' });
      assert.equal(r.text, 'This looks suspicious.');
      assert.deepEqual(fetchStub.calls[0].body, { user_id: 'meera_001', message: 'Your KYC will expire, click to verify' });
    }));

  test('FastAPI-style {detail} errors and outages become ApiErrors', () =>
    withEnv(ENV, async () => {
      fetchStub = installFetch({ 'POST /api/v1/safety/check': [{ detail: 'boom' }, 500] });
      await assert.rejects(checkSafety({ message: 'x' }), (e) => e.status === 500 && e.message === 'boom');
      fetchStub.restore();
      fetchStub = installFetch({ 'POST /api/v1/safety/check': new Error('down') });
      await assert.rejects(checkSafety({ message: 'x' }), (e) => e.isNetworkError === true);
    }));
});
