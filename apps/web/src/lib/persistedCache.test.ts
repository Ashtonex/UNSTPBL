import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { describe, expect, it, vi } from 'vitest';
import { createQueryKeys } from './queryKeys';
import { createUserScopedPersister, filterClientForUser, shouldPersistQuery } from './persistedCache';

// persistedCache imports the auth store, which touches localStorage when it loads.
vi.mock('../stores/auth', () => ({ useAuthStore: { getState: () => ({ user: null }) } }));

const alice = createQueryKeys('alice');
const bob = createQueryKeys('bob');

function clientWith(...keys: ReadonlyArray<readonly unknown[]>): PersistedClient {
  return {
    timestamp: 1,
    buster: 'v1',
    clientState: {
      mutations: [],
      queries: keys.map((queryKey) => ({
        queryKey: [...queryKey],
        queryHash: JSON.stringify(queryKey),
        state: { data: 'x' } as never,
      })),
    },
  };
}

describe('shouldPersistQuery', () => {
  it('saves everyday data that belongs to a signed-in person', () => {
    expect(shouldPersistQuery(alice.prayerRequests())).toBe(true);
    expect(shouldPersistQuery(alice.favoriteVerses())).toBe(true);
    expect(shouldPersistQuery(alice.verseToday())).toBe(true);
    expect(shouldPersistQuery(alice.birthdays())).toBe(true);
    expect(shouldPersistQuery(alice.verseReflections('s1'))).toBe(true);
  });

  it('never saves anything with phone numbers, private messages or leadership dashboards', () => {
    expect(shouldPersistQuery(alice.visitors())).toBe(false);
    expect(shouldPersistQuery(alice.visitors('john'))).toBe(false);
    expect(shouldPersistQuery(alice.messageLog())).toBe(false);
    expect(shouldPersistQuery(alice.savedMessages())).toBe(false);
    expect(shouldPersistQuery(alice.messageTemplates())).toBe(false);
    expect(shouldPersistQuery(alice.smsPreferences())).toBe(false);
    expect(shouldPersistQuery(alice.messagingStatus())).toBe(false);
    expect(shouldPersistQuery(alice.adminUsers())).toBe(false);
    expect(shouldPersistQuery(alice.adminStats())).toBe(false);
    expect(shouldPersistQuery(alice.adminAudit())).toBe(false);
    expect(shouldPersistQuery(alice.scheduledPushNotifications())).toBe(false);
    expect(shouldPersistQuery(alice.semanticSearch('grace'))).toBe(false);
    expect(shouldPersistQuery(alice.sermonNotes('a'))).toBe(false);
  });

  it('does not save data that is not tied to a person', () => {
    expect(shouldPersistQuery(createQueryKeys(null).prayerRequests())).toBe(false);
    expect(shouldPersistQuery(['prayer-requests'])).toBe(false);
    expect(shouldPersistQuery([])).toBe(false);
  });
});

describe('filterClientForUser', () => {
  it('keeps only the signed-in person\'s allowed queries', () => {
    const saved = clientWith(
      alice.prayerRequests(),
      alice.userProgress(),
      bob.prayerRequests(), // someone else's
      alice.visitors(), // not allowed, even though it is Alice's
    );

    const kept = filterClientForUser(saved, 'alice').clientState.queries.map((q) => q.queryKey[2]);
    expect(kept).toEqual(['prayer-requests', 'user-progress']);
  });

  it('keeps nothing for a person who has no saved data', () => {
    expect(filterClientForUser(clientWith(alice.prayerRequests()), 'carol').clientState.queries).toEqual([]);
  });
});

describe('createUserScopedPersister', () => {
  function fakeBase(saved: PersistedClient | undefined) {
    const removed = vi.fn();
    const base: Persister = {
      persistClient: vi.fn(),
      removeClient: removed,
      restoreClient: async () => saved,
    };
    return { base, removed };
  }

  it('restores only the signed-in person\'s data', async () => {
    const { base } = fakeBase(clientWith(alice.prayerRequests(), bob.prayerRequests()));
    const restored = await createUserScopedPersister(base, () => 'bob').restoreClient();
    expect(restored?.clientState.queries.map((q) => q.queryKey[1])).toEqual(['bob']);
  });

  it('restores nothing, and deletes what was saved, when nobody is signed in', async () => {
    const { base, removed } = fakeBase(clientWith(alice.prayerRequests()));
    const restored = await createUserScopedPersister(base, () => null).restoreClient();
    expect(restored).toBeUndefined();
    expect(removed).toHaveBeenCalledTimes(1);
  });

  it('restores nothing when nothing was saved', async () => {
    const { base, removed } = fakeBase(undefined);
    expect(await createUserScopedPersister(base, () => 'alice').restoreClient()).toBeUndefined();
    expect(removed).not.toHaveBeenCalled();
  });
});
