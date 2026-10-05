import { describe, expect, it, vi } from 'vitest';
import { createMemoCache } from './memoCache.js';
import { tokenExpiryMs } from './authCache.js';

function makeClock(start = 1_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('memoCache', () => {
  it('serves repeat lookups from cache until the entry expires', async () => {
    const clock = makeClock();
    const cache = createMemoCache<string>({ now: clock.now });
    const load = vi.fn(async () => ({ value: 'v', ttlMs: 1_000 }));

    await cache.getOrLoad('k', load);
    await cache.getOrLoad('k', load);
    expect(load).toHaveBeenCalledTimes(1);

    clock.advance(1_001);
    await cache.getOrLoad('k', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shares one load between concurrent callers', async () => {
    const cache = createMemoCache<number>();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const load = vi.fn(async () => {
      await gate;
      return { value: 42, ttlMs: 1_000 };
    });

    const calls = [cache.getOrLoad('k', load), cache.getOrLoad('k', load), cache.getOrLoad('k', load)];
    release();

    expect(await Promise.all(calls)).toEqual([42, 42, 42]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not cache results with a non-positive ttl', async () => {
    const cache = createMemoCache<string>();
    const load = vi.fn(async () => ({ value: 'v', ttlMs: 0 }));

    await cache.getOrLoad('k', load);
    await cache.getOrLoad('k', load);
    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.size()).toBe(0);
  });

  it('does not cache failures and lets the next caller retry', async () => {
    const cache = createMemoCache<string>();
    const load = vi
      .fn<() => Promise<{ value: string; ttlMs: number }>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ value: 'ok', ttlMs: 1_000 });

    await expect(cache.getOrLoad('k', load)).rejects.toThrow('boom');
    await expect(cache.getOrLoad('k', load)).resolves.toBe('ok');
  });

  it('invalidates only entries matching the predicate', async () => {
    const cache = createMemoCache<{ id: string }>();
    await cache.getOrLoad('a', async () => ({ value: { id: 'u1' }, ttlMs: 1_000 }));
    await cache.getOrLoad('b', async () => ({ value: { id: 'u2' }, ttlMs: 1_000 }));

    cache.invalidate((_key, value) => value.id === 'u1');
    expect(cache.size()).toBe(1);

    cache.invalidate();
    expect(cache.size()).toBe(0);
  });

  it('drops a load that was already in flight when invalidate() ran', async () => {
    const cache = createMemoCache<string>();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));

    const stale = cache.getOrLoad('k', async () => {
      await gate;
      return { value: 'stale', ttlMs: 1_000 };
    });
    cache.invalidate();
    release();
    await stale;

    expect(cache.size()).toBe(0);
    await expect(cache.getOrLoad('k', async () => ({ value: 'fresh', ttlMs: 1_000 }))).resolves.toBe('fresh');
  });

  it('evicts the oldest entry once maxEntries is exceeded', async () => {
    const cache = createMemoCache<string>({ maxEntries: 2 });
    const load = (value: string) => async () => ({ value, ttlMs: 1_000 });
    await cache.getOrLoad('a', load('a'));
    await cache.getOrLoad('b', load('b'));
    await cache.getOrLoad('c', load('c'));

    expect(cache.size()).toBe(2);
    const reload = vi.fn(load('a2'));
    await cache.getOrLoad('a', reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('tokenExpiryMs', () => {
  const jwt = (payload: object) =>
    `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;

  it('reads exp from the JWT payload in milliseconds', () => {
    expect(tokenExpiryMs(jwt({ exp: 1_700_000_000 }))).toBe(1_700_000_000_000);
  });

  it('returns null for tokens it cannot read, so they are never cached', () => {
    expect(tokenExpiryMs('not-a-jwt')).toBeNull();
    expect(tokenExpiryMs(jwt({ sub: 'no-exp' }))).toBeNull();
  });
});
