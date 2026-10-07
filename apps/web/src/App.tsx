import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useAuthStore } from './stores/auth';
import { supabase } from './lib/supabase';
import { api } from './lib/api';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import HomePage from './pages/HomePage';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const BishopPage = lazy(() => import('./pages/BishopPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const PrayersPage = lazy(() => import('./pages/PrayersPage'));
const FamilyHubPage = lazy(() => import('./pages/FamilyHubPage'));
const BirthdaysPage = lazy(() => import('./pages/BirthdaysPage'));

function RouteLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-10 h-10 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-white/40 text-sm">Loading...</p>
    </div>
  );
}

export default function App() {
  const { setUser, setSession, setProfile, setLoading } = useAuthStore();

  useEffect(() => {
    // getSession() and onAuthStateChange() (INITIAL_SESSION, SIGNED_IN, ...) all
    // report the same session at login, so only fetch the profile once per user.
    let syncedUserId: string | null = null;

    const syncProfile = async (session: any, force = false) => {
      const userId: string | undefined = session?.user?.id;
      if (!userId) {
        syncedUserId = null;
        setProfile(null);
        return;
      }
      if (syncedUserId === userId && !force) return;

      syncedUserId = userId;
      try {
        const { profile } = await api.getProfile();
        setProfile(profile);
      } catch (err) {
        syncedUserId = null; // allow a later auth event to retry
        console.error('Error fetching profile:', err);
      }
    };

    let isMounted = true;

    // Check initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session) {
          syncProfile(session);
        }
      })
      .catch((err) => {
        console.error('Failed to resolve initial Supabase session:', err);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      // Token refreshes re-sync so role changes made mid-session still show up.
      syncProfile(session, event === 'TOKEN_REFRESHED');
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [setUser, setSession, setProfile, setLoading]);

  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="prayers" element={<PrayersPage />} />
          <Route path="family" element={<FamilyHubPage />} />
          <Route path="birthdays" element={<BirthdaysPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="bishop" element={<BishopPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
