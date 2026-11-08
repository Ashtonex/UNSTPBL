/**
 * Things done while offline (marking a verse read, editing the profile) wait here until the app
 * is online again.
 *
 * Every queue belongs to ONE signed-in person: it is stored under a key that includes their user
 * ID and is only ever sent while that same person is signed in. Many families share a phone, so
 * a queue that was not tied to a person could be sent under the next person's login: their
 * account would be marked as having read verses they did not read, or have its profile
 * overwritten with someone else's edits.
 *
 * Pure functions over a Storage so they can be unit tested without a browser.
 */

export interface QueueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The old, un-scoped keys. They cannot be attributed to anyone, so they are discarded. */
const LEGACY_KEYS = ['pending-reads', 'pending-profile'];

export const readsKey = (userId: string) => `pending-reads:${userId}`;
export const profileKey = (userId: string) => `pending-profile:${userId}`;

function parse<T>(raw: string | null, fallback: T, valid: (value: unknown) => value is T): T {
  if (!raw) return fallback;
  try {
    const value: unknown = JSON.parse(raw);
    return valid(value) ? value : fallback;
  } catch {
    return fallback; // corrupt data must never break syncing
  }
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Forget queues written by older versions of the app, which were not tied to a person. */
export function dropLegacyQueues(storage: QueueStorage): void {
  for (const key of LEGACY_KEYS) storage.removeItem(key);
}

// ── Verse reads ───────────────────────────────────────────────────────────────

export function getPendingReads(userId: string, storage: QueueStorage): string[] {
  return parse(storage.getItem(readsKey(userId)), [], isStringArray);
}

export function queueRead(userId: string, verseScheduleId: string, storage: QueueStorage): void {
  const pending = getPendingReads(userId, storage);
  if (pending.includes(verseScheduleId)) return;
  storage.setItem(readsKey(userId), JSON.stringify([...pending, verseScheduleId]));
}

export function setPendingReads(userId: string, remaining: string[], storage: QueueStorage): void {
  if (remaining.length === 0) storage.removeItem(readsKey(userId));
  else storage.setItem(readsKey(userId), JSON.stringify(remaining));
}

// ── Profile edits ─────────────────────────────────────────────────────────────

export function getPendingProfile(userId: string, storage: QueueStorage): Record<string, unknown> {
  return parse(storage.getItem(profileKey(userId)), {}, isRecord);
}

/** Later edits win over earlier ones for the same field. */
export function queueProfileEdit(userId: string, edit: Record<string, unknown>, storage: QueueStorage): void {
  const merged = { ...getPendingProfile(userId, storage), ...edit };
  storage.setItem(profileKey(userId), JSON.stringify(merged));
}

export function clearPendingProfile(userId: string, storage: QueueStorage): void {
  storage.removeItem(profileKey(userId));
}
