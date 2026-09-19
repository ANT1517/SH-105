/**
 * Live data first, explicit offline fallback second.
 *
 * Screens load from Person B. Only if that call FAILS do they show the bundled sample data (src/api/fixture.js),
 * and then status is 'offline' so the screen must say so on screen. The fixture is never the default.
 */

/**
 * @template T
 * @param {() => Promise<T>} fetcher live call
 * @param {(() => T) | null} fallback offline sample data factory (null = no fallback: the error is surfaced)
 * @returns {Promise<{status: 'live'|'offline'|'error', data: T|null, error: Error|null}>}
 */
export async function loadWithFallback(fetcher, fallback = null) {
  try {
    return { status: 'live', data: await fetcher(), error: null };
  } catch (error) {
    if (fallback) return { status: 'offline', data: fallback(), error };
    return { status: 'error', data: null, error };
  }
}

export const OFFLINE_BANNER = "Couldn't reach Saathi's servers. Showing offline sample data, not your real balances.";
