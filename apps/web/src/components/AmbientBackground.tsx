import { lazy, Suspense, useEffect, useState } from 'react';
import ErrorBoundary from './ErrorBoundary';

// three.js is large; keep it out of the main bundle and load it on demand.
const Interactive3DCanvas = lazy(() => import('./3d/Interactive3DCanvas'));

/** Phones that would struggle with a constantly-animating WebGL layer, or users who asked to save data. */
function shouldSkipAmbientEffects(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  return (
    Boolean(nav.connection?.saveData) ||
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2)
  );
}

/**
 * The decorative 3D background. It is deliberately the last thing to load: it
 * waits until the browser is idle (the verse has already painted), is skipped on
 * low-power devices, and any failure just hides it instead of taking the app down.
 */
export default function AmbientBackground() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (shouldSkipAmbientEffects()) return;

    const start = () => setReady(true);
    if ('requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(start, { timeout: 3000 });
      return () => window.cancelIdleCallback(handle);
    }
    // (TypeScript's DOM lib says requestIdleCallback always exists, which narrows
    // `window` to `never` here, so use the global timer functions.)
    const timer = setTimeout(start, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) return null;

  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <Interactive3DCanvas />
      </Suspense>
    </ErrorBoundary>
  );
}
