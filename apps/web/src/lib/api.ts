import { supabase } from './supabase';
import type { DailyVerse, BibleBook } from '@unstpbl/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface AdminStats {
  memberCount: number;
  readRate: number;
}

export const api = {
  getVerseToday: () => apiFetch<DailyVerse>('/verses/today'),
  getVerseHistory: (days = 7) =>
    apiFetch<{ verses: DailyVerse[]; days: number }>(`/verses/history?days=${days}`),
  markAsRead: (verseScheduleId: string) =>
    apiFetch<{ success: boolean }>('/verses/read', {
      method: 'POST',
      body: JSON.stringify({ verseScheduleId }),
    }),
  getAdminBooks: () =>
    apiFetch<{ books: BibleBook[] }>('/admin/books'),
  getAdminStats: () =>
    apiFetch<AdminStats>('/admin/stats'),
  scheduleVerse: (data: { date: string; bookId: number; chapter: number; verseNumber: number }) =>
    apiFetch<{ success: boolean }>('/admin/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

