import { useMemo } from 'react';
import { useAuthStore } from '../stores/auth';

/**
 * Every React Query key in the app is made here, in one place.
 *
 * Why it matters:
 *  - Keys used to be string literals typed by hand in 12 files, with 49 places refreshing them. A
 *    typo in any of them silently did nothing. Now a wrong name is a compile error.
 *  - Every key starts with ['u', <who is signed in>]. Almost everything the app shows is specific to
 *    a person (their translation, favourites, which prayers they joined...), so data cached for one
 *    person can never be read as another person's, even if the cache were not cleared on sign-out.
 *  - `keys.all` refreshes or clears everything belonging to the current person at once.
 *
 * Call useQueryKeys() inside a component, then:  useQuery({ queryKey: keys.prayerRequests(), ... })
 * and  queryClient.invalidateQueries({ queryKey: keys.prayerRequests() })
 */
export function createQueryKeys(userId: string | null) {
  const scope = ['u', userId ?? 'anon'] as const;
  const key = <const T extends readonly unknown[]>(...parts: T) => [...scope, ...parts] as const;

  return {
    all: scope,

    // Daily verse and reading
    verseToday: () => key('verse-today'),
    verseHistory: () => key('verse-history'),
    relatedVerses: (verseId: number | undefined) => key('related-verses', verseId),
    semanticSearch: (text: string) => key('semantic-search', text),
    userProgress: () => key('user-progress'),
    favoriteVerses: () => key('favorite-verses'),
    verseReflections: (scheduleId: string | undefined) => key('verse-reflections', scheduleId),

    // Community
    prayerRequests: () => key('prayer-requests'),
    birthdays: () => key('birthdays'),
    circles: () => key('circles'),
    weeklyTrivia: () => key('weekly-trivia'),
    milestones: () => key('milestones'),
    sermons: () => key('sermons'),
    sermonNotes: (sermonId: string | undefined) => key('sermon-notes', sermonId),

    // Texts and visitors
    messagingStatus: () => key('messaging-status'),
    messageLog: () => key('message-log'),
    savedMessages: () => key('saved-messages'),
    messageTemplates: () => key('message-templates'),
    smsPreferences: () => key('sms-preferences'),
    /** With a search term this is one search; with none it matches every visitors query (for refreshing). */
    visitors: (search?: string) => (search === undefined ? key('visitors') : key('visitors', search)),

    // Leadership
    adminUsers: () => key('admin-users'),
    adminAudit: () => key('admin-audit'),
    adminStats: () => key('admin-stats'),
    adminStatsTrends: () => key('admin-stats-trends'),
    adminStatsTranslations: () => key('admin-stats-translations'),
    adminStatsCongregations: () => key('admin-stats-congregations'),
    adminBooks: () => key('admin-books'),
    scheduledPushNotifications: () => key('scheduled-push-notifications'),
  };
}

export type QueryKeys = ReturnType<typeof createQueryKeys>;

/** The query keys for whoever is signed in right now. Rebuilt when the signed-in person changes. */
export function useQueryKeys(): QueryKeys {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  return useMemo(() => createQueryKeys(userId), [userId]);
}
