import React, { useCallback, useEffect, useRef } from 'react';

interface Tilt3DCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  perspective?: number;
  scale?: number;
  glareOpacity?: number;
}

/** Hover tilt only makes sense with a mouse; on touch screens it just costs frames. */
function canTilt(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * A card that tilts toward the mouse pointer on desktop.
 *
 * Performance notes: the tilt is written straight to the element's style inside
 * requestAnimationFrame, never through React state, so moving the mouse does not re-render
 * the card or its children. On touch devices (and with reduced motion) it renders as a plain
 * wrapper: no touch or gyroscope listeners, and the page scrolls normally when a finger
 * starts on the card.
 */
export default function Tilt3DCard({
  children,
  className = '',
  maxTilt = 12,
  perspective = 1000,
  scale = 1.02,
  glareOpacity = 0.25,
}: Tilt3DCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const enabled = useRef(canTilt());

  const tiltTo = useCallback(
    (clientX: number, clientY: number) => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const card = cardRef.current;
        const glare = glareRef.current;
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;
        const rotateX = -Math.max(-1, Math.min(1, (y - 0.5) * 2)) * maxTilt;
        const rotateY = Math.max(-1, Math.min(1, (x - 0.5) * 2)) * maxTilt;
        card.style.transition = 'transform 0.08s ease-out';
        card.style.transform = `perspective(${perspective}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`;
        if (glare) {
          const sx = Math.max(0, Math.min(100, x * 100)).toFixed(1);
          const sy = Math.max(0, Math.min(100, y * 100)).toFixed(1);
          glare.style.opacity = String(glareOpacity);
          glare.style.background = `radial-gradient(circle at ${sx}% ${sy}%, rgba(251,191,36,0.45) 0%, rgba(245,158,11,0.18) 40%, rgba(255,255,255,0) 75%)`;
        }
      });
    },
    [maxTilt, perspective, scale, glareOpacity],
  );

  const reset = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const card = cardRef.current;
    const glare = glareRef.current;
    if (card) {
      card.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
      card.style.transform = '';
    }
    if (glare) glare.style.opacity = '0';
  }, []);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  if (!enabled.current) {
    return <div className={`relative rounded-2xl ${className}`}>{children}</div>;
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={(e) => tiltTo(e.clientX, e.clientY)}
      onMouseLeave={reset}
      style={{ transformStyle: 'preserve-3d' }}
      className={`relative rounded-2xl will-change-transform ${className}`}
    >
      {/* Specular light glare that follows the pointer */}
      <div
        ref={glareRef}
        aria-hidden="true"
        className="absolute inset-0 rounded-2xl pointer-events-none z-30 mix-blend-overlay overflow-hidden"
        style={{ opacity: 0, transition: 'opacity 0.3s ease' }}
      />
      {children}
    </div>
  );
}
