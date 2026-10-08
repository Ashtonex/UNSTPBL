import { sql } from '@unstpbl/db';
import { db } from './db.js';
import { warmTodayVerseCache } from '../routes/verses.js';

/**
 * Pays the one-off costs (database connection + TLS handshake, today's verse
 * lookup) right after boot instead of on the first user's request. Best effort:
 * a failure here must never stop the server, real requests will just do the
 * work themselves.
 */
export async function warmUp(): Promise<void> {
  const startedAt = Date.now();
  try {
    await db.execute(sql`select 1`);
    await warmTodayVerseCache();
    console.log(`Warm-up finished in ${Date.now() - startedAt}ms`);
  } catch (err) {
    console.warn('Warm-up skipped:', err instanceof Error ? err.message : err);
  }
}
