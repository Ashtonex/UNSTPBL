import { Hono } from 'hono';
import { sql } from '@unstpbl/db';
import { db } from '../lib/db.js';
import { getSupabaseClient } from '../lib/authCache.js';
import { createRateLimit } from '../middleware/rateLimit.js';

export const healthRoutes = new Hono();

/**
 * Liveness only. The host's health check hits this, so it must never depend on
 * the database or Supabase being up (a blip there would get the service killed).
 */
healthRoutes.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'unstpbl-api',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

type CheckResult = 'ok' | string;

/**
 * Reduces an error to a category that is safe to show publicly. Never returns
 * the message itself: supabase-js/fetch errors can echo header values (keys).
 */
function describeError(err: unknown): string {
  const e = err as { name?: string; message?: string; cause?: { code?: string } } | null;
  const message = (e?.message || '').toLowerCase();
  const causeCode = e?.cause?.code;
  if (causeCode && /^(ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|CERT_|ERR_TLS)/.test(causeCode)) {
    return causeCode;
  }
  if (message.includes('supabaseurl')) return 'supabase-url-rejected';
  if (message.includes('supabasekey')) return 'supabase-key-rejected';
  if (message.includes('header')) return 'invalid-header-value (check for stray spaces/newlines in the key)';
  return e?.name || 'unknown-error';
}

/**
 * Readiness: checks the things a logged-in request actually needs. Reports
 * coarse statuses only (never URLs, keys or error text) so it is safe to leave
 * public, and is rate limited because each hit makes real upstream calls.
 */
healthRoutes.get(
  '/health/deep',
  createRateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'health-deep' }),
  async (c) => {
    const checks: Record<string, CheckResult> = {
      database: 'ok',
      supabaseConfig: 'ok',
      supabaseAuth: 'ok',
    };

    try {
      await db.execute(sql`select 1`);
    } catch {
      checks.database = 'error';
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      checks.supabaseConfig = 'missing';
    } else {
      try {
        const { protocol } = new URL(url);
        if (protocol !== 'https:' && protocol !== 'http:') checks.supabaseConfig = 'url-not-http';
      } catch {
        checks.supabaseConfig = 'invalid-url';
      }
    }

    if (checks.supabaseConfig === 'ok') {
      try {
        // Only succeeds with a valid service-role key for the right project.
        const { error } = await getSupabaseClient().auth.admin.listUsers({ page: 1, perPage: 1 });
        if (error) {
          checks.supabaseAuth =
            error.status === 401 || error.status === 403
              ? 'bad-service-key'
              : `error (status ${error.status ?? 'none'}, ${error.name})`;
        }
      } catch (err) {
        checks.supabaseAuth = `unreachable: ${describeError(err)}`;
      }
    } else {
      checks.supabaseAuth = 'skipped';
    }

    const healthy = Object.values(checks).every((value) => value === 'ok');
    return c.json({ status: healthy ? 'ok' : 'degraded', checks }, healthy ? 200 : 503);
  },
);
