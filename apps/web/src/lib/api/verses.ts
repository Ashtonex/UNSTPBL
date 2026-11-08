// Daily verse, reading, search, favourites, reflections and personal progress.
import { NetworkError } from '../errors';
import {
  queueRead,
} from '../offlineQueue';
import { apiFetch, currentUserId } from './client';
import { cleanVerseText } from '@unstpbl/shared';
import type {
  DailyVerse,
  VerseMatch,
  VerseReflection,
} from '@unstpbl/shared';
import type { UserProgress, FavoriteVerse } from './types';

// Bible APIs return text with translator braces, margin notes and hard line breaks;
// clean it once here so every screen (card, search, history, favorites) reads well.
const cleanDailyVerse = (daily: DailyVerse): DailyVerse => ({
  ...daily,
  verse: { ...daily.verse, text: cleanVerseText(daily.verse.text) },
});
const cleanVerseMatch = <T extends { verse: { text: string } }>(match: T): T => ({
  ...match,
  verse: { ...match.verse, text: cleanVerseText(match.verse.text) },
});

export const versesApi = {
  getVerseToday: () => apiFetch<DailyVerse>('/verses/today').then(cleanDailyVerse),
  getVerseHistory: (days = 7) =>
    apiFetch<{ verses: DailyVerse[]; days: number }>(`/verses/history?days=${days}`).then((r) => ({
      ...r,
      verses: r.verses.map(cleanDailyVerse),
    })),
  markAsRead: async (verseScheduleId: string) => {
    try {
      return await apiFetch<{ success: boolean }>('/verses/read', {
        method: 'POST',
        body: JSON.stringify({ verseScheduleId }),
      });
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err;
      const userId = await currentUserId();
      if (!userId) throw err;
      // Offline: remember it for this person only, and send it once they are back online.
      queueRead(userId, verseScheduleId, localStorage);
      return { success: true };
    }
  },
  getUserProgress: () =>
    apiFetch<UserProgress>('/me/progress'),
  getFavoriteVerses: () =>
    apiFetch<{ favorites: FavoriteVerse[] }>('/verses/favorites').then((r) => ({
      ...r,
      favorites: r.favorites.map((favorite) => ({ ...favorite, text: cleanVerseText(favorite.text) })),
    })),
  addFavoriteVerse: (verseId: number) =>
    apiFetch<{ success: boolean }>('/verses/favorites', {
      method: 'POST',
      body: JSON.stringify({ verseId }),
    }),
  removeFavoriteVerse: (verseId: number) =>
    apiFetch<{ success: boolean }>(`/verses/favorites/${verseId}`, {
      method: 'DELETE',
    }),
  getVerseReflections: (verseId?: number, verseScheduleId?: string) => {
    let url = '/verses/reflections';
    const params: string[] = [];
    if (verseId) params.push(`verseId=${verseId}`);
    if (verseScheduleId) params.push(`verseScheduleId=${verseScheduleId}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return apiFetch<{ reflections: VerseReflection[] }>(url);
  },
  createVerseReflection: (data: { verseId: number; verseScheduleId?: string; content: string }) =>
    apiFetch<{ reflection: VerseReflection }>('/verses/reflections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  searchVerses: (query: string) =>
    apiFetch<{ matches: VerseMatch[] }>(`/verses/search?q=${encodeURIComponent(query)}`).then(
      (r) => ({ ...r, matches: r.matches.map(cleanVerseMatch) }),
    ),
  getRelatedVerses: (verseId: number) =>
    apiFetch<{ related: VerseMatch[] }>(`/verses/${verseId}/related`).then((r) => ({
      ...r,
      related: r.related.map(cleanVerseMatch),
    })),
};
