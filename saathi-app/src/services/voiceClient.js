/**
 * Speech-to-text for the mic button: uploads the recording to Dev-A's POST /api/transcribe, which runs the SAME
 * Whisper model the WhatsApp voice-note path uses. It only transcribes; the transcript then goes through the normal
 * message routing (safety check first, then Person B / Person C), exactly like typed text.
 */
import { getVoiceApiUrl } from './apiConfig.js';
import { ApiError, describeError } from './http.js';

// The first request after Dev-A starts loads the Whisper model, so allow a generous timeout.
export const TRANSCRIBE_TIMEOUT_MS = 60000;

/**
 * Standard (web / test) way to attach the recording: read the blob: URL the browser recorder gives and add it as a
 * named Blob. On a phone this is replaced by voiceRuntime.native.js (see that file for why).
 */
export async function appendAudioStandard(form, field, { uri, fileName }) {
  const fetched = await fetch(uri);
  form.append(field, await fetched.blob(), fileName);
}

/** File name + MIME type for a recording uri (native records .m4a, the web records a webm blob: URL). */
export function guessAudioMeta(uri = '') {
  const ext = (uri.split('?')[0].match(/\.([a-z0-9]+)$/i) || [])[1];
  const byExt = { m4a: 'audio/m4a', mp4: 'audio/mp4', '3gp': 'audio/3gpp', webm: 'audio/webm', wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg', aac: 'audio/aac' };
  if (ext && byExt[ext.toLowerCase()]) return { fileName: `voice.${ext.toLowerCase()}`, mimeType: byExt[ext.toLowerCase()] };
  if (uri.startsWith('blob:')) return { fileName: 'voice.webm', mimeType: 'audio/webm' };
  return { fileName: 'voice.m4a', mimeType: 'audio/m4a' };
}

/**
 * @param {{uri?: string, blob?: Blob, fileName?: string, mimeType?: string}} audio
 * @param {{appendAudio?: (form: FormData, field: string, audio: object) => Promise<void>}} [options]
 *   appendAudio: how to attach the recording to the form. Screens pass the platform adapter from
 *   ../services/voiceRuntime (a File on native); the default is the standard web/Blob way.
 * @returns {Promise<string>} the transcript ('' if nothing intelligible was heard)
 */
export async function transcribeAudio({ uri, blob, fileName = 'voice.m4a', mimeType = 'audio/m4a' }, { appendAudio = appendAudioStandard } = {}) {
  const form = new FormData();
  if (blob) {
    form.append('audio', blob, fileName);
  } else {
    await appendAudio(form, 'audio', { uri, fileName, mimeType });
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS) : null;
  let response;
  const url = `${getVoiceApiUrl()}/api/transcribe`;
  try {
    // No Content-Type header: fetch adds the multipart boundary itself.
    response = await fetch(url, { method: 'POST', body: form, signal: controller ? controller.signal : undefined });
  } catch (cause) {
    // Name the address and the underlying error, so "phone can't reach the PC" (firewall / wrong URL / timeout)
    // is distinguishable from an upload problem.
    const why = cause && cause.name === 'AbortError' ? `timed out after ${TRANSCRIBE_TIMEOUT_MS / 1000}s` : (cause && cause.message) || 'unknown network error';
    throw new ApiError(`Could not reach the speech service at ${url} (${why})`, { isNetworkError: true, cause });
  } finally {
    if (timer) clearTimeout(timer);
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) throw new ApiError(describeError(body, response.status), { status: response.status, body });
  return typeof body.transcript === 'string' ? body.transcript.trim() : '';
}
