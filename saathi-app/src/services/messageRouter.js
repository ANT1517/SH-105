/**
 * Decides who handles a chat message and returns what Meera should see. NOTHING here is canned: every reply
 * comes from Person B (its recording confirmation) or Person C (its guidance / safety text), or is an honest
 * failure message saying that nothing happened.
 *
 * Order (the same as Dev-A's WhatsApp webhook, so the app and WhatsApp behave alike):
 *   1. Safety check FIRST. A message that trips the safety trigger goes to Person C's /api/v1/safety/check
 *      and is never treated as a transaction, even if it also looks like one ("paid 500 to verify your KYC").
 *   2. Otherwise saathi-nlp classifies it (language understanding only: intent + entities, no reply text).
 *   3. A transaction with an amount and enough confidence is POSTed to Person B /api/transactions and the reply
 *      is Person B's confirmation. An incomplete one gets a clarification question instead (nothing recorded).
 *   4. Everything else (questions, goals, education, chit-chat) goes to Person C guidance.
 */
import { getUserId } from './apiConfig.js';
import { looksSuspicious } from './safetyTrigger.js';
import { understandMessage } from './nlpClient.js';
import { toInternalAction } from './nlpIntegrationAdapter.js';
import { recordTransaction } from './personBClient.js';
import { getGuidance, checkSafety } from './personCClient.js';

export const TRANSACTION_INTENTS = new Set(['record_income', 'record_expense', 'record_saving', 'record_commitment', 'business_sale']);
export const MIN_TRANSACTION_CONFIDENCE = 0.6; // same gate as Dev-A / Person B ingestion

export const FAILURE_TEXT = {
  understand: "Saathi couldn't understand your message right now, so nothing was recorded. Please try again in a little while.",
  personC: "I couldn't reach Saathi's guidance service right now, so I couldn't answer that. Please try again in a little while.",
  personBDown: "I understood that, but I couldn't reach your records right now, so nothing was recorded. Please try again in a little while.",
};

const DEFAULT_CLARIFICATION = 'How much was it? Please tell me the amount so I can record it.';

/**
 * Person B's /api/transactions contract (contracts/normalized-input.schema.json shape). Built explicitly here,
 * not through prepareForNormalizedContract(), whose field names are not Person B's. When NLP has no category the
 * transaction type stands in, the same convention as Dev-A's parser ("income" / "expense" fallbacks).
 */
export function buildNormalizedInput(action, rawText, userId) {
  const tx = action.parsed_transaction;
  return {
    user_id: userId,
    channel: action.source.channel, // "react_native_chat": never hardcoded as "whatsapp"
    input_type: 'text',
    raw_text: rawText,
    normalized_text: rawText.replace(/\s+/g, ' '),
    parsed_transaction: { type: tx.type, amount: tx.amount, category: tx.category || tx.type },
    confidence: action.confidence,
  };
}

async function askPersonC(kind, message, userId, deps, extra = {}) {
  try {
    const reply = kind === 'safety' ? await deps.safety({ message, userId }) : await deps.guidance({ question: message, userId });
    return { kind, text: reply.text, sourceClass: reply.sourceClass, ...extra };
  } catch (err) {
    return { kind: 'error', reason: 'person_c_unavailable', text: FAILURE_TEXT.personC, error: err, ...extra };
  }
}

/**
 * @param {string} text the user's message
 * @param {{userId?: string, deps?: object}} [options] deps lets tests inject fakes for the network calls
 * @returns {Promise<{kind: 'recorded'|'duplicate'|'clarify'|'guidance'|'safety'|'error', text: string, [k: string]: any}>}
 */
export async function handleUserMessage(text, { userId = getUserId(), deps = {} } = {}) {
  const d = { understand: understandMessage, record: recordTransaction, guidance: getGuidance, safety: checkSafety, ...deps };
  const message = String(text || '').trim();

  // 1. Safety check first.
  if (looksSuspicious(message)) {
    return askPersonC('safety', message, userId, d);
  }

  // 2. Language understanding (intent + entities only).
  let nlp;
  try {
    nlp = await d.understand(message);
  } catch (err) {
    return { kind: 'error', reason: 'nlp_unavailable', text: FAILURE_TEXT.understand, error: err };
  }
  const action = toInternalAction(nlp, { userId });

  // 3. The model itself thinks this is a suspicious message the heuristic did not catch.
  if (action.intent === 'safety_check') {
    return askPersonC('safety', message, userId, d, { nlp });
  }

  // 4. Transactions go to Person B.
  if (TRANSACTION_INTENTS.has(action.intent) && action.parsed_transaction) {
    const { amount } = action.parsed_transaction;
    if (typeof amount !== 'number' || !(amount > 0) || action.confidence < MIN_TRANSACTION_CONFIDENCE) {
      return { kind: 'clarify', text: nlp.reply_text || DEFAULT_CLARIFICATION, nlp };
    }
    try {
      const result = await d.record(buildNormalizedInput(action, message, userId));
      if (result.status === 'duplicate') return { kind: 'duplicate', text: result.confirmation, nlp };
      const body = result.response;
      return {
        kind: 'recorded',
        text: result.confirmation,
        nlp,
        recorded: {
          type: body.transaction.tx_type,
          amount: body.transaction.amount,
          category: body.transaction.category,
          pot: body.pot_affected,
          totalBalance: body.updated_financial_state ? body.updated_financial_state.total_balance : null,
        },
      };
    } catch (err) {
      if (err.isNetworkError) return { kind: 'error', reason: 'person_b_unavailable', text: FAILURE_TEXT.personBDown, error: err, nlp };
      return { kind: 'error', reason: 'person_b_rejected', text: `I understood this but couldn't record it: ${err.message}`, error: err, nlp };
    }
  }

  // 5. Questions, goals, education, chit-chat: Person C answers.
  return askPersonC('guidance', message, userId, d, { nlp });
}
