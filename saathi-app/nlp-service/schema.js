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
 * Full NLP response schema
 */
const NlpResponseSchema = z.object({
  intent: IntentEnum,
  transaction: TransactionSchema,
  language: LanguageEnum,
  confidence: z.number().min(0).max(1),
  reply_text: z.string(),
});

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
  NlpResponseSchema,
  UnderstandRequestSchema,
};
