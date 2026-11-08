import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Tracks page scrolling for the fixed header:
 *  - `isScrolled`: the page has moved down a little, so the header can shrink;
 *  - `visible`: false while the person scrolls down (the header slides away), true while they
 *    scroll up or are at the top.
 * Touches that start inside `ignoreTouchIn` (the tab bar) do not count as page scrolling.
 */
export function useScrollChrome(ignoreTouchIn: RefObject<HTMLElement>): { visible: boolean; isScrolled: boolean } {
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
      if (ignoreTouchIn.current?.contains(e.target as Node)) return;
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (ignoreTouchIn.current?.contains(e.target as Node)) return;
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
  }, [ignoreTouchIn]);

  return { visible, isScrolled };
}
