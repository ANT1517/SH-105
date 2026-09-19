/**
 * Tiny JSON-over-fetch helper shared by the service clients.
 * Every failure is an ApiError so callers can tell "server said no" (status set) from "could not reach it".
 */

export const DEFAULT_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(message, { status = null, body = null, isNetworkError = false, cause = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.isNetworkError = isNetworkError;
    this.cause = cause;
  }
}

/** Best human-readable reason out of a failed response body (Person B: {error}, Person C/FastAPI: {detail}). */
export function describeError(body, status) {
  if (body && typeof body === 'object') {
    if (typeof body.error === 'string') return body.message ? `${body.error}: ${body.message}` : body.error;
    if (typeof body.detail === 'string') return body.detail;
    if (typeof body.message === 'string') return body.message;
  }
  return `request failed with status ${status}`;
}

/**
 * @param {string} url
 * @param {{method?: string, body?: object, timeoutMs?: number, okStatuses?: number[]}} [options]
 *   okStatuses: extra non-2xx statuses the caller wants returned instead of thrown (e.g. 409 duplicate).
 * @returns {Promise<{status: number, body: any}>}
 */
export async function requestJson(url, { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS, okStatuses = [] } = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller ? controller.signal : undefined,
    });
  } catch (cause) {
    throw new ApiError(`Could not reach ${new URL(url).host}`, { isNetworkError: true, cause });
  } finally {
    if (timer) clearTimeout(timer);
  }

  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  if (!response.ok && !okStatuses.includes(response.status)) {
    throw new ApiError(describeError(parsed, response.status), { status: response.status, body: parsed });
  }
  return { status: response.status, body: parsed };
}
