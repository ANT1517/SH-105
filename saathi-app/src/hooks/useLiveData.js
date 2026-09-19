import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { loadWithFallback } from '../services/liveData.js';

/**
 * Loads data from a live fetcher every time the screen gains focus (so a transaction recorded in Chat shows up when
 * you switch tabs). If the live call fails and a `fallback` is given, the result has status 'offline' and the screen
 * MUST say so; without a fallback the failure is surfaced as status 'error'.
 *
 * `fetcher` and `fallback` must be stable references (module-level functions), not inline closures.
 *
 * @returns {{status: 'loading'|'live'|'offline'|'error', data: any, error: Error|null, reload: () => Promise<void>}}
 */
export function useLiveData(fetcher, fallback = null) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  const load = useCallback(async () => {
    const result = await loadWithFallback(fetcher, fallback);
    setState(result);
  }, [fetcher, fallback]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadWithFallback(fetcher, fallback).then((result) => {
        if (!cancelled) setState(result);
      });
      return () => {
        cancelled = true;
      };
    }, [fetcher, fallback]),
  );

  return { ...state, reload: load };
}
