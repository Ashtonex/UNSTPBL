import { supabase } from './supabase';
import type { DailyVerse, BibleBook, User } from '@unstpbl/shared';

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
  subscribePush: (subscription: any) =>
    apiFetch<{ success: boolean }>('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
    }),
  unsubscribePush: () =>
    apiFetch<{ success: boolean }>('/push/unsubscribe', {
      method: 'POST',
    }),
  scheduleVerse: (data: { date: string; bookId: number; chapter: number; verseNumber: number }) =>
    apiFetch<{ success: boolean }>('/admin/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
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
            createdAt: newProfile.created_at,
          }
        };
      } catch (subErr: any) {
        console.error('Supabase fallback also failed:', subErr);
        throw new Error('Connection error: Failed to fetch profile. Please check your internet connection or disable any ad-blockers.');
      }
    }
  },
  updateProfile: async (data: { displayName?: string; congregation?: string; translation?: string }) => {
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
};

