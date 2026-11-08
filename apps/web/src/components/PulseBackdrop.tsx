import { useEffect, useRef } from 'react';

/**
 * The app's signature motion, a heartbeat every 65 seconds: the logo beats twice (lub-dub),
 * the screen glows faintly, and on the second beat a thin white-gold ring spreads out from the
 * logo and fades past the screen edges.
 * (The timing and keyframes live in index.css: .pulse-ring, .pulse-flash, .logo-thump.)
 *
 * It runs on a CSS timer: no JavaScript timers, no canvas, no re-renders, and only transform
 * and opacity are animated, so it costs nothing between beats. People who ask their device for
 * reduced motion do not get it.
 *
 * JavaScript only does two small things: it measures where the logo is so the ring can start
 * there and be big enough to clear the farthest screen corner, and firePulse() lets a tap on the
 * logo play the heartbeat straight away.
 */

/** The ring's bright edge sits at 90% of its radius (see .pulse-ring in index.css). */
const EDGE_FRACTION = 0.9;

const PULSE_ANIMATIONS = new Set(['pulse-ring', 'pulse-flash', 'logo-thump']);

/** Play the heartbeat now instead of waiting for the next 65-second mark. */
export function firePulse(): void {
  if (typeof document === 'undefined' || typeof document.getAnimations !== 'function') return;
  for (const animation of document.getAnimations()) {
    if (!PULSE_ANIMATIONS.has((animation as CSSAnimation).animationName)) continue;
    // Jumping to the end of the start delay puts the animation at the start of its visible part.
    animation.currentTime = Number(animation.effect?.getTiming().delay ?? 0);
  }
}

export default function PulseBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el) return;

      // Start from the logo when it is on screen, otherwise from near the top-middle.
      let x = window.innerWidth / 2;
      let y = window.innerHeight * 0.38;
      const logo = document.querySelector<HTMLElement>('[data-pulse-origin]');
      if (logo) {
        const rect = logo.getBoundingClientRect();
        if (rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight) {
          x = rect.left + rect.width / 2;
          y = rect.top + rect.height / 2;
        }
      }

      // Diameter at which the ring's bright edge just clears the farthest corner of the screen.
      const farthest = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      const size = ((farthest * 2) / EDGE_FRACTION) * 1.04;

      el.style.setProperty('--pulse-x', `${Math.round(x)}px`);
      el.style.setProperty('--pulse-y', `${Math.round(y)}px`);
      el.style.setProperty('--pulse-size', `${Math.round(size)}px`);
    };

    place();
    const settle = window.setTimeout(place, 600); // after the page has finished laying out
    window.addEventListener('resize', place);
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener('resize', place);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div className="pulse-flash" />
      <div className="pulse-ring" />
    </div>
  );
}
