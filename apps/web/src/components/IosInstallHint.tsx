import { useState } from 'react';
import { usePWA } from '../lib/usePWA';

const DISMISSED_KEY = 'unstpbl_ios_install_hint_dismissed';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * iPhones and iPads never fire the install prompt, so tell people how to add the app
 * to their Home Screen by hand. It matters beyond convenience: on iOS, push notifications
 * only work for an app that was added to the Home Screen.
 */
export default function IosInstallHint() {
  const { isIOS, isInstalled } = usePWA();
  const [dismissed, setDismissed] = useState(wasDismissed);

  if (!isIOS || isInstalled || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // The hint just comes back next visit.
    }
  };

  return (
    <section
      aria-label="Add UNSTPBL to your Home Screen"
      className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-brand-600/30 via-brand-500/20 to-amber-500/20 border border-brand-500/40 shadow-xl animate-fade-in"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold text-white">Install UNSTPBL on your iPhone</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install tip"
          className="-mt-1 -mr-1 p-2 text-fg-muted hover:text-white"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <ol className="mt-2 space-y-1.5 text-[12px] text-fg-soft list-decimal list-inside">
        <li>
          Tap the{' '}
          <svg
            className="inline w-4 h-4 -mt-0.5 text-brand-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-label="Share"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0-12L8 7m4-4l4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>{' '}
          <span className="font-semibold">Share</span> button in Safari.
        </li>
        <li>
          Scroll down and tap <span className="font-semibold">Add to Home Screen</span>.
        </li>
        <li>Open UNSTPBL from your Home Screen.</li>
      </ol>
      <p className="mt-2 text-xs text-fg-muted">
        Installing also lets you get daily verse notifications on iPhone.
      </p>
    </section>
  );
}
