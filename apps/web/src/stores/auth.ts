import { create } from 'zustand';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import type { User as DbUser } from '@unstpbl/shared';

interface AuthState {
  user: SupabaseUser | null;
  session: Session | null;
  profile: DbUser | null;
  isLoading: boolean;
  setUser: (user: SupabaseUser | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: DbUser | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
}

// Quick hydration from localStorage so returning users don't wait on network spins
const cachedUser = (() => {
  try {
    const raw = localStorage.getItem('unstpbl_cached_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

const cachedProfile = (() => {
  try {
    const raw = localStorage.getItem('unstpbl_cached_profile');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

export const useAuthStore = create<AuthState>((set) => ({
  user: cachedUser,
  session: null,
  profile: cachedProfile,
  // If we already have a cached user, we can immediately unblock the UI and verify session in background!
  isLoading: !cachedUser,
  setUser: (user) => {
    try {
      if (user) localStorage.setItem('unstpbl_cached_user', JSON.stringify(user));
      else localStorage.removeItem('unstpbl_cached_user');
    } catch {}
    set({ user });
  },
  setSession: (session) => set({ session }),
  setProfile: (profile) => {
    try {
      if (profile) localStorage.setItem('unstpbl_cached_profile', JSON.stringify(profile));
      else localStorage.removeItem('unstpbl_cached_profile');
    } catch {}
    set({ profile });
  },
  setLoading: (isLoading) => set({ isLoading }),
  signOut: () => {
    try {
      localStorage.removeItem('unstpbl_cached_user');
      localStorage.removeItem('unstpbl_cached_profile');
    } catch {}
    set({ user: null, session: null, profile: null });
  },
}));
