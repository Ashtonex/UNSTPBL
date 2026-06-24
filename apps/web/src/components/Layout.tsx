import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

export default function Layout() {
  const { signOut, profile } = useAuthStore();
  const navigate = useNavigate();

  const [visible, setVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const prevScrollY = useRef(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Helper to register push subscription
  const setupPushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported on this browser.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          console.error('VITE_VAPID_PUBLIC_KEY is not defined.');
          return;
        }

        // Convert VAPID key to Uint8Array
        const urlBase64ToUint8Array = (base64String: string) => {
          const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
          const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }
          return outputArray;
        };

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      // Send subscription to backend
      await api.subscribePush(subscription);
      console.log('Push notification subscription successfully registered!');
    } catch (err) {
      console.error('Failed to set up push notifications:', err);
    }
  };

  useEffect(() => {
    if (profile) {
      const timer = setTimeout(() => {
        setupPushNotifications();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [profile]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      api.syncPendingQueue();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check and sync on mount
    if (navigator.onLine) {
      api.syncPendingQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let startY = 0;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // 1. Determine logo scroll-shrink state
      setIsScrolled(currentScrollY > 20);

      // 2. Determine navbars scroll-direction visibility state
      const diff = currentScrollY - prevScrollY.current;

      if (currentScrollY <= 20) {
        setVisible(true);
        prevScrollY.current = currentScrollY;
      } else if (Math.abs(diff) > 8) {
        if (diff > 0) {
          // Scrolling down -> hide navbars
          setVisible(false);
        } else {
          // Scrolling up -> show navbars
          setVisible(true);
        }
        prevScrollY.current = currentScrollY;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // If deltaY is positive, user is scrolling down
      if (e.deltaY > 15) {
        setVisible(false);
      } else if (e.deltaY < -15) {
        setVisible(true);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!startY) return;
      const currentY = e.touches[0].clientY;
      const diffY = startY - currentY; // positive means swiping up (scrolling down)

      if (Math.abs(diffY) > 15) {
        if (diffY > 0) {
          // Swiped up (scrolling down) -> hide
          setVisible(false);
        } else {
          // Swiped down (scrolling up) -> show
          setVisible(true);
        }
        startY = currentY; // reset to prevent continuous triggers
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    signOut();
    navigate('/login');
  };

  const showBishopTab = profile?.role === 'admin' || profile?.role === 'bishop';
  const showAdminTab = profile?.role === 'admin';

  return (
    <div className="min-h-screen flex flex-col relative text-white bg-surface-950 overflow-x-hidden">
      {/* Alive Background Image Layer */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src="/background_eagle.png"
          alt="Eagle Background"
          className="w-full h-full object-cover animate-bg-alive"
        />
        <div className="absolute inset-0 bg-radial-vignette" />
      </div>

      {/* Main Content Layer */}
      <div className="relative z-10 flex-1 flex flex-col min-h-screen">
        {isOffline && (
          <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-600/90 backdrop-blur-md text-white text-center py-2 text-xs font-semibold shadow-md flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-3.536 4.978 4.978 0 011.414-3.536m0 0L5.636 5.636m0 0L3 3m2.636 2.636l2.829 2.829M12 12v.01" />
            </svg>
            You are offline. Changes will sync when back online.
          </div>
        )}
        {/* Header - Hides on scroll down, shows on scroll up, shrinks logo */}
        <header
          className={`fixed top-0 left-0 right-0 z-50 bg-white/5 backdrop-blur-lg border-b border-white/10 px-4 transition-all duration-300 transform ${
            visible ? 'translate-y-0' : '-translate-y-full'
          } ${isScrolled ? 'py-1.5 bg-surface-950/80 shadow-lg' : 'py-3'}`}
          style={{ marginTop: isOffline && visible ? '32px' : '0px' }}
        >
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/church_logo.png"
                alt="Church Logo"
                className={`object-contain transition-all duration-300 ease-out transform origin-left ${
                  isScrolled ? 'w-12 h-12' : 'w-20 h-20'
                }`}
              />
              <h1 className="text-xl font-extrabold tracking-tight">
                <span className="text-gradient">UNSTPBL</span>
              </h1>
            </div>
            <button
              onClick={handleSignOut}
              className="text-white/40 hover:text-white/70 text-sm transition-colors"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Main Content - Padded to compensate for fixed navbars */}
        <main
          className="flex-1 px-4 pb-24 max-w-lg mx-auto w-full transition-all duration-300"
          style={{ paddingTop: isOffline ? '144px' : '112px' }}
        >
          <Outlet />
        </main>

        {/* Bottom Navigation - Hides on scroll down, shows on scroll up */}
        <nav
          className={`fixed bottom-0 left-0 right-0 z-50 bg-white/5 backdrop-blur-lg border-t border-white/10 transition-all duration-300 transform ${
            visible ? 'translate-y-0 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]' : 'translate-y-full'
          }`}
        >
          <div className="max-w-lg mx-auto flex justify-around py-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-link ${isActive ? 'text-brand-400' : ''}`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <span className="text-xs font-medium">Verse</span>
            </NavLink>

            <NavLink
              to="/profile"
              className={({ isActive }) => `nav-link ${isActive ? 'text-brand-400' : ''}`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="text-xs font-medium">Profile</span>
            </NavLink>

            {showBishopTab && (
              <NavLink
                to="/bishop"
                className={({ isActive }) => `nav-link ${isActive ? 'text-brand-400' : ''}`}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-xs font-medium">Bishop</span>
              </NavLink>
            )}

            {showAdminTab && (
              <NavLink
                to="/admin"
                className={({ isActive }) => `nav-link ${isActive ? 'text-brand-400' : ''}`}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span className="text-xs font-medium">Admin</span>
              </NavLink>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}
