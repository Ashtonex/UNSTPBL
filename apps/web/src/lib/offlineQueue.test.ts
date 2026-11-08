import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPendingProfile,
  dropLegacyQueues,
  getPendingProfile,
  getPendingReads,
  profileKey,
  queueProfileEdit,
  queueRead,
  readsKey,
  setPendingReads,
  type QueueStorage,
} from './offlineQueue';

function fakeStorage(): QueueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe('offline queue', () => {
  let storage: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    storage = fakeStorage();
  });

  it('keeps each person\'s queued reads separate (shared phone)', () => {
    queueRead('alice', 'verse-1', storage);
    queueRead('bob', 'verse-2', storage);

    expect(getPendingReads('alice', storage)).toEqual(['verse-1']);
    expect(getPendingReads('bob', storage)).toEqual(['verse-2']);
  });

  it('does not queue the same read twice', () => {
    queueRead('alice', 'verse-1', storage);
    queueRead('alice', 'verse-1', storage);
    expect(getPendingReads('alice', storage)).toEqual(['verse-1']);
  });

  it('removes the key once every read has been sent', () => {
    queueRead('alice', 'verse-1', storage);
    setPendingReads('alice', [], storage);
    expect(storage.data.has(readsKey('alice'))).toBe(false);
  });

  it('keeps only the reads that failed to send', () => {
    queueRead('alice', 'verse-1', storage);
    queueRead('alice', 'verse-2', storage);
    setPendingReads('alice', ['verse-2'], storage);
    expect(getPendingReads('alice', storage)).toEqual(['verse-2']);
  });

  it('keeps each person\'s queued profile edits separate, and later edits win', () => {
    queueProfileEdit('alice', { bio: 'first', phone: '1' }, storage);
    queueProfileEdit('alice', { bio: 'second' }, storage);
    queueProfileEdit('bob', { bio: 'bob bio' }, storage);

    expect(getPendingProfile('alice', storage)).toEqual({ bio: 'second', phone: '1' });
    expect(getPendingProfile('bob', storage)).toEqual({ bio: 'bob bio' });

    clearPendingProfile('alice', storage);
    expect(getPendingProfile('alice', storage)).toEqual({});
    expect(getPendingProfile('bob', storage)).toEqual({ bio: 'bob bio' });
  });

  it('discards the old un-scoped queues, which cannot be attributed to anyone', () => {
    storage.setItem('pending-reads', JSON.stringify(['old-verse']));
    storage.setItem('pending-profile', JSON.stringify({ bio: 'old' }));
    queueRead('alice', 'verse-1', storage);

    dropLegacyQueues(storage);

    expect(storage.getItem('pending-reads')).toBeNull();
    expect(storage.getItem('pending-profile')).toBeNull();
    expect(getPendingReads('alice', storage)).toEqual(['verse-1']); // scoped data is untouched
  });

  it('treats corrupt or wrongly-shaped data as an empty queue instead of throwing', () => {
    storage.setItem(readsKey('alice'), '{not json');
    storage.setItem(profileKey('alice'), JSON.stringify(['not', 'an', 'object']));

    expect(getPendingReads('alice', storage)).toEqual([]);
    expect(getPendingProfile('alice', storage)).toEqual({});

    storage.setItem(readsKey('alice'), JSON.stringify([1, 2, 3]));
    expect(getPendingReads('alice', storage)).toEqual([]);
  });
});
