import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Registers the service worker and tells people when a new version of the app has been
 * downloaded. The new version only takes over when they tap Refresh, so it never swaps
 * the app's code while someone is in the middle of writing a prayer or reflection.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Installed apps can stay open for days; look for a new version now and then.
      setInterval(() => {
        if (navigator.onLine) registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 z-[120] px-4 flex justify-center pointer-events-none"
      style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="pointer-events-auto w-full max-w-md flex items-center justify-between gap-3 rounded-2xl border border-brand-400/40 bg-surface-950/95 px-4 py-3 shadow-2xl backdrop-blur-md animate-slide-up">
        <p className="text-sm text-white">A new version of UNSTPBL is ready.</p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white/70 hover:text-white"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 active:scale-95 text-surface text-xs font-bold transition-all"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
