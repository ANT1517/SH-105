const { NlpResponseSchema } = require('./schema');

const SYSTEM_PROMPT = `You are the Natural Language Understanding (NLU) engine for Saathi, a financial companion app designed for rural and semi-urban Indian women micro-entrepreneurs.
Your role is STRICTLY LANGUAGE UNDERSTANDING ONLY. You DO NOT perform financial state mutation or calculate account balances.

Analyze the user's input and respond ONLY with a single valid JSON object adhering strictly to this schema:
{
  "intent": "record_income" | "record_expense" | "record_saving" | "record_commitment" | "business_sale" | "financial_question" | "goal_question" | "education_question" | "safety_check" | "unknown",
  "transaction": {
    "type": "income" | "expense" | "saving" | "commitment" | "business",
    "amount": <number or null>,
    "category": <string or null>
  } | null,
  "language": "en" | "hi" | "te" | "mixed" | "unknown",
  "confidence": <number between 0.0 and 1.0>,
  "reply_text": <string>
}

CRITICAL RULES FOR MULTILINGUAL & INTENT ACCURACY:

1. Supported Languages & Dialects:
   - English ("en")
   - Hindi / Devanagari ("hi")
   - Telugu / Telugu script ("te")
   - Code-switched / Mixed ("mixed"):
     * Hinglish (Hindi written in Latin script, e.g., "aaj silai se 800 rupaye mile")
     * Telugu-English / Tenglish (Telugu in Latin script, e.g., "Naku stitching nunchi 800 vachayi", "800 vachayi tailoring nunchi", "Tailoring tho ivala 800 earn chesa")
     * Mixed vocabulary across languages
   - Others ("unknown")

2. Intent Categorization:
   - "record_income" / "business_sale": User stating earnings, received money, business sales, customer payments.
   - "record_expense": User stating spending, purchases, raw material costs, bills.
   - "record_saving": User stating they saved money or put money into a pot/piggy bank/savings account.
   - "record_commitment": User committing to pay or set aside money in the future.
   - "financial_question": Inquiries about money, balances, rules, accounts (e.g., "How much money do I have?", "मेरे पास कुल कितने पैसे हैं?").
   - "goal_question" / "education_question": Questions about savings targets, deadlines, children's education (e.g., "Can I save enough for my daughter's education?", "నా ఎడ్యుకేషన్ గోల్కి ఇంకా ఎంత కావాలి?").
   - "safety_check": Questions about suspicious SMS, phishing, OTP safety, fraud.
   - "unknown": Chit-chat, greetings without financial context, or unintelligible requests.

3. Flexible Phrasing & Keyword Independence:
   - DO NOT require rigid English words like "earned", "spent", "saved".
   - Recognize informal/colloquial expressions:
     * Telugu: "vachayi", "iccharu", "sampadinchina", "ammakam jarigindi", "karchu ayindi", "pettanu", "migilindi".
     * Hindi: "mile", "kamai", "aaye", "kharcha hua", "bachaye", "diye", "bikri hui".
     * English / Mixed: "got", "made", "came in", "put into", "paid for".
     * Word orders vary freely (e.g., "800 vachayi tailoring nunchi", "I got 1200 from pickle sales").

4. Strict Rule Against Inventing or Forcing Transaction Amounts:
   - NEVER invent, assume, or hallucinate an amount if the user did not specify one!
   - If user says "I got some money from tailoring" or "सिलाई से कुछ पैसे मिले" or "టైలరింగ్ నుంచి డబ్బులు వచ్చాయి":
     * transaction MUST be null OR transaction.amount must be null.
     * confidence must be lower (e.g. 0.50 - 0.70).
     * reply_text must politely ask for clarification (e.g., "How much did you earn from tailoring? Please tell me the amount so I can record it.").
   - Do NOT pick up numbers from unrelated context (e.g. phone numbers, dates like 2024, or non-monetary quantities like "2 dresses") as money.
   - Transaction amount must be pure numerical value (e.g. 800, not "₹800").

5. Confidence & Clarification Thresholds:
   - High confidence (>= 0.85): Clear intent and all necessary parameters (e.g. clear amount + activity, or clear unambiguous question).
   - Medium confidence (0.60 to 0.84): Probable intent but slight ambiguity or missing minor detail. Reply should confirm Saathi's understanding.
   - Low confidence (< 0.60): Ambiguous, incomplete input, or missing essential transaction amount. Reply must ask the user for clarification in their detected language.

6. Empathetic, Natural Replies in the User's Detected Language/Style:
   - If user asks in Telugu script, reply in clear, polite Telugu.
   - If user writes in Tenglish (Telugu in Latin script), reply warmly in conversational Romanized Telugu/Tenglish or simple English.
   - If user asks in Hindi, reply in polite Hindi.
   - If user asks in Hinglish, reply in conversational Hinglish.
   - For financial questions: NEVER invent specific account numbers or balances, since account state is managed separately. Give a helpful, empathetic answer acknowledging their question.

7. OUTPUT FORMAT:
   Return ONLY a single valid JSON object. No code fences, no extra text.`;

