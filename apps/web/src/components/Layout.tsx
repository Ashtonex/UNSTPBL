import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isStaff } from '@unstpbl/shared';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import PulseBackdrop, { firePulse } from './PulseBackdrop';

// One column that grows with the screen: a phone-width column on phones, wider on tablets and
// desktops so dashboards and tables have room instead of being squeezed into 512px.
const CONTAINER = 'w-full max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto';
const TAB_CLASS =
  'flex-1 min-w-0 flex flex-col items-center justify-center min-h-[56px] px-1 py-2 rounded-xl transition-colors';
const TAB_ACTIVE = 'text-brand-400';
const TAB_IDLE = 'text-white/60 hover:text-white/90 active:bg-white/5';

export default function Layout() {
  const { signOut, profile } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [visible, setVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const prevScrollY = useRef(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const navRef = useRef<HTMLElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);

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
      if (navRef.current?.contains(e.target as Node)) return;
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (navRef.current?.contains(e.target as Node)) return;
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

  // Close the "More" sheet whenever the page changes, and on Escape.
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    signOut();
    navigate('/login');
  };

  const showBishopTab = profile?.role === 'admin' || profile?.role === 'bishop';
  // Ushers, pastors and the communications team get a Team tab; bishops and admins reach the same tools from the Bishop page.
  const showTeamTab = isStaff(profile?.role) && !showBishopTab;
  const showAdminTab = profile?.role === 'admin';

  const navItems = [
    {
      to: '/',
      label: 'Verse',
      end: true,
      icon: (
        <svg className="w-6 h-6" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      ),
    },
    {
      to: '/prayers',
      label: 'Prayers',
      icon: (
        <svg className="w-6 h-6" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      ),
    },
    {
      to: '/family',
      label: 'Family',
      icon: (
        <svg className="w-6 h-6" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      to: '/birthdays',
      label: 'Birthdays',
      icon: (
        <svg className="w-6 h-6" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 15.546c-.523 0-1.046-.151-1.5-.454A2.704 2.704 0 0018 14.638c-.523 0-1.046.151-1.5.454A2.704 2.704 0 0115 15.546c-.523 0-1.046-.151-1.5-.454A2.704 2.704 0 0012 14.638c-.523 0-1.046.151-1.5.454A2.704 2.704 0 019 15.546c-.523 0-1.046-.151-1.5-.454A2.704 2.704 0 006 14.638c-.523 0-1.046.151-1.5.454A2.704 2.704 0 013 15.546M12 3v3m0 0c-1.657 0-3 1.12-3 2.5S10.343 11 12 11s3-1.12 3-2.5S13.657 6 12 6zm-7 9.5V21h14v-5.5"
          />
        </svg>
      ),
    },
    {
      to: '/search',
      label: 'Search',
      icon: (
        <svg className="w-6 h-6" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      ),
    },
    {
      to: '/profile',
      label: 'Profile',
      icon: (
        <svg className="w-6 h-6" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
    ...(showTeamTab
      ? [
          {
            to: '/team',
            label: 'Team',
            icon: (
              <svg className="w-6 h-6" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            ),
          },
        ]
      : []),
    ...(showBishopTab
      ? [
          {
            to: '/bishop',
            label: 'Bishop',
            icon: (
              <svg className="w-6 h-6" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            ),
          },
        ]
      : []),
    ...(showAdminTab
      ? [
          {
            to: '/admin',
            label: 'Admin',
            icon: (
              <svg className="w-6 h-6" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            ),
          },
        ]
      : []),
  ];

  // Mobile apps show at most five tabs; everything else lives behind More.
  const PRIMARY_PATHS = ['/', '/search', '/prayers', '/family'];
  const primaryItems = PRIMARY_PATHS.map((to) => navItems.find((item) => item.to === to)).filter(
    (item): item is (typeof navItems)[number] => Boolean(item),
  );
  const moreItems = navItems.filter((item) => !PRIMARY_PATHS.includes(item.to));
  const moreActive = moreItems.some((item) => location.pathname.startsWith(item.to));

  return (
    <div className="min-h-dvh flex flex-col relative text-white bg-surface-950 overflow-x-hidden">
      {/* Alive Background Image Layer */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src="/background_eagle.webp"
          alt="Eagle Background"
          className="w-full h-full object-cover animate-bg-alive opacity-30 sm:opacity-20"
        />
        <div className="absolute inset-0 bg-radial-vignette" />
      </div>

      {/* The 65-second pulse */}
      <PulseBackdrop />

      {/* Main Content Layer */}
      <div className="relative z-10 flex-1 flex flex-col min-h-dvh">
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
          className={`fixed top-0 left-0 right-0 z-50 bg-white/5 backdrop-blur-lg border-b border-white/10 transition-all duration-300 transform ${
            visible ? 'translate-y-0' : '-translate-y-full'
          } ${isScrolled ? 'pb-1 bg-surface-950/80 shadow-lg' : 'pb-2'}`}
          style={{
            marginTop: isOffline && visible ? '32px' : '0px',
            paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
          }}
        >
          <div className={`${CONTAINER} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              {/* Tapping the logo plays the heartbeat now (it also fires by itself every 65 seconds). */}
              <button
                type="button"
                onClick={firePulse}
                aria-label="UNSTPBL logo. Tap for a heartbeat pulse."
                className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60"
              >
                <img
                  src="/church_logo.png"
                  alt=""
                  data-pulse-origin
                  className={`logo-thump object-contain transition-all duration-300 ease-out ${
                    isScrolled ? 'w-8 h-8' : 'w-12 h-12'
                  }`}
                />
              </button>
              <h1 className="text-xl font-extrabold tracking-tight">
                <span className="text-gradient">UNSTPBL</span>
              </h1>
            </div>
          </div>
        </header>

        {/* Main Content - Balanced padding for mobile and desktop */}
        <main
          className={`flex-1 ${CONTAINER} transition-all duration-300`}
          style={{
            paddingTop: `calc(${isOffline ? 120 : 84}px + env(safe-area-inset-top, 0px))`,
            paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
          }}
        >
          <Outlet />
        </main>

        {/* Bottom tab bar: five equal tabs, always visible (like a native app). */}
        <nav
          ref={navRef}
          aria-label="Main"
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface-950/95 backdrop-blur-md border-t border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.6)]"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)',
          }}
        >
          <div className={`${CONTAINER} flex items-stretch px-1`}>
            {primaryItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `${TAB_CLASS} ${isActive ? TAB_ACTIVE : TAB_IDLE}`}
              >
                {item.icon}
                <span className="text-xs font-medium mt-0.5 max-w-full truncate">{item.label}</span>
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={`${TAB_CLASS} ${moreActive || moreOpen ? TAB_ACTIVE : TAB_IDLE}`}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
              <span className="text-xs font-medium mt-0.5">More</span>
            </button>
          </div>
        </nav>

        {moreOpen && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMoreOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in cursor-default"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="More"
              className="relative w-full max-w-lg md:max-w-2xl bg-surface-950 border-t border-white/10 rounded-t-3xl p-4 animate-slide-up max-h-[80dvh] overflow-y-auto"
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
              <ul className="grid grid-cols-1 gap-1">
                {moreItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-4 rounded-xl px-4 py-3 text-base min-h-[48px] ${
                          isActive ? 'bg-brand-500/15 text-brand-300 font-semibold' : 'text-white/80 hover:bg-white/5'
                        }`
                      }
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-4 rounded-xl px-4 py-3 text-base min-h-[48px] text-white/60 hover:bg-white/5 text-left"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                  </button>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
