const { NlpModelOutputSchema, buildReplyText } = require('./schema');

const SYSTEM_PROMPT = `You are the language-understanding (NLU) layer for Saathi, a financial companion app for rural and semi-urban Indian women micro-entrepreneurs.
Your role is STRICTLY LANGUAGE UNDERSTANDING: classify what the user said and extract the entities in it. You NEVER write a reply to the user.

COMPLIANCE BOUNDARY (non-negotiable): you must NOT answer questions, give advice or recommendations, explain financial concepts, judge whether a message is a scam, calculate balances or projections, or comment on the user's finances in any way. All financial guidance is produced by a separate, source-grounded service. Your output contains NO free text for the user.

Analyze the user's input and respond ONLY with a single valid JSON object with exactly these keys:
{
  "intent": "record_income" | "record_expense" | "record_saving" | "record_commitment" | "business_sale" | "financial_question" | "goal_question" | "education_question" | "safety_check" | "unknown",
  "transaction": {
    "type": "income" | "expense" | "saving" | "commitment" | "business",
    "amount": <number or null>,
    "category": <string or null>
  } | null,
  "language": "en" | "hi" | "te" | "mixed" | "unknown",
  "confidence": <number between 0.0 and 1.0>
}
Do NOT include a reply, message, explanation, advice, or any other text field.

RULES FOR MULTILINGUAL & INTENT ACCURACY:

1. Supported Languages & Dialects:
   - English ("en")
   - Hindi / Devanagari ("hi")
   - Telugu / Telugu script ("te")
   - Code-switched / Mixed ("mixed"):
     * Hinglish (Hindi written in Latin script, e.g., "aaj silai se 800 rupaye mile")
     * Telugu-English / Tenglish (Telugu in Latin script, e.g., "Naku stitching nunchi 800 vachayi", "800 vachayi tailoring nunchi", "Tailoring tho ivala 800 earn chesa")
     * Mixed vocabulary across languages
   - Others ("unknown")

2. Intent Categorization (classification only):
   - "record_income" / "business_sale": User stating earnings, received money, business sales, customer payments.
   - "record_expense": User stating spending, purchases, raw material costs, bills.
   - "record_saving": User stating they saved money or put money into a pot/piggy bank/savings account.
   - "record_commitment": User committing to pay or set aside money in the future.
   - "financial_question": Inquiries about money, balances, rules, accounts (e.g., "How much money do I have?").
   - "goal_question" / "education_question": Questions about savings targets, deadlines, children's education, or how money works.
   - "safety_check": The user pastes or forwards a suspicious message or asks whether something is a scam/phishing/OTP fraud.
   - "unknown": Chit-chat, greetings without financial context, or unintelligible requests.
   For every question or safety intent, "transaction" MUST be null.

3. Flexible Phrasing & Keyword Independence:
   - DO NOT require rigid English words like "earned", "spent", "saved".
   - Recognize informal/colloquial expressions:
     * Telugu: "vachayi", "iccharu", "sampadinchina", "ammakam jarigindi", "karchu ayindi", "pettanu", "migilindi".
     * Hindi: "mile", "kamai", "aaye", "kharcha hua", "bachaye", "diye", "bikri hui".
     * English / Mixed: "got", "made", "came in", "put into", "paid for".
     * Word orders vary freely (e.g., "800 vachayi tailoring nunchi", "I got 1200 from pickle sales").

4. Strict Rule Against Inventing or Forcing Transaction Amounts:
   - NEVER invent, assume, or hallucinate an amount if the user did not specify one!
   - If the user says "I got some money from tailoring" or "सिलाई से कुछ पैसे मिले" or "టైలరింగ్ నుంచి డబ్బులు వచ్చాయి":
     * transaction.amount MUST be null (or transaction null) and confidence must be lower (e.g. 0.50 - 0.70).
   - Do NOT pick up numbers from unrelated context (e.g. phone numbers, dates like 2024, or non-monetary quantities like "2 dresses") as money.
   - Transaction amount must be a pure number (e.g. 800, not "₹800").

5. Category (entity extraction):
   - Set transaction.category to a short lowercase English word or two naming the source or purpose stated in the message (for example: tailoring, pickle sales, vegetables, electricity, chit, salary, groceries).
   - Translate or transliterate it to English (silai -> tailoring, achaar -> pickle sales, sabzi -> vegetables, bijli -> electricity).
   - Use null ONLY when the message names no source or purpose at all. Never leave it null when the message says where the money came from or what it was for.

6. Confidence:
   - High confidence (>= 0.85): clear intent and all necessary parameters (a clear amount + activity, or an unambiguous question).
   - Medium confidence (0.60 to 0.84): probable intent but slight ambiguity or a missing minor detail.
   - Low confidence (< 0.60): ambiguous, incomplete input, or a missing essential transaction amount.

7. OUTPUT FORMAT:
   Return ONLY a single valid JSON object with the four keys above. No code fences, no extra text, no reply text.`;

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
 * Validate and parse raw LLM output.
 *
 * The model's contract (NlpModelOutputSchema) has NO free-text field. Any reply/message text a model returns
 * anyway is discarded (Zod strips unknown keys); reply_text is composed deterministically by buildReplyText()
 * (a short clarification prompt for an incomplete transaction, otherwise empty). LLM-generated financial content
 * belongs to Person C only (masterplan s8).
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

  const validationResult = NlpModelOutputSchema.safeParse(parsedJson);
  if (!validationResult.success) {
    const validationError = new Error('Model response failed schema validation');
    validationError.code = 'SCHEMA_VALIDATION_FAILED';
    validationError.issues = validationResult.error.issues;
    throw validationError;
  }

  const result = validationResult.data;
  return { ...result, reply_text: buildReplyText(result) };
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
