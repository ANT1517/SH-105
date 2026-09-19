import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { FAILURE_TEXT, handleUserMessage } from '../messageRouter.js';
import { ApiError } from '../http.js';
import { installFetch, RECORDED_RESPONSE, withEnv } from './helpers.mjs';

const USER = 'test_user_router';

// Injected fakes that record who was called. Every fake returns a unique sentinel so we can prove that the text
// shown to the user comes from the right service and is never made up by the router.
function fakes(overrides = {}) {
  const calls = { understand: 0, record: [], guidance: [], safety: [] };
  const deps = {
    understand: async () => { calls.understand += 1; return { intent: 'unknown', transaction: null, language: 'en', confidence: 0.9, reply_text: '' }; },
    record: async (payload) => { calls.record.push(payload); return { status: 'recorded', confirmation: 'PERSON-B-CONFIRMATION', response: RECORDED_RESPONSE }; },
    guidance: async (arg) => { calls.guidance.push(arg); return { text: 'PERSON-C-GUIDANCE', sourceClass: 'SEBI', mode: 'personalized' }; },
    safety: async (arg) => { calls.safety.push(arg); return { text: 'PERSON-C-SAFETY', sourceClass: 'system', mode: 'safety' }; },
    ...overrides,
  };
  return { deps, calls };
}

const nlpIncome = (over = {}) => async () => ({
  intent: 'record_income', transaction: { type: 'income', amount: 800, category: 'tailoring' }, language: 'en', confidence: 0.97, reply_text: '', ...over,
});

describe('safety check runs FIRST (before the transaction path)', () => {
  test('"paid 500 to verify your KYC now" looks like a transaction but goes to safety, never to Person B or NLP', async () => {
    const { deps, calls } = fakes({ understand: nlpIncome({ intent: 'record_expense', transaction: { type: 'expense', amount: 500, category: 'expense' } }) });
    const r = await handleUserMessage('paid 500 to verify your KYC now', { userId: USER, deps });
    assert.equal(r.kind, 'safety');
    assert.equal(r.text, 'PERSON-C-SAFETY');
    assert.equal(calls.record.length, 0, 'a scam must never be recorded as a transaction');
    assert.equal(calls.guidance.length, 0);
    assert.deepEqual(calls.safety, [{ message: 'paid 500 to verify your KYC now', userId: USER }]);
  });

  test('the exact masterplan KYC message is flagged and never reaches Person B', async () => {
    const { deps, calls } = fakes();
    const r = await handleUserMessage('Your KYC will expire, click to verify', { userId: USER, deps });
    assert.equal(r.kind, 'safety');
    assert.equal(calls.record.length, 0);
    assert.equal(calls.safety.length, 1);
  });

  test('when the model classifies a message as safety_check (heuristic missed it) it still goes to Person C safety', async () => {
    const { deps, calls } = fakes({ understand: async () => ({ intent: 'safety_check', transaction: null, language: 'en', confidence: 0.9, reply_text: '' }) });
    const r = await handleUserMessage('a strange message from the bank about my card', { userId: USER, deps });
    assert.equal(r.kind, 'safety');
    assert.equal(r.text, 'PERSON-C-SAFETY');
    assert.equal(calls.record.length, 0);
  });
});

