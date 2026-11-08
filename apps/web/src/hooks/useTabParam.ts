import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** The tab named in the address, or `fallback` when it is missing or not one of `ids`. */
export function resolveTab<T extends string>(raw: string | null, ids: readonly T[], fallback: T): T {
  return raw !== null && (ids as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/**
 * Keeps the selected tab in the address (`/bishop?tab=schedule`), so reloading the page, sharing the
 * link or using the browser's Back button from another page returns to the same tab. Switching tabs
 * replaces the address instead of adding to the history, so Back leaves the page rather than
 * stepping through every tab you touched. The default tab keeps the address clean (no parameter).
 */
export function useTabParam<T extends string>(
  ids: readonly T[],
  fallback: T,
  param = 'tab',
): [T, (id: T) => void] {
  const [params, setParams] = useSearchParams();
  const value = resolveTab(params.get(param), ids, fallback);

  const setValue = useCallback(
    (id: T) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (id === fallback) next.delete(param);
          else next.set(param, id);
          return next;
        },
        { replace: true },
      );
    },
    [setParams, fallback, param],
  );

  return [value, setValue];
}
