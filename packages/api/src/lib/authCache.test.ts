import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
const dbRows = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser } }),
}));

vi.mock('./db.js', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: () => dbRows() }) }) }),
  },
}));

const { resolveAuth, invalidateAuthForUser } = await import('./authCache.js');

const futureToken = (tag: string) =>
  `h.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, tag })).toString('base64url')}.s`;

describe('resolveAuth', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';
    getUser.mockReset();
    dbRows.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c' } }, error: null });
    dbRows.mockResolvedValue([{ role: 'bishop', translation: 'ESV' }]);
  });

  it('returns role and translation and skips Supabase on repeat calls', async () => {
    const token = futureToken('repeat');

    const first = await resolveAuth(token);
    const second = await resolveAuth(token);

    expect(first).toEqual({ id: 'u1', email: 'a@b.c', role: 'bishop', translation: 'ESV' });
    expect(second).toEqual(first);
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(dbRows).toHaveBeenCalledTimes(1);
  });

  it('shares one lookup across the burst of requests made right after login', async () => {
    const token = futureToken('burst');

    await Promise.all([resolveAuth(token), resolveAuth(token), resolveAuth(token), resolveAuth(token)]);

    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('refetches after invalidateAuthForUser so role/translation changes apply immediately', async () => {
    const token = futureToken('invalidate');
    await resolveAuth(token);

    dbRows.mockResolvedValue([{ role: 'member', translation: 'KJV' }]);
    invalidateAuthForUser('u1');
    const after = await resolveAuth(token);

    expect(after).toMatchObject({ role: 'member', translation: 'KJV' });
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it('returns null for an invalid token and does not cache it', async () => {
    const token = futureToken('invalid');
    getUser.mockResolvedValue({ data: { user: null }, error: new Error('bad jwt') });

    expect(await resolveAuth(token)).toBeNull();
    expect(await resolveAuth(token)).toBeNull();
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it('falls back to member/KJV when the users lookup fails, without caching the fallback', async () => {
    const token = futureToken('degraded');
    dbRows.mockRejectedValueOnce(new Error('db down'));

    expect(await resolveAuth(token)).toMatchObject({ role: 'member', translation: 'KJV' });

    // DB recovers: the next request must see the real role, not a cached downgrade.
    expect(await resolveAuth(token)).toMatchObject({ role: 'bishop', translation: 'ESV' });
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it('does not cache tokens whose expiry cannot be read', async () => {
    await resolveAuth('opaque-token');
    await resolveAuth('opaque-token');
    expect(getUser).toHaveBeenCalledTimes(2);
  });
});
