import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';

export default function Layout() {
  const { signOut, profile } = useAuthStore();
  const navigate = useNavigate();

  const [visible, setVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const prevScrollY = useRef(0);

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

  const showAdminTab = profile?.role === 'admin' || profile?.role === 'bishop';

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
        {/* Header - Hides on scroll down, shows on scroll up, shrinks logo */}
        <header
          className={`fixed top-0 left-0 right-0 z-50 bg-white/5 backdrop-blur-lg border-b border-white/10 px-4 transition-all duration-300 transform ${
            visible ? 'translate-y-0' : '-translate-y-full'
          } ${isScrolled ? 'py-1.5 bg-surface-950/80 shadow-lg' : 'py-3'}`}
        >
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/church_logo.png"
                alt="Church Logo"
                className={`rounded-xl object-contain bg-white/5 p-1 transition-all duration-300 ease-out transform origin-left ${
                  isScrolled ? 'w-12 h-12 shadow-md' : 'w-20 h-20 shadow-xl'
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
        <main className="flex-1 px-4 pb-24 pt-28 max-w-lg mx-auto w-full">
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
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
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