describe('transactions go to Person B and the reply is Person B\'s confirmation', () => {
  test('"I earned 800 from tailoring today" -> POST to Person B with a normalized-input payload', async () => {
    const { deps, calls } = fakes({ understand: nlpIncome() });
    const r = await handleUserMessage('I earned 800 from tailoring today', { userId: USER, deps });
    assert.equal(r.kind, 'recorded');
    assert.equal(r.text, 'PERSON-B-CONFIRMATION');
    assert.deepEqual(calls.record[0], {
      user_id: USER,
      channel: 'react_native_chat', // never "whatsapp"
      input_type: 'text',
      raw_text: 'I earned 800 from tailoring today',
      normalized_text: 'I earned 800 from tailoring today',
      parsed_transaction: { type: 'income', amount: 800, category: 'tailoring' },
      confidence: 0.97,
    });
    assert.equal(calls.guidance.length, 0);
    assert.deepEqual(r.recorded, { type: 'income', amount: 800, category: 'tailoring', pot: 'business', totalBalance: 18500 });
  });

  test('end to end with the real Person B client: the confirmation text is built from Person B\'s response', () =>
    withEnv({ EXPO_PUBLIC_PERSON_B_API_URL: 'http://b.test:5000' }, async () => {
      const stub = installFetch({ 'POST /api/transactions': [RECORDED_RESPONSE, 201] });
      try {
        const { deps } = fakes({ understand: nlpIncome() });
        delete deps.record; // use the real client
        const r = await handleUserMessage('I earned 800 from tailoring today', { userId: USER, deps });
        assert.equal(r.text, 'Recorded: income of ₹800 (tailoring) in your business pot.');
        assert.equal(stub.calls[0].origin, 'http://b.test:5000');
        assert.equal(stub.calls[0].body.channel, 'react_native_chat');
      } finally { stub.restore(); }
    }));

  test('a missing category falls back to the type (Dev-A convention)', async () => {
    const { deps, calls } = fakes({ understand: nlpIncome({ transaction: { type: 'saving', amount: 500, category: null }, intent: 'record_saving' }) });
    await handleUserMessage('I saved 500', { userId: USER, deps });
    assert.deepEqual(calls.record[0].parsed_transaction, { type: 'saving', amount: 500, category: 'saving' });
  });

  test('an incomplete transaction (no amount) asks for clarification and records NOTHING', async () => {
    const { deps, calls } = fakes({ understand: nlpIncome({ transaction: { type: 'income', amount: null, category: 'tailoring' }, confidence: 0.5, reply_text: 'How much was it?' }) });
    const r = await handleUserMessage('I got some money from tailoring', { userId: USER, deps });
    assert.equal(r.kind, 'clarify');
    assert.equal(r.text, 'How much was it?');
    assert.equal(calls.record.length, 0);
    assert.equal(calls.guidance.length, 0);
  });

  test('low confidence (< 0.6) is not recorded even with an amount', async () => {
    const { deps, calls } = fakes({ understand: nlpIncome({ confidence: 0.55 }) });
    const r = await handleUserMessage('maybe 800 from something', { userId: USER, deps });
    assert.equal(r.kind, 'clarify');
    assert.equal(calls.record.length, 0);
  });

  test('a duplicate is reported honestly', async () => {
    const { deps } = fakes({ understand: nlpIncome(), record: async () => ({ status: 'duplicate', confirmation: 'I already recorded this one, so I did not add it again.', response: {} }) });
    const r = await handleUserMessage('I earned 800 from tailoring today', { userId: USER, deps });
    assert.equal(r.kind, 'duplicate');
    assert.match(r.text, /already recorded/);
  });

  test('Person B rejecting it (e.g. insufficient funds) shows Person B\'s reason, not a fake success', async () => {
    const { deps } = fakes({ understand: nlpIncome({ intent: 'record_expense', transaction: { type: 'expense', amount: 9999, category: 'cash' } }), record: async () => { throw new ApiError('Insufficient funds in pot', { status: 400 }); } });
    const r = await handleUserMessage('spent 9999', { userId: USER, deps });
    assert.equal(r.kind, 'error');
    assert.equal(r.reason, 'person_b_rejected');
    assert.equal(r.text, "I understood this but couldn't record it: Insufficient funds in pot");
  });

  test('Person B being down is an honest "nothing was recorded"', async () => {
    const { deps } = fakes({ understand: nlpIncome(), record: async () => { throw new ApiError('Could not reach b', { isNetworkError: true }); } });
    const r = await handleUserMessage('I earned 800 from tailoring today', { userId: USER, deps });
    assert.equal(r.kind, 'error');
    assert.equal(r.reason, 'person_b_unavailable');
    assert.equal(r.text, FAILURE_TEXT.personBDown);
    assert.match(r.text, /nothing was recorded/);
  });
});

describe('questions go to Person C, and no message ever gets a canned reply', () => {
  for (const intent of ['goal_question', 'education_question', 'financial_question', 'unknown']) {
    test(`intent ${intent} -> Person C guidance; the reply is exactly Person C's text`, async () => {
      const { deps, calls } = fakes({ understand: async () => ({ intent, transaction: null, language: 'en', confidence: 0.9, reply_text: '' }) });
      const r = await handleUserMessage("how can I reach my daughter's education goal faster?", { userId: USER, deps });
      assert.equal(r.kind, 'guidance');
      assert.equal(r.text, 'PERSON-C-GUIDANCE');
      assert.deepEqual(calls.guidance, [{ question: "how can I reach my daughter's education goal faster?", userId: USER }]);
      assert.equal(calls.record.length, 0);
    });
  }

  test('NLP down: honest failure, nothing recorded, nobody else called', async () => {
    const { deps, calls } = fakes({ understand: async () => { throw new Error('NLP down'); } });
    const r = await handleUserMessage('I earned 800 from tailoring today', { userId: USER, deps });
    assert.equal(r.kind, 'error');
    assert.equal(r.reason, 'nlp_unavailable');
    assert.equal(r.text, FAILURE_TEXT.understand);
    assert.equal(calls.record.length + calls.guidance.length + calls.safety.length, 0);
  });

  test('Person C down: honest failure for both guidance and safety, never silence and never fake advice', async () => {
    const down = async () => { throw new ApiError('Could not reach c', { isNetworkError: true }); };
    const { deps } = fakes({ guidance: down, safety: down });
    const g = await handleUserMessage('should I take this loan?', { userId: USER, deps });
    assert.equal(g.kind, 'error');
    assert.equal(g.text, FAILURE_TEXT.personC);
    const s = await handleUserMessage('Your KYC will expire, click to verify', { userId: USER, deps });
    assert.equal(s.kind, 'error');
    assert.equal(s.text, FAILURE_TEXT.personC);
  });

  test('every user-visible text is either a service\'s own text or one of the fixed honest-failure/clarification strings', async () => {
    const allowedFixed = new Set([...Object.values(FAILURE_TEXT)]);
    const { deps } = fakes();
    for (const msg of ['hello', 'how much can I save?', 'thanks']) {
      const r = await handleUserMessage(msg, { userId: USER, deps });
      assert.ok(r.text === 'PERSON-C-GUIDANCE' || allowedFixed.has(r.text));
    }
  });
});
