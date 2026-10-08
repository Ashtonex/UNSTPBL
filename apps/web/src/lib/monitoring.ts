/**
 * Browser error reporting, loaded after the page is interactive.
 *
 * @sentry/react is ~270 kB and used to be pulled in before the first paint on
 * every page, including the login screen. Nothing about error reporting needs to
 * block the UI, so initialise it when the browser is idle. The trade-off is that
 * an error thrown in the first moments of a page load is not reported.
 */

type SentryModule = typeof import('@sentry/react');

let sentry: SentryModule | null = null;

function whenIdle(task: () => void): void {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(task, { timeout: 5000 });
  } else {
    // Older Safari: no requestIdleCallback.
    setTimeout(task, 2000);
  }
}

export function initMonitoring(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  const start = () =>
    import('@sentry/react')
      .then((Sentry) => {
        Sentry.init({
          dsn,
          integrations: [Sentry.browserTracingIntegration()],
          tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
          replaysSessionSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAY_SAMPLE_RATE || '0.05'),
          replaysOnErrorSampleRate: 1.0,
        });
        sentry = Sentry;
        // Session replay is the heaviest part, so it goes in later still.
        window.setTimeout(() => Sentry.addIntegration(Sentry.replayIntegration()), 4000);
      })
      .catch((err) => console.warn('Error reporting could not start:', err));

  if (document.readyState === 'complete') {
    whenIdle(start);
  } else {
    window.addEventListener('load', () => whenIdle(start), { once: true });
  }
}

/** No-op until Sentry has loaded. */
export function captureException(error: unknown): void {
  sentry?.captureException(error);
}
