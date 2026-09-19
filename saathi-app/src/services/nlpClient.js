/**
 * NLP Client service for Saathi frontend
 * Communicates with the independent saathi-nlp backend service.
 * Language understanding ONLY: intent, entities, language, confidence. It returns no advice; questions are answered
 * by Person C (see messageRouter.js).
 */

import { getNlpApiUrl } from './apiConfig.js';

// The base URL now lives in apiConfig.js (one env var per service); re-exported for existing callers.
export { getNlpApiUrl };

/**
 * Sends user text to the NLP understanding endpoint
 *
 * @param {string} text - User message (required, 1-2000 characters)
 * @param {Array} conversation - Optional conversation history
 * @returns {Promise<{
 *   intent: string,
 *   transaction: { type: string, amount: number | null, category: string | null } | null,
 *   language: 'en' | 'hi' | 'te' | 'mixed' | 'unknown',
 *   confidence: number,
 *   reply_text: string
 * }>}
 */
export async function understandMessage(text, conversation = []) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Message text cannot be empty.');
  }

  const trimmed = text.trim();
  if (trimmed.length > 2000) {
    throw new Error('Message exceeds maximum length of 2000 characters.');
  }

  const baseUrl = getNlpApiUrl();
  const endpoint = `${baseUrl}/api/nlp/understand`;

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: trimmed,
        conversation: Array.isArray(conversation) ? conversation : [],
      }),
    });
  } catch (networkError) {
    const err = new Error('Saathi could not connect right now. Please check if the NLP service is running.');
    err.originalError = networkError;
    err.isNetworkError = true;
    throw err;
  }

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = null;
    }

    const message =
      errorData?.message ||
      (response.status === 503
        ? 'Saathi NLP service is temporarily unavailable (API key not configured).'
        : `NLP request failed with status ${response.status}`);

    const err = new Error(message);
    err.status = response.status;
    err.details = errorData;
    throw err;
  }

  const result = await response.json();

  if (!result || typeof result.reply_text !== 'string') {
    throw new Error('Invalid response structure received from Saathi NLP service.');
  }

  return result;
}

export default {
  understandMessage,
  getNlpApiUrl,
};
