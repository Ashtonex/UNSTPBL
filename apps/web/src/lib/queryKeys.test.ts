import { describe, expect, it } from 'vitest';
import { createQueryKeys } from './queryKeys';

describe('query keys', () => {
  it('never share a key between two people', () => {
    const alice = createQueryKeys('alice');
    const bob = createQueryKeys('bob');

    expect(alice.userProgress()).not.toEqual(bob.userProgress());
    expect(alice.prayerRequests()).not.toEqual(bob.prayerRequests());
    expect(alice.verseReflections('s1')).not.toEqual(bob.verseReflections('s1'));
  });

  it('start with the signed-in person, so keys.all matches everything they own', () => {
    const keys = createQueryKeys('alice');
    expect(keys.all).toEqual(['u', 'alice']);
    expect(keys.userProgress().slice(0, 2)).toEqual(keys.all);
    expect(keys.adminUsers().slice(0, 2)).toEqual(keys.all);
  });

  it('use a separate scope when nobody is signed in', () => {
    expect(createQueryKeys(null).all).toEqual(['u', 'anon']);
  });

  it('give every query its own name', () => {
    const keys = createQueryKeys('alice');
    const names = [
      keys.verseToday(), keys.verseHistory(), keys.userProgress(), keys.favoriteVerses(),
      keys.prayerRequests(), keys.birthdays(), keys.circles(), keys.weeklyTrivia(), keys.milestones(),
      keys.sermons(), keys.messagingStatus(), keys.messageLog(), keys.savedMessages(),
      keys.messageTemplates(), keys.smsPreferences(), keys.adminUsers(), keys.adminAudit(),
      keys.adminStats(), keys.adminStatsTrends(), keys.adminStatsTranslations(),
      keys.adminStatsCongregations(), keys.adminBooks(), keys.scheduledPushNotifications(),
    ].map((k) => JSON.stringify(k));
    expect(new Set(names).size).toBe(names.length);
  });

  it('include the parameters that make a query different', () => {
    const keys = createQueryKeys('alice');
    expect(keys.relatedVerses(1)).not.toEqual(keys.relatedVerses(2));
    expect(keys.semanticSearch('grace')).not.toEqual(keys.semanticSearch('mercy'));
    expect(keys.sermonNotes('a')).not.toEqual(keys.sermonNotes('b'));
  });

  it('lets a bare visitors() refresh every visitors search', () => {
    const keys = createQueryKeys('alice');
    const prefix = keys.visitors();
    const search = keys.visitors('john');
    // TanStack matches a key whose leading items equal the invalidated key.
    expect(search.slice(0, prefix.length)).toEqual(prefix);
    expect(keys.visitors('')).not.toEqual(prefix);
  });
});
