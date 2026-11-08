import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { useAuthStore } from '../stores/auth';

/**
 * Keeps the last data each person saw on their own device, so the app opens with real content
 * (prayers, favourites, birthdays, ...) straight away, including with no signal at all, instead of
 * a spinner that never ends.
 *
 * Privacy rules, because many families share a phone and the data is stored on the device:
 *  - Only an allow-list of everyday queries is saved. Nothing with phone numbers or private
 *    messages (visitors, text messages, SMS preferences) and none of the leadership dashboards.
 *  - Data is saved and restored per person: when the app starts, only the signed-in person's data
 *    is loaded; anything belonging to someone else is dropped.
 *  - It is wiped when anyone signs out or a different person signs in (see clearPersistedCache).
 */

export const PERSIST_KEY = 'unstpbl-query-cache';

/** How long saved data may be shown. In-memory entries must live at least this long too. */
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Change this when the shape of cached data changes; every device then starts fresh. */
export const PERSIST_BUSTER = 'v1';

/** Query names (the third item of a key, see queryKeys.ts) that are safe to keep on the device. */
const PERSISTED_QUERIES: ReadonlySet<string> = new Set([
  'verse-today',
  'verse-history',
  'related-verses',
  'verse-reflections',
  'user-progress',
  'favorite-verses',
  'prayer-requests',
  'birthdays',
  'circles',
  'weekly-trivia',
  'milestones',
  'sermons',
]);

/** True for a query that may be saved: it is one person's data and on the allow-list. */
export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const [scope, userId, name] = queryKey;
  return scope === 'u' && typeof userId === 'string' && userId !== 'anon' && PERSISTED_QUERIES.has(String(name));
}

/** The saved state with everything that does not belong to `userId` (or is not allowed) removed. */
export function filterClientForUser(client: PersistedClient, userId: string): PersistedClient {
  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries.filter(
        (query) => shouldPersistQuery(query.queryKey) && query.queryKey[1] === userId,
      ),
    },
  };
}

/** localStorage that never throws (private browsing and a full disk both make it throw). */
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* the saved copy is only a convenience */
    }
  },
  removeItem: (key: string): void => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* nothing to remove */
    }
  },
};

/**
 * A persister that only ever restores the signed-in person's data.
 * `getUserId` is read when restoring, so it must answer synchronously.
 */
export function createUserScopedPersister(
  base: Persister,
  getUserId: () => string | null,
): Persister {
  return {
    persistClient: base.persistClient,
    removeClient: base.removeClient,
    restoreClient: async () => {
      const saved = await base.restoreClient();
      if (!saved) return undefined;
      const userId = getUserId();
      if (!userId) {
        await base.removeClient(); // nobody is signed in: nothing of anyone's should stay on the device
        return undefined;
      }
      return filterClientForUser(saved, userId);
    },
  };
}

const syncPersister = createSyncStoragePersister({
  storage: safeStorage,
  key: PERSIST_KEY,
  throttleTime: 1000,
});

export const persister: Persister = createUserScopedPersister(
  syncPersister,
  () => useAuthStore.getState().user?.id ?? null,
);

/** Delete everything saved on this device. Call on sign-out and when a different person signs in. */
export function clearPersistedCache(): void {
  safeStorage.removeItem(PERSIST_KEY);
}
