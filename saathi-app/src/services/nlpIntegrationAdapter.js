/**
 * NLP Integration Adapter
 *
 * Serves as a neutral boundary between raw NLP output and future downstream services.
 *
 * Future planned flow:
 * Frontend
 * → NLP service
 * → NLP integration adapter (THIS FILE)
 * → Dev-A / normalized-input contract
 * → Person B transaction API
 * → updated financial state
 * → frontend refresh
 *
 * IMPORTANT ARCHITECTURAL BOUNDARY:
 * 1. This adapter DOES NOT call Person B or modify any financial state yet.
 * 2. Origin channel is set dynamically (e.g. "app_chat" or user-specified),
 *    NEVER hardcoded as "whatsapp" since chat messages originate from the React Native app.
 * 3. Compatibility Notice:
 *    - Dev-A's normalized-input specifies: ['income', 'expense', 'saving', 'commitment', 'business']
 *    - Person B's backend defines its own transaction semantics and schema.
 *    - This adapter does NOT silently map or coerce those semantics yet until both contracts stabilize.
 */

/**
 * Converts a raw NLP response into a neutral internal action object.
 *
 * @param {Object} nlpResult - Validated output from NLP service (NlpResponseSchema)
 * @param {Object} [context={}] - Optional metadata regarding message origin and session
 * @returns {Object} Neutral internal action object
 */
export function toInternalAction(nlpResult, context = {}) {
  if (!nlpResult || typeof nlpResult !== 'object') {
    throw new Error('Invalid NLP result passed to adapter');
  }

  const {
    intent = 'unknown',
    transaction = null,
    language = 'unknown',
    confidence = 0.0,
    reply_text = '',
  } = nlpResult;

  const parsedTransaction = transaction
    ? {
        type: transaction.type || null,
        amount: typeof transaction.amount === 'number' ? transaction.amount : null,
        category: transaction.category || null,
      }
    : null;

  return {
    intent,
    parsed_transaction: parsedTransaction,
    language,
    confidence,
    reply_text,
    // Dynamic origin metadata (never hardcoded as "whatsapp")
    source: {
      channel: context.channel || 'react_native_chat',
      userId: context.userId || null,
      timestamp: context.timestamp || new Date().toISOString(),
    },
    // Explicit downstream status flags (Person B has NOT been invoked)
    downstream: {
      personBExecuted: false,
      financialStateMutated: false,
      guidanceRouted: false,
    },
  };
}

/**
 * Placeholder for future contract transformation when Dev-A and Person B
 * contracts are formally merged.
 *
 * @param {Object} internalAction - Output of toInternalAction()
 * @returns {Object} Shape conforming to future normalized-input contract
 */
export function prepareForNormalizedContract(internalAction) {
  if (!internalAction || !internalAction.parsed_transaction) {
    return null;
  }

  // Notice: Does NOT alter semantics or invent accounts.
  // Preserves transaction fields cleanly for when Person B's endpoint is connected.
  return {
    entryType: internalAction.parsed_transaction.type,
    amount: internalAction.parsed_transaction.amount,
    category: internalAction.parsed_transaction.category,
    detectedLanguage: internalAction.language,
    confidence: internalAction.confidence,
    channel: internalAction.source.channel,
  };
}

export default {
  toInternalAction,
  prepareForNormalizedContract,
};
