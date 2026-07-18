import { supabase } from './supabase';
import type { BirthdayWallPost, DailyVerse, BibleBook, UpcomingBirthday, User } from '@unstpbl/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (!navigator.onLine) {
    throw new Error('Offline');
  }
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

export interface AdminAuditLog {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actorEmail: string;
  actorDisplayName?: string;
}

export interface UserProgress {
  totalReads: number;
  currentStreak: number;
  favoriteCount: number;
  openPrayerCount: number;
  recentReadDates: string[];
}

export interface FavoriteVerse {
  id: string;
  createdAt: string;
  verseId: number;
  text: string;
  chapter: number;
  verseNumber: number;
  translation: string;
  bookName: string;
  bookAbbreviation: string;
}

export interface VerseReflection {
  id: string;
  userId: string;
  verseId: number;
  verseScheduleId?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrayerRequest {
  id: string;
  title: string;
  content: string;
  status: 'open' | 'answered';
  createdAt: string;
  answeredAt?: string;
}

export interface BirthdayFeed {
  wall: BirthdayWallPost[];
  upcoming: UpcomingBirthday[];
}

export const api = {
  getVerseToday: () => apiFetch<DailyVerse>('/verses/today'),
  getVerseHistory: (days = 7) =>
    apiFetch<{ verses: DailyVerse[]; days: number }>(`/verses/history?days=${days}`),
  markAsRead: async (verseScheduleId: string) => {
    try {
      return await apiFetch<{ success: boolean }>('/verses/read', {
        method: 'POST',
        body: JSON.stringify({ verseScheduleId }),
      });
    } catch (err: any) {
      if (!navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('Offline')) {
        console.warn('Offline: Queueing read verse schedule', verseScheduleId);
        const pending = JSON.parse(localStorage.getItem('pending-reads') || '[]');
        if (!pending.includes(verseScheduleId)) {
          pending.push(verseScheduleId);
          localStorage.setItem('pending-reads', JSON.stringify(pending));
        }
        return { success: true };
      }
      throw err;
    }
  },
  getAdminBooks: () =>
    apiFetch<{ books: BibleBook[] }>('/admin/books'),
  getAdminStats: () =>
    apiFetch<AdminStats>('/admin/stats'),
  getAdminStatsTrends: () =>
    apiFetch<{ trends: Array<{ date: string; signups: number; reads: number }> }>('/admin/stats/trends'),
  getAdminStatsTranslations: () =>
    apiFetch<{ translations: Array<{ name: string; value: number }> }>('/admin/stats/translations'),
  getAdminStatsCongregations: () =>
    apiFetch<{ congregations: Array<{ congregation: string; members: number; readsToday: number; readRate: number }> }>('/admin/stats/congregations'),
  getAdminAuditLogs: (limit = 10) =>
    apiFetch<{ logs: AdminAuditLog[] }>(`/admin/audit?limit=${limit}`),
  subscribePush: (subscription: any) =>
    apiFetch<{ success: boolean }>('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
    }),
  unsubscribePush: () =>
    apiFetch<{ success: boolean }>('/push/unsubscribe', {
      method: 'POST',
    }),
  scheduleVerse: (data: { date: string; bookId: number; chapter: number; verseNumber: number; pastoralNote?: string }) =>
    apiFetch<{ success: boolean }>('/admin/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getUserProgress: () =>
    apiFetch<UserProgress>('/me/progress'),
  getFavoriteVerses: () =>
    apiFetch<{ favorites: FavoriteVerse[] }>('/verses/favorites'),
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
    return apiFetch<{ reflections: any[] }>(url);
  },
  createVerseReflection: (data: { verseId: number; verseScheduleId?: string; content: string }) =>
    apiFetch<{ reflection: any }>('/verses/reflections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getPrayerRequests: () =>
    apiFetch<{ prayers: any[] }>('/prayers'),
  getBirthdays: () =>
    apiFetch<BirthdayFeed>('/birthdays'),
  dispatchTodaysBirthdays: () =>
    apiFetch<{ success: boolean; processed: number; created: number; sent: number; failed: number }>('/birthdays/dispatch-today', {
      method: 'POST',
    }),
  createPrayerRequest: (data: { title: string; content: string; type?: string; isAnonymous?: boolean }) =>
    apiFetch<{ prayer: any }>('/prayers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  joinPrayer: (id: string) =>
    apiFetch<{ success: boolean }>(`/prayers/${id}/join`, {
      method: 'POST',
    }),
  leavePrayer: (id: string) =>
    apiFetch<{ success: boolean }>(`/prayers/${id}/join`, {
      method: 'DELETE',
    }),
  markPrayerAnswered: (id: string) =>
    apiFetch<{ prayer: any }>(`/prayers/${id}/answered`, {
      method: 'PUT',
    }),
  schedulePushNotification: (data: { title: string; body: string; url?: string; scheduledFor: string }) =>
    apiFetch<{ notification: any }>('/admin/push/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getScheduledPushNotifications: () =>
    apiFetch<{ notifications: any[] }>('/admin/push/scheduled'),
  dispatchDuePushNotifications: () =>
    apiFetch<{ success: boolean; processed: number; sent: number; failed: number }>('/admin/push/dispatch-due', {
      method: 'POST',
    }),
  syncPendingQueue: async () => {
    if (!navigator.onLine) return;

    // 1. Sync pending reads
    const pendingReads = JSON.parse(localStorage.getItem('pending-reads') || '[]');
    if (pendingReads.length > 0) {
      console.log(`Syncing ${pendingReads.length} pending reads...`);
      const remaining: string[] = [];
      for (const verseScheduleId of pendingReads) {
        try {
          await apiFetch('/verses/read', {
            method: 'POST',
            body: JSON.stringify({ verseScheduleId }),
          });
        } catch (err) {
          console.error(`Failed to sync read for ${verseScheduleId}:`, err);
          remaining.push(verseScheduleId);
        }
      }
      if (remaining.length > 0) {
        localStorage.setItem('pending-reads', JSON.stringify(remaining));
      } else {
        localStorage.removeItem('pending-reads');
      }
    }

    // 2. Sync pending profile
    const pendingProfile = JSON.parse(localStorage.getItem('pending-profile') || '{}');
    if (Object.keys(pendingProfile).length > 0) {
      console.log(`Syncing pending profile changes:`, pendingProfile);
      try {
        await apiFetch('/profile', {
          method: 'PUT',
          body: JSON.stringify(pendingProfile),
        });
        localStorage.removeItem('pending-profile');
      } catch (err) {
        console.error('Failed to sync profile update:', err);
      }
    }
  },
  getProfile: async () => {
    try {
      return await apiFetch<{ profile: User }>('/profile');
    } catch (err: any) {
      console.warn('API /profile failed, falling back to direct Supabase query:', err);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) throw new Error('User session not found. Please log in again.');

        const { data: dbUser, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        if (dbUser) {
          return {
            profile: {
              id: dbUser.id,
              email: dbUser.email,
              role: dbUser.role,
              displayName: dbUser.display_name || undefined,
              congregation: dbUser.congregation || undefined,
              translation: dbUser.translation || 'KJV',
              bio: dbUser.bio || undefined,
              phone: dbUser.phone || undefined,
              location: dbUser.location || undefined,
              birthday: dbUser.birthday || undefined,
              birthdayVisibility: dbUser.birthday_visibility || 'members',
              avatarUrl: dbUser.avatar_url || undefined,
              createdAt: dbUser.created_at,
            }
          };
        }

        // Auto-create profile in Supabase users table if missing
        const { data: newProfile, error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email || '',
            role: 'member',
            translation: 'KJV'
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        if (!newProfile) {
          throw new Error('No profile data returned after creation.');
        }

        return {
          profile: {
            id: newProfile.id,
            email: newProfile.email,
            role: newProfile.role,
            displayName: newProfile.display_name || undefined,
            congregation: newProfile.congregation || undefined,
            translation: newProfile.translation || 'KJV',
            bio: newProfile.bio || undefined,
            phone: newProfile.phone || undefined,
            location: newProfile.location || undefined,
            birthday: newProfile.birthday || undefined,
            birthdayVisibility: newProfile.birthday_visibility || 'members',
            avatarUrl: newProfile.avatar_url || undefined,
            createdAt: newProfile.created_at,
          }
        };
      } catch (subErr: any) {
        console.error('Supabase fallback also failed:', subErr);
        throw new Error('Connection error: Failed to fetch profile. Please check your internet connection or disable any ad-blockers.');
      }
    }
  },
  updateProfile: async (data: {
    displayName?: string;
    congregation?: string;
    translation?: string;
    bio?: string;
    phone?: string;
    location?: string;
    birthday?: string | null;
    birthdayVisibility?: 'members' | 'private';
    avatarUrl?: string;
  }) => {
    try {
      return await apiFetch<{ profile: User }>('/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (!navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('Offline')) {
        console.warn('Offline: Queueing profile update', data);
        const pending = JSON.parse(localStorage.getItem('pending-profile') || '{}');
        const updated = { ...pending, ...data };
        localStorage.setItem('pending-profile', JSON.stringify(updated));

        return {
          profile: {
            id: 'offline-user',
            email: 'offline@user.com',
            role: 'member',
            translation: 'KJV',
            createdAt: new Date().toISOString(),
            ...updated,
          } as any,
        };
      }
      console.warn('API update /profile failed, falling back to direct Supabase update:', err);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) throw new Error('User session not found. Please log in again.');

        const updateData: any = {};
        if (data.displayName !== undefined) updateData.display_name = data.displayName;
        if (data.congregation !== undefined) updateData.congregation = data.congregation;
        if (data.translation !== undefined) updateData.translation = data.translation;
        if (data.bio !== undefined) updateData.bio = data.bio;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.location !== undefined) updateData.location = data.location;
        if (data.birthday !== undefined) updateData.birthday = data.birthday;
        if (data.birthdayVisibility !== undefined) updateData.birthday_visibility = data.birthdayVisibility;
        if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl;

        const { data: updatedProfile, error } = await supabase
          .from('users')
          .upsert({
            id: user.id,
            email: user.email || '',
            ...updateData
          })
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (!updatedProfile) {
          throw new Error('No profile data returned from database.');
        }

        return {
          profile: {
            id: updatedProfile.id,
            email: updatedProfile.email,
            role: updatedProfile.role,
            displayName: updatedProfile.display_name || undefined,
            congregation: updatedProfile.congregation || undefined,
            translation: updatedProfile.translation || 'KJV',
            bio: updatedProfile.bio || undefined,
            phone: updatedProfile.phone || undefined,
            location: updatedProfile.location || undefined,
            birthday: updatedProfile.birthday || undefined,
            birthdayVisibility: updatedProfile.birthday_visibility || 'members',
            avatarUrl: updatedProfile.avatar_url || undefined,
            createdAt: updatedProfile.created_at,
          }
        };
      } catch (subErr: any) {
        console.error('Supabase fallback also failed:', subErr);
        throw new Error('Connection error: Failed to save profile. Please check your internet connection or disable any ad-blockers.');
      }
    }
  },
  getAdminUsersList: () =>
    apiFetch<{ users: Array<{ id: string; email: string; role: string; displayName?: string; congregation?: string; createdAt: string }> }>('/admin/users'),
  updateUserRole: (userId: string, role: 'member' | 'bishop' | 'admin') =>
    apiFetch<{ success: boolean }>(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  searchVerses: (query: string) =>
    apiFetch<{ matches: Array<{ verse: any; book: any; score: number }> }>(`/verses/search?q=${encodeURIComponent(query)}`),
  getRelatedVerses: (verseId: number) =>
    apiFetch<{ related: Array<{ verse: any; book: any; score: number }> }>(`/verses/${verseId}/related`),
  getCircles: () =>
    apiFetch<{ circles: any[] }>('/circles'),
  createCircle: (data: { name: string; description?: string }) =>
    apiFetch<{ circle: any }>('/circles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  joinCircle: (id: string) =>
    apiFetch<{ success: boolean }>(`/circles/${id}/join`, {
      method: 'POST',
    }),
  leaveCircle: (id: string) =>
    apiFetch<{ success: boolean }>(`/circles/${id}/join`, {
      method: 'DELETE',
    }),
  getSermons: () =>
    apiFetch<{ sermons: any[] }>('/sermons'),
  createSermon: (data: { title: string; preacher: string; date: string; outline: string }) =>
    apiFetch<{ sermon: any }>('/sermons', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSermonNotes: (id: string) =>
    apiFetch<{ notes: string }>(`/sermons/${id}/notes`),
  saveSermonNotes: (id: string, notes: string) =>
    apiFetch<{ success: boolean }>(`/sermons/${id}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    }),
  getWeeklyTrivia: () =>
    apiFetch<{ trivia: any[] }>('/trivia/weekly'),
  submitTriviaAnswer: (questionId: string, selectedOptionIndex: number) =>
    apiFetch<{ success: boolean; isCorrect: boolean; correctOptionIndex: number; explanation?: string }>('/trivia/submit', {
      method: 'POST',
      body: JSON.stringify({ questionId, selectedOptionIndex }),
    }),
  createTriviaQuestion: (data: { question: string; options: string[]; correctOptionIndex: number; explanation?: string; weekDate: string }) =>
    apiFetch<{ trivia: any }>('/admin/trivia', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMilestones: () =>
    apiFetch<{ totalReads: number; milestones: any[] }>('/stats/milestones'),
};
