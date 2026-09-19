/**
 * Person C client: the ONLY place financial guidance and safety explanations come from
 * (masterplan s8 compliance boundary). The app never composes or generates such text itself.
 *
 * The `language` field (en/te/hi/kn) is passed to Person C so LLM responses are produced
 * in the user's selected UI language. It is INDEPENDENT of NLP input language detection.
 */
import { getPersonCApiUrl, getUserId } from './apiConfig.js';
import { requestJson } from './http.js';

// Person C may call an LLM, so give it more time than the plain data endpoints.
const LLM_TIMEOUT_MS = 45000;

/**
 * POST /api/v1/integration/person_a/guidance: Person C fetches this user's live state from Person B itself and
 * answers from it. Returns Person C's own reply text.
 * @param {object} opts
 * @param {string} opts.question
 * @param {string} [opts.userId]
 * @param {string} [opts.language] – selected UI language code (en/te/hi/kn), defaults to "en"
 * @returns {Promise<{text: string, sourceClass: string, mode: string}>}
 */
export async function getGuidance({ question, userId = getUserId(), language = 'en' }) {
  const { body } = await requestJson(`${getPersonCApiUrl()}/api/v1/integration/person_a/guidance`, {
    method: 'POST',
    body: { user_id: userId, question, request_mode: 'personalized', language },
    timeoutMs: LLM_TIMEOUT_MS,
  });
  return { text: body.response_text, sourceClass: body.source_class, mode: body.mode };
}

/**
 * POST /api/v1/safety/check: Person C's plain-language explanation for a possibly suspicious message.
 * @param {object} opts
 * @param {string} opts.message
 * @param {string} [opts.userId]
 * @param {string} [opts.language] – selected UI language code (en/te/hi/kn), defaults to "en"
 * @returns {Promise<{text: string, sourceClass: string, mode: string}>}
 */
export async function checkSafety({ message, userId = getUserId(), language = 'en' }) {
  const { body } = await requestJson(`${getPersonCApiUrl()}/api/v1/safety/check`, {
    method: 'POST',
    body: { user_id: userId, message, language },
    timeoutMs: LLM_TIMEOUT_MS,
  });
  return { text: body.response_text, sourceClass: body.source_class, mode: body.mode };
}

/**
 * POST /api/v1/ocr/receipt: Person C reads a bill photo (PaddleOCR) and returns { amount, date, raw_text, confidence, ... }.
 * `image` is { uri, mimeType }; the platform adapter attaches the file (a File on native, a Blob on web).
 */
export async function scanReceipt(image) {
  const { appendAudio } = require('./voiceRuntime');
  const form = new FormData();
  await appendAudio(form, 'file', image);
  const response = await fetch(`${getPersonCApiUrl()}/api/v1/ocr/receipt`, { method: 'POST', body: form });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error((body && body.detail) || `Bill scan failed (status ${response.status})`);
  return body;
}
