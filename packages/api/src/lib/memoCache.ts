/**
 * Small in-process TTL cache with in-flight de-duplication.
 *
 * Concurrent callers asking for the same key share one load, so a burst of
 * requests (e.g. the fan-out right after login) costs a single upstream call.
 * Loaders choose how long each result lives; a ttlMs of 0 or less means "don't
 * cache this one" (used for failures and degraded results).
 */

export interface MemoLoadResult<V> {
  value: V;
  ttlMs: number;
}

export interface MemoCacheOptions {
  maxEntries?: number;
  now?: () => number;
}

export interface MemoCache<V> {
  getOrLoad(key: string, load: () => Promise<MemoLoadResult<V>>): Promise<V>;
  /** Drops entries matching the predicate, or everything when omitted. */
  invalidate(predicate?: (key: string, value: V) => boolean): void;
  size(): number;
}

export function createMemoCache<V>(options: MemoCacheOptions = {}): MemoCache<V> {
  const maxEntries = options.maxEntries ?? 500;
  const now = options.now ?? Date.now;

  const entries = new Map<string, { value: V; expiresAt: number }>();
  const inflight = new Map<string, Promise<V>>();
  // Bumped on every invalidation so a load that started before it can't
  // write a stale value back into the cache afterwards.
  let epoch = 0;

  function evictOverflow() {
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
  }

  async function getOrLoad(key: string, load: () => Promise<MemoLoadResult<V>>): Promise<V> {
    const hit = entries.get(key);
    if (hit) {
      if (hit.expiresAt > now()) return hit.value;
      entries.delete(key);
    }

    const pending = inflight.get(key);
    if (pending) return pending;

    const startedAtEpoch = epoch;
    const promise = (async () => {
      try {
        const { value, ttlMs } = await load();
        if (ttlMs > 0 && startedAtEpoch === epoch) {
          entries.set(key, { value, expiresAt: now() + ttlMs });
          evictOverflow();
        }
        return value;
      } finally {
        inflight.delete(key);
      }
    })();

    inflight.set(key, promise);
    return promise;
  }

  function invalidate(predicate?: (key: string, value: V) => boolean) {
    epoch += 1;
    if (!predicate) {
      entries.clear();
      return;
    }
    for (const [key, entry] of entries) {
      if (predicate(key, entry.value)) entries.delete(key);
    }
  }

  return { getOrLoad, invalidate, size: () => entries.size };
}
