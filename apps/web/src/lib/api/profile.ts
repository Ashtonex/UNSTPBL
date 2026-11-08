// The signed-in person's profile, including saving while offline.
import { supabase } from '../supabase';
import { NetworkError } from '../errors';
import { useAuthStore } from '../../stores/auth';
import {
  clearPendingProfile,
  dropLegacyQueues,
  getPendingProfile,
  getPendingReads,
  queueProfileEdit,
  setPendingReads,
} from '../offlineQueue';
import { apiFetch, currentUserId } from './client';
import type {
  User,
} from '@unstpbl/shared';

// Only one sync at a time: the app asks for one on start-up and again when it comes back online.
let queueSync: Promise<void> | null = null;

export const profileApi = {
  syncPendingQueue: (): Promise<void> => {
    if (!navigator.onLine) return Promise.resolve();
    if (queueSync) return queueSync;

    queueSync = (async () => {
      const userId = await currentUserId();
      if (!userId) return;

      // Queues from older versions were not tied to a person and cannot be sent safely.
      dropLegacyQueues(localStorage);

      // 1. Verse reads
      const pendingReads = getPendingReads(userId, localStorage);
      if (pendingReads.length > 0) {
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
        setPendingReads(userId, remaining, localStorage);
      }

      // 2. Profile edits
      const pendingProfile = getPendingProfile(userId, localStorage);
      if (Object.keys(pendingProfile).length > 0) {
        try {
          await apiFetch('/profile', {
            method: 'PUT',
            body: JSON.stringify(pendingProfile),
          });
          clearPendingProfile(userId, localStorage);
        } catch (err) {
          console.error('Failed to sync profile update:', err);
        }
      }
    })().finally(() => {
      queueSync = null;
    });

    return queueSync;
  },
  getProfile: async () => {
    try {
      return await apiFetch<{ profile: User }>('/profile');
    } catch (err) {
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
      } catch (subErr) {
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
    } catch (err) {
      if (err instanceof NetworkError) {
        const userId = await currentUserId();
        const current = useAuthStore.getState().profile;
        // Without a known profile for this signed-in person there is nothing correct to show.
        if (!userId || !current || current.id !== userId) {
          throw new Error("You're offline, so your profile could not be saved. Please try again when you're back online.");
        }
        queueProfileEdit(userId, data, localStorage);
        // Show the person's own profile with their edits applied. Their id, email and role stay
        // exactly as they were, so nothing (such as the admin tabs) changes while offline.
        return { profile: { ...current, ...data } };
      }
      console.warn('API update /profile failed, falling back to direct Supabase update:', err);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) throw new Error('User session not found. Please log in again.');

        const updateData: Record<string, unknown> = {};
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
          .update(updateData)
          .eq('id', user.id)
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
      } catch (subErr) {
        console.error('Supabase fallback also failed:', subErr);
        throw new Error('Connection error: Failed to save profile. Please check your internet connection or disable any ad-blockers.');
      }
    }
  },
};
