const { test, describe } = require('node:test');
const assert = require('node:assert');
const { NlpResponseSchema, NlpModelOutputSchema, UnderstandRequestSchema, buildReplyText } = require('./schema');
const { validateNlpOutput, cleanModelOutput, normalizeInputText, SYSTEM_PROMPT } = require('./groqService');

describe('Saathi NLP Service - Step 4 Test Suite', () => {

  // Test 1: Successful structured output validation with valid schema
  test('1. Successful structured output validation with valid schema', () => {
    const validModelOutput = JSON.stringify({
      intent: 'record_income',
      transaction: {
        type: 'income',
        amount: 800,
        category: 'tailoring',
      },
      language: 'en',
      confidence: 0.98,
      reply_text: 'Got it. I understood that you earned ₹800 from tailoring.',
    });

    const parsed = validateNlpOutput(validModelOutput);
    assert.strictEqual(parsed.intent, 'record_income');
    assert.strictEqual(parsed.transaction.amount, 800);
    assert.strictEqual(parsed.transaction.type, 'income');
    assert.strictEqual(parsed.transaction.category, 'tailoring');
    assert.strictEqual(parsed.language, 'en');
    assert.strictEqual(parsed.confidence, 0.98);
    // reply_text is never model-written: a complete, confident transaction needs no server text at all.
    assert.strictEqual(parsed.reply_text, '');
  });

  // Test 2: Invalid JSON handling
  test('2. Handles invalid JSON from model', () => {
    const malformedJson = '{ intent: record_income, bad_syntax ';
    assert.throws(
      () => validateNlpOutput(malformedJson),
      (err) => {
        assert.strictEqual(err.code, 'INVALID_JSON');
        return true;
      }
    );
  });

  // Test 3: Invalid confidence (< 0 or > 1 or wrong type)
  test('3. Rejects invalid confidence outside 0..1', () => {
    const invalidConfidenceHigh = JSON.stringify({
      intent: 'record_income',
      transaction: { type: 'income', amount: 800, category: 'tailoring' },
      language: 'en',
      confidence: 1.5,
      reply_text: 'Got it',
    });

    assert.throws(
      () => validateNlpOutput(invalidConfidenceHigh),
      (err) => {
        assert.strictEqual(err.code, 'SCHEMA_VALIDATION_FAILED');
        const issue = err.issues.find((i) => i.path.includes('confidence'));
        assert.ok(issue, 'Should report confidence issue');
        return true;
      }
    );

    const invalidConfidenceLow = JSON.stringify({
      intent: 'record_income',
      transaction: { type: 'income', amount: 800, category: 'tailoring' },
      language: 'en',
      confidence: -0.2,
      reply_text: 'Got it',
    });

    assert.throws(
      () => validateNlpOutput(invalidConfidenceLow),
      (err) => {
        assert.strictEqual(err.code, 'SCHEMA_VALIDATION_FAILED');
        return true;
      }
    );
  });

  // Test 4: Missing or invalid transaction amount
  test('4. Handles transaction structure properly (rejects invalid non-number non-null amount)', () => {
    const invalidStringAmount = JSON.stringify({
      intent: 'record_income',
      transaction: {
        type: 'income',
        amount: '800',
        category: 'tailoring',
      },
      language: 'en',
      confidence: 0.95,
      reply_text: 'Got it',
    });

    assert.throws(
      () => validateNlpOutput(invalidStringAmount),
      (err) => {
        assert.strictEqual(err.code, 'SCHEMA_VALIDATION_FAILED');
        const issue = err.issues.find((i) => i.path.includes('amount'));
        assert.ok(issue, 'Should report transaction.amount issue');
        return true;
      }
    );
  });

  // Test 5: Empty text / request validation
  test('5. Rejects empty text or invalid request body', () => {
    const emptyResult = UnderstandRequestSchema.safeParse({ text: '' });
    assert.strictEqual(emptyResult.success, false);

    const whitespaceResult = UnderstandRequestSchema.safeParse({ text: '   ' });
    assert.strictEqual(whitespaceResult.success, false);

    const missingResult = UnderstandRequestSchema.safeParse({});
    assert.strictEqual(missingResult.success, false);

    const nonStringResult = UnderstandRequestSchema.safeParse({ text: 12345 });
    assert.strictEqual(nonStringResult.success, false);

    const tooLongResult = UnderstandRequestSchema.safeParse({ text: 'a'.repeat(2001) });
    assert.strictEqual(tooLongResult.success, false);

    const validResult = UnderstandRequestSchema.safeParse({ text: 'I earned ₹800 from tailoring' });
    assert.strictEqual(validResult.success, true);
  });

  // Test 6: Telugu result schema validation ("నేడు టైలరింగ్ చేసి 800 రూపాయలు వచ్చాయి")
  test('6. Telugu result schema validation', () => {
    const teluguModelOutput = JSON.stringify({
      intent: 'record_income',
      transaction: {
        type: 'income',
        amount: 800,
        category: 'tailoring',
      },
      language: 'te',
      confidence: 0.96,
      reply_text: 'అర్థమైంది. నేడు టైలరింగ్ ద్వారా మీకు ₹800 వచ్చినట్లు నమోదు చేశాను.',
    });

    const parsed = validateNlpOutput(teluguModelOutput);
    assert.strictEqual(parsed.intent, 'record_income');
    assert.strictEqual(parsed.language, 'te');
    assert.strictEqual(parsed.transaction.amount, 800);
    assert.strictEqual(parsed.transaction.category, 'tailoring');
    assert.strictEqual(parsed.reply_text, ''); // model-written Telugu reply is discarded
  });

  // Test 7: Hindi result schema validation ("आज सिलाई से 800 रुपये मिले")
  test('7. Hindi result schema validation', () => {
    const hindiModelOutput = JSON.stringify({
      intent: 'record_income',
      transaction: {
        type: 'income',
        amount: 800,
        category: 'tailoring',
      },
      language: 'hi',
      confidence: 0.97,
      reply_text: 'समझ गई। आज सिलाई से ₹800 की आमदनी दर्ज कर ली गई है।',
    });

    const parsed = validateNlpOutput(hindiModelOutput);
    assert.strictEqual(parsed.intent, 'record_income');
    assert.strictEqual(parsed.language, 'hi');
    assert.strictEqual(parsed.transaction.amount, 800);
    assert.strictEqual(parsed.transaction.category, 'tailoring');
    assert.strictEqual(parsed.reply_text, ''); // model-written Hindi reply is discarded
  });

  // Test 8: English result schema validation ("I got 1200 from pickle sales")
  test('8. English result schema validation', () => {
    const englishModelOutput = JSON.stringify({
      intent: 'business_sale',
      transaction: {
        type: 'business',
        amount: 1200,
        category: 'pickle sales',
      },
      language: 'en',
      confidence: 0.95,
      reply_text: 'Got it. I recorded ₹1,200 from your pickle sales.',
    });

    const parsed = validateNlpOutput(englishModelOutput);
    assert.strictEqual(parsed.intent, 'business_sale');
    assert.strictEqual(parsed.language, 'en');
    assert.strictEqual(parsed.transaction.amount, 1200);
    assert.strictEqual(parsed.transaction.category, 'pickle sales');
  });

  // Test 9: Hinglish / Mixed result validation ("aaj silai se 800 rupaye mile")
  test('9. Hinglish result schema validation', () => {
    const hinglishOutput = JSON.stringify({
      intent: 'record_income',
      transaction: {
        type: 'income',
        amount: 800,
        category: 'tailoring',
      },
      language: 'mixed',
      confidence: 0.92,
      reply_text: 'Samajh gayi! Silai se ₹800 ki kamai maine note kar li hai.',
    });

    const parsed = validateNlpOutput(hinglishOutput);
    assert.strictEqual(parsed.intent, 'record_income');
    assert.strictEqual(parsed.language, 'mixed');
    assert.strictEqual(parsed.transaction.amount, 800);
  });

  // Test 10: Telugu-English mixed result validation ("Naku stitching nunchi ₹800 vachayi" / "Tailoring tho ivala 800 earn chesa")
  test('10. Telugu-English mixed result schema validation', () => {
    const teluguMixedOutput = JSON.stringify({
      intent: 'record_income',
      transaction: {
        type: 'income',
        amount: 800,
        category: 'stitching',
      },
      language: 'mixed',
      confidence: 0.91,
      reply_text: 'Arthamaindi! Stitching nunchi ₹800 vachinattu note chesukuntanu.',
    });

    const parsed = validateNlpOutput(teluguMixedOutput);
    assert.strictEqual(parsed.intent, 'record_income');
    assert.strictEqual(parsed.language, 'mixed');
    assert.strictEqual(parsed.transaction.amount, 800);
    assert.strictEqual(parsed.transaction.category, 'stitching');
  });

  // Test 11: Incomplete transaction ("I got some money from tailoring") - amount is null, asks for clarification
  test('11. Incomplete transaction does not invent made-up amount and requests clarification', () => {
    const incompleteOutput = JSON.stringify({
      intent: 'record_income',
      transaction: {
        type: 'income',
        amount: null, // No amount hallucinated!
        category: 'tailoring',
      },
      language: 'en',
      confidence: 0.55, // Low confidence -> clarification
      reply_text: 'How much money did you receive from tailoring? Please tell me the amount so I can record it.',
    });

    const parsed = validateNlpOutput(incompleteOutput);
    assert.strictEqual(parsed.transaction.amount, null);
    assert.strictEqual(parsed.transaction.category, 'tailoring');
    assert.ok(parsed.confidence < 0.60, 'Confidence should reflect clarification requirement');
    // The clarification prompt is the server's deterministic text, not the model's.
    assert.strictEqual(parsed.reply_text, buildReplyText(parsed));
    assert.ok(parsed.reply_text.includes('How much'));
    assert.ok(!parsed.reply_text.includes('tailoring'));
  });

  // Test 12: Ambiguous input / unrelated numbers ("I bought 2 dresses yesterday")
  test('12. Ambiguous amount does not map non-money count to transaction amount', () => {
    const ambiguousOutput = JSON.stringify({
      intent: 'record_expense',
      transaction: {
        type: 'expense',
        amount: null, // Did not treat '2' (dresses) as ₹2!
        category: 'dresses',
      },
      language: 'en',
      confidence: 0.58,
      reply_text: 'How much did you spend on the 2 dresses? Please share the amount.',
    });

    const parsed = validateNlpOutput(ambiguousOutput);
    assert.strictEqual(parsed.transaction.amount, null);
    assert.ok(parsed.confidence < 0.60);
  });

  // Test 13: Normal financial question ("How much money do I have?" / "నా ఎడ్యుకేషన్ గోల్కి ఇంకా ఎంత కావాలి?")
  test('13. Financial / Goal question does not invent transaction or balance totals', () => {
    const questionOutput = JSON.stringify({
      intent: 'financial_question',
      transaction: null,
      language: 'en',
      confidence: 0.94,
      reply_text: 'You can see your total balance across all your pots in the Home screen Money Pots Map.',
    });

    const parsed = validateNlpOutput(questionOutput);
    assert.strictEqual(parsed.intent, 'financial_question');
    assert.strictEqual(parsed.transaction, null);
    assert.strictEqual(parsed.language, 'en');

    // Telugu goal question
    const teluguGoalOutput = JSON.stringify({
      intent: 'education_question',
      transaction: null,
      language: 'te',
      confidence: 0.95,
      reply_text: 'మీ ఎడ్యుకేషన్ గోల్ వివరాలు మరియు ఇంకా ఎంత మిగిలి ఉందో మీ గోల్స్ విభాగంలో చూడవచ్చు.',
    });
    const parsedTelugu = validateNlpOutput(teluguGoalOutput);
    assert.strictEqual(parsedTelugu.intent, 'education_question');
    assert.strictEqual(parsedTelugu.transaction, null);
    assert.strictEqual(parsedTelugu.language, 'te');
  });

  // Test 14: Unicode normalization preserves Telugu & Hindi characters
  test('14. Unicode normalization preserves Telugu and Devanagari characters and trims zero-width spaces', () => {
    const teluguRaw = ' నేడు\u200B టైలరింగ్   చేసి 800 రూపాయలు\uFEFF వచ్చాయి  ';
    const teluguNormalized = normalizeInputText(teluguRaw);
    assert.strictEqual(teluguNormalized, 'నేడు టైలరింగ్ చేసి 800 రూపాయలు వచ్చాయి');

    const hindiRaw = ' आज  सिलाई\u200B से 800  रुपये मिले ';
    const hindiNormalized = normalizeInputText(hindiRaw);
    assert.strictEqual(hindiNormalized, 'आज सिलाई से 800 रुपये मिले');
  });

  // Test 15: Markdown code block stripping
  test('15. cleanModelOutput strips markdown fences safely', () => {
    const rawWrapped = '```json\n{"intent":"unknown","transaction":null,"language":"unknown","confidence":0.5,"reply_text":"Hi"}\n```';
    const cleaned = cleanModelOutput(rawWrapped);
    const parsed = JSON.parse(cleaned);
    assert.strictEqual(parsed.intent, 'unknown');
  });

  // ─── LLM compliance boundary (masterplan s8): only Person C may use an LLM for financial content ─────────

  test('16. Model-written reply text is discarded for EVERY intent (no LLM financial content leaks through)', () => {
    const intents = ['financial_question', 'goal_question', 'education_question', 'safety_check', 'unknown', 'record_income'];
    for (const intent of intents) {
      const out = validateNlpOutput(JSON.stringify({
        intent,
        transaction: intent === 'record_income' ? { type: 'income', amount: 800, category: 'tailoring' } : null,
        language: 'en',
        confidence: 0.95,
        reply_text: 'You should move your savings into a fixed deposit and you will earn 7% guaranteed.',
      }));
      assert.strictEqual(out.reply_text, '', `intent ${intent} must not carry model-written text`);
      assert.ok(!JSON.stringify(out).includes('fixed deposit'));
    }
  });

  test('17. reply_text is only a deterministic clarification prompt for an incomplete transaction', () => {
    const incomplete = { intent: 'record_income', transaction: { type: 'income', amount: null, category: 'tailoring' }, confidence: 0.5 };
    assert.match(buildReplyText({ ...incomplete, language: 'en' }), /How much/);
    assert.match(buildReplyText({ ...incomplete, language: 'hi' }), /[\u0900-\u097F]/); // Devanagari
    assert.match(buildReplyText({ ...incomplete, language: 'te' }), /[\u0C00-\u0C7F]/); // Telugu
    assert.match(buildReplyText({ ...incomplete, language: 'mixed' }), /How much/); // falls back to English
    // low confidence with an amount is also a clarification; a confident complete transaction is not
    assert.match(buildReplyText({ intent: 'record_expense', transaction: { type: 'expense', amount: 300, category: 'x' }, language: 'en', confidence: 0.55 }), /How much/);
    assert.strictEqual(buildReplyText({ intent: 'record_expense', transaction: { type: 'expense', amount: 300, category: 'x' }, language: 'en', confidence: 0.9 }), '');
    // questions never get server or model text: Person C answers them
    assert.strictEqual(buildReplyText({ intent: 'goal_question', transaction: null, language: 'en', confidence: 0.9 }), '');
  });

  test('18. The system prompt no longer asks the model to write replies or answer questions', () => {
    assert.ok(!/"reply_text"/.test(SYSTEM_PROMPT), 'prompt must not define a reply_text key');
    assert.ok(!/empathetic/i.test(SYSTEM_PROMPT), 'prompt must not ask for empathetic replies');
    assert.ok(!/reply_text must/i.test(SYSTEM_PROMPT));
    assert.match(SYSTEM_PROMPT, /COMPLIANCE BOUNDARY/);
    assert.match(SYSTEM_PROMPT, /NEVER write a reply/);
    assert.match(SYSTEM_PROMPT, /must NOT answer questions/);
  });

  test('18b. The prompt tells the model to always extract a translated category when one is stated', () => {
    assert.ok(SYSTEM_PROMPT.includes('Category (entity extraction)'));
    assert.match(SYSTEM_PROMPT, /silai -> tailoring/);
    assert.match(SYSTEM_PROMPT, /Use null ONLY when the message names no source or purpose/);
  });

  test('19. The model output contract has no free-text field', () => {
    assert.deepStrictEqual(Object.keys(NlpModelOutputSchema.shape).sort(), ['confidence', 'intent', 'language', 'transaction']);
    assert.ok('reply_text' in NlpResponseSchema.shape, 'API response keeps reply_text for compatibility');
  });

  test('20. End to end through POST /api/nlp/understand: a model that tries to give advice cannot deliver it', async () => {
    process.env.GROQ_API_KEY = 'test-key-not-real';
    const { app } = require('./server');
    const http = require('node:http');
    const originalFetch = globalThis.fetch;
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    try {
      globalThis.fetch = async (url, init) => {
        if (String(url).includes('api.groq.com')) {
          const sentSystemPrompt = JSON.parse(init.body).messages[0].content;
          assert.match(sentSystemPrompt, /COMPLIANCE BOUNDARY/);
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: JSON.stringify({
                intent: 'goal_question', transaction: null, language: 'en', confidence: 0.93,
                reply_text: 'Save 2000 every month and put it in a mutual fund; you will hit your goal in 6 months.',
              }) } }],
            }),
          };
        }
        return originalFetch(url, init);
      };
      const res = await originalFetch(`http://127.0.0.1:${port}/api/nlp/understand`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: "how can I reach my daughter's education goal faster?" }),
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.deepStrictEqual(Object.keys(body).sort(), ['confidence', 'intent', 'language', 'reply_text', 'transaction']);
      assert.strictEqual(body.intent, 'goal_question');
      assert.strictEqual(body.reply_text, '');
      assert.ok(!JSON.stringify(body).toLowerCase().includes('mutual fund'));
    } finally {
      globalThis.fetch = originalFetch;
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
