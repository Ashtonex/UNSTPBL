import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { users, eq } from '@unstpbl/db';
import type { UserRole } from '@unstpbl/shared';
import { db } from './db.js';
import { createMemoCache } from './memoCache.js';

export interface ResolvedAuth {
  id: string;
  email: string;
  role: UserRole;
  translation: string;
  /** Set when the users-table lookup failed and defaults were substituted. Never cached. */
  degraded?: boolean;
}

// Role changes are applied through invalidateAuthForUser(), so this only bounds
// how stale an out-of-band change (e.g. a manual DB edit) can be.
const AUTH_CACHE_TTL_MS = 60_000;

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('Missing Supabase configuration');
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

/** Milliseconds-since-epoch expiry from a JWT's `exp` claim, or null if unreadable. */
export function tokenExpiryMs(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function loadAuth(token: string): Promise<ResolvedAuth | null> {
  const {
    data: { user },
    error,
  } = await getSupabaseClient().auth.getUser(token);
  if (error || !user) return null;

  const base = { id: user.id, email: user.email || '' };
  try {
    const rows = await db
      .select({ role: users.role, translation: users.translation })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    return {
      ...base,
      role: (rows[0]?.role as UserRole) || 'member',
      translation: rows[0]?.translation || 'KJV',
    };
  } catch (err) {
    console.error('Failed to load user role/translation, using defaults:', err);
    return { ...base, role: 'member', translation: 'KJV', degraded: true };
  }
}

const authCache = createMemoCache<ResolvedAuth | null>({ maxEntries: 500 });

/**
 * Resolves a bearer token to the authenticated user plus their role and
 * preferred translation, or null for an invalid/expired token. Results are
 * cached briefly (never past the token's own expiry) and concurrent lookups
 * for the same token share one Supabase call.
 */
export function resolveAuth(token: string): Promise<ResolvedAuth | null> {
  return authCache.getOrLoad(token, async () => {
    const value = await loadAuth(token);
    if (!value || value.degraded) return { value, ttlMs: 0 };

    const expiresAt = tokenExpiryMs(token);
    if (expiresAt === null) return { value, ttlMs: 0 };
    return { value, ttlMs: Math.min(AUTH_CACHE_TTL_MS, expiresAt - Date.now()) };
  });
}

/** Call after changing a user's role or translation so the next request sees it. */
export function invalidateAuthForUser(userId: string): void {
  authCache.invalidate((_key, value) => value?.id === userId);
}
