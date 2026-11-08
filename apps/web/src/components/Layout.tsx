import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isStaff } from '@unstpbl/shared';
import { useAuthStore } from '../stores/auth';
import PulseBackdrop, { firePulse } from './PulseBackdrop';
import { Sheet } from './ui';
import { getNavItems } from './nav/navItems';
import { usePushRegistration } from '../hooks/usePushRegistration';
import { useOnlineSync } from '../hooks/useOnlineSync';
import { useScrollChrome } from '../hooks/useScrollChrome';

// One column that grows with the screen: a phone-width column on phones, wider on tablets and
// desktops so dashboards and tables have room instead of being squeezed into 512px.
const CONTAINER = 'w-full max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto';
const TAB_CLASS =
  'flex-1 min-w-0 flex flex-col items-center justify-center min-h-[56px] px-1 py-2 rounded-xl transition-colors';
const TAB_ACTIVE = 'text-brand-400';
const TAB_IDLE = 'text-fg-muted hover:text-fg active:bg-white/5';

export default function Layout() {
  const { signOut, profile } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const navRef = useRef<HTMLElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const { visible, isScrolled } = useScrollChrome(navRef);
  const isOffline = !useOnlineSync();
  usePushRegistration(profile);

  // Close the "More" sheet whenever the page changes (the Sheet itself handles Escape and the backdrop).
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    signOut();
    navigate('/login');
  };

  const showBishopTab = profile?.role === 'admin' || profile?.role === 'bishop';
  // Ushers, pastors and the communications team get a Team tab; bishops and admins reach the same tools from the Bishop page.
  const showTeamTab = isStaff(profile?.role) && !showBishopTab;
  const showAdminTab = profile?.role === 'admin';

  const navItems = getNavItems({ showTeamTab, showBishopTab, showAdminTab });

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

        <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} label="More">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
          <ul className="grid grid-cols-1 gap-1">
                {moreItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-4 rounded-xl px-4 py-3 text-base min-h-[48px] ${
                          isActive ? 'bg-brand-500/15 text-brand-300 font-semibold' : 'text-fg-soft hover:bg-white/5'
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
                    className="w-full flex items-center gap-4 rounded-xl px-4 py-3 text-base min-h-[48px] text-fg-muted hover:bg-white/5 text-left"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                  </button>
                </li>
              </ul>
        </Sheet>
      </div>
    </div>
  );
}
