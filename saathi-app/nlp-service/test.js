const { test, describe } = require('node:test');
const assert = require('node:assert');
const { NlpResponseSchema, UnderstandRequestSchema } = require('./schema');
const { validateNlpOutput, cleanModelOutput, normalizeInputText } = require('./groqService');

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
    assert.strictEqual(parsed.reply_text, 'Got it. I understood that you earned ₹800 from tailoring.');
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
    assert.strictEqual(parsed.reply_text, 'అర్థమైంది. నేడు టైలరింగ్ ద్వారా మీకు ₹800 వచ్చినట్లు నమోదు చేశాను.');
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
    assert.strictEqual(parsed.reply_text, 'समझ गई। आज सिलाई से ₹800 की आमदनी दर्ज कर ली गई है।');
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
    assert.ok(parsed.reply_text.includes('amount') || parsed.reply_text.includes('How much'));
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
});