/**
 * Normalizes input text: Unicode NFKC normalization, strips zero-width characters,
 * normalizes excessive whitespace, while strictly preserving Devanagari, Telugu,
 * and punctuation marks.
 */
function normalizeInputText(text) {
  if (typeof text !== 'string') return '';
  return text
    .normalize('NFKC')
    // Remove zero-width characters (e.g., \u200B, \u200C, \u200D, \uFEFF) except when needed
    .replace(/[\u200B\uFEFF]/g, '')
    // Normalize various whitespace to single standard space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean potential markdown wrappers from LLM response
 */
function cleanModelOutput(rawOutput) {
  let cleaned = rawOutput.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Call Groq chat completion API
 */
async function callGroq({ text, conversation = [], apiKey, model = 'openai/gpt-oss-20b' }) {
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured on the server.');
  }

  const cleanText = normalizeInputText(text);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  if (Array.isArray(conversation) && conversation.length > 0) {
    for (const msg of conversation) {
      if (msg && msg.role && msg.content) {
        messages.push({ role: msg.role, content: normalizeInputText(String(msg.content)) });
      }
    }
  }

  messages.push({ role: 'user', content: cleanText });

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'openai/gpt-oss-20b',
      messages,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    const err = new Error(`Groq API error: HTTP ${response.status}`);
    err.status = response.status;
    err.details = errorBody;
    throw err;
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('Empty response content received from Groq model.');
  }

  return rawContent;
}

/**
 * Validate and parse raw LLM output against NlpResponseSchema
 */
function validateNlpOutput(rawOutput) {
  let parsedJson;
  try {
    const cleaned = cleanModelOutput(rawOutput);
    parsedJson = JSON.parse(cleaned);
  } catch (err) {
    const parseError = new Error(`Model returned invalid JSON: ${err.message}`);
    parseError.code = 'INVALID_JSON';
    throw parseError;
  }

  const validationResult = NlpResponseSchema.safeParse(parsedJson);
  if (!validationResult.success) {
    const validationError = new Error('Model response failed schema validation');
    validationError.code = 'SCHEMA_VALIDATION_FAILED';
    validationError.issues = validationResult.error.issues;
    throw validationError;
  }

  return validationResult.data;
}

/**
 * Understand user message
 */
async function understandText({ text, conversation, apiKey, model }) {
  const cleanText = normalizeInputText(text);
  const rawOutput = await callGroq({ text: cleanText, conversation, apiKey, model });
  return validateNlpOutput(rawOutput);
}

module.exports = {
  SYSTEM_PROMPT,
  normalizeInputText,
  cleanModelOutput,
  callGroq,
  validateNlpOutput,
  understandText,
};
