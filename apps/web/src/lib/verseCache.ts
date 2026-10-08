import type { DailyVerse } from '@unstpbl/shared';

/**
 * Keeps today's verse on the device so the home screen can paint immediately on
 * a repeat visit while the fresh copy loads in the background. This matters most
 * when the API is waking from sleep and the request takes a long time.
 *
 * Only a verse for *today*, for the *same user* (translation is per user), is
 * ever reused, and the built-in fallback verse is never stored.
 */

const STORAGE_KEY = 'unstpbl_verse_today_v1';
const CHURCH_TIMEZONE = 'Africa/Harare';

interface StoredVerse {
  userId: string;
  date: string;
  savedAt: number;
  verse: DailyVerse;
}

export function todayInChurchTimezone(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHURCH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function readCachedVerse(userId: string | undefined): StoredVerse | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredVerse;
    const usable =
      stored.userId === userId &&
      stored.date === todayInChurchTimezone() &&
      stored.verse?.schedule?.id &&
      stored.verse.schedule.id !== 'fallback' &&
      typeof stored.verse.verse?.text === 'string';
    return usable ? stored : null;
  } catch {
    return null;
  }
}

export function saveCachedVerse(userId: string | undefined, verse: DailyVerse): void {
  if (!userId || !verse?.schedule?.id || verse.schedule.id === 'fallback') return;
  try {
    // Keyed by the date the verse is *for* (not the clock), so a stale verse served
    // from an offline/HTTP cache can never be passed off as today's.
    const stored: StoredVerse = { userId, date: verse.schedule.date, savedAt: Date.now(), verse };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* storage full or unavailable: the cache is only an optimisation */
  }
}
