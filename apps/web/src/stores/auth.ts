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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  signOut: () => set({ user: null, session: null, profile: null }),
}));
