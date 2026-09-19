const { z } = require('zod');

/**
 * Intent taxonomy for Saathi financial assistant
 */
const IntentEnum = z.enum([
  'record_income',
  'record_expense',
  'record_saving',
  'record_commitment',
  'business_sale',
  'financial_question',
  'goal_question',
  'education_question',
  'safety_check',
  'unknown',
]);

/**
 * Transaction payload schema
 */
const TransactionSchema = z
  .object({
    type: z.enum(['income', 'expense', 'saving', 'commitment', 'business']),
    amount: z.number().nullable(),
    category: z.string().nullable(),
  })
  .nullable();

/**
 * Supported language detection
 */
const LanguageEnum = z.enum(['en', 'hi', 'te', 'mixed', 'unknown']);

/**
 * What the LLM is allowed to return: classification + entities only. There is deliberately NO free-text field
 * (masterplan s8: only Person C may use an LLM for financial content).
 */
const NlpModelOutputSchema = z.object({
  intent: IntentEnum,
  transaction: TransactionSchema,
  language: LanguageEnum,
  confidence: z.number().min(0).max(1),
});

/**
 * Full NLP API response schema: the model output plus a server-composed reply_text.
 * reply_text is NOT model generated: it is a short clarification prompt when a transaction is missing its
 * amount (or has low confidence), and an empty string otherwise (questions are answered by Person C).
 */
const NlpResponseSchema = NlpModelOutputSchema.extend({
  reply_text: z.string(),
});

const TRANSACTION_INTENTS = ['record_income', 'record_expense', 'record_saving', 'record_commitment', 'business_sale'];
const MIN_TRANSACTION_CONFIDENCE = 0.6;

const CLARIFY_TEXT = {
  en: 'How much was it? Please tell me the amount so I can record it.',
  hi: '\u0915\u093f\u0924\u0928\u0940 \u0930\u0915\u092e \u0925\u0940? \u0915\u0943\u092a\u092f\u093e \u0930\u093e\u0936\u093f \u092c\u0924\u093e\u0907\u090f \u0924\u093e\u0915\u093f \u092e\u0948\u0902 \u0926\u0930\u094d\u091c \u0915\u0930 \u0938\u0915\u0942\u0901\u0964',
  te: '\u0c0e\u0c02\u0c24 \u0c2e\u0c4a\u0c24\u0c4d\u0c24\u0c02? \u0c26\u0c2f\u0c1a\u0c47\u0c38\u0c3f \u0c2e\u0c4a\u0c24\u0c4d\u0c24\u0c02 \u0c1a\u0c46\u0c2a\u0c4d\u0c2a\u0c02\u0c21\u0c3f, \u0c28\u0c47\u0c28\u0c41 \u0c28\u0c2e\u0c4b\u0c26\u0c41 \u0c1a\u0c47\u0c38\u0c4d\u0c24\u0c3e\u0c28\u0c41.',
};

/**
 * Deterministic reply_text (no LLM): a clarification prompt for an incomplete transaction, otherwise ''.
 */
function buildReplyText(result) {
  const isTransaction = TRANSACTION_INTENTS.includes(result.intent) && result.transaction;
  if (!isTransaction) return '';
  const incomplete = result.transaction.amount === null || result.confidence < MIN_TRANSACTION_CONFIDENCE;
  return incomplete ? (CLARIFY_TEXT[result.language] || CLARIFY_TEXT.en) : '';
}

/**
 * Request payload validation schema
 */
const UnderstandRequestSchema = z.object({
  text: z.string({
    required_error: 'text field is required',
    invalid_type_error: 'text must be a string',
  })
    .trim()
    .min(1, { message: 'text cannot be empty' })
    .max(2000, { message: 'text cannot exceed 2000 characters' }),
  conversation: z.array(z.any()).optional().default([]),
});

module.exports = {
  IntentEnum,
  TransactionSchema,
  LanguageEnum,
  NlpModelOutputSchema,
  NlpResponseSchema,
  TRANSACTION_INTENTS,
  MIN_TRANSACTION_CONFIDENCE,
  buildReplyText,
  UnderstandRequestSchema,
};
