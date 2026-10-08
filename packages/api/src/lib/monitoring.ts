/**
 * Minimal Sentry error reporting with no SDK.
 *
 * @sentry/node pulls in OpenTelemetry. Loading it blocks the (single) event loop
 * for ~4s on a fast machine with a warm disk, and far longer on a small
 * free-tier instance, so nothing could be served until it finished, including
 * the first request after the service woke up. Measured: time to first response
 * 6.5s with it, 2.5s without.
 *
 * We only use Sentry to report errors, so this posts events to the same project
 * using Sentry's public envelope endpoint instead. No library, no startup cost.
 */
import { randomBytes } from 'node:crypto';

interface Target {
  dsn: string;
  publicKey: string;
  endpoint: string;
}

const MAX_EVENTS_PER_MINUTE = 10;

let target: Target | null = null;
let windowStartedAt = 0;
let sentInWindow = 0;

export function parseDsn(dsn: string): Target | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.split('/').filter(Boolean).pop();
    if (!url.username || !projectId) return null;
    return {
      dsn,
      publicKey: url.username,
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
}

export function initMonitoring(): void {
  const dsn = process.env.SENTRY_DSN_API;
  if (!dsn) return;

  target = parseDsn(dsn);
  if (!target) {
    console.warn('SENTRY_DSN_API is set but is not a valid DSN; error reporting is off.');
    return;
  }

  // "Monitor" only observes; unlike an 'uncaughtException' handler it does not
  // change whether the process crashes.
  process.on('uncaughtExceptionMonitor', (err) => captureException(err));
}

/** Test hook: forget the configured DSN and the rate-limit window. */
export function resetMonitoringForTests(): void {
  target = null;
  windowStartedAt = 0;
  sentInWindow = 0;
}

function allowedByRateLimit(now: number): boolean {
  if (now - windowStartedAt > 60_000) {
    windowStartedAt = now;
    sentInWindow = 0;
  }
  if (sentInWindow >= MAX_EVENTS_PER_MINUTE) return false;
  sentInWindow += 1;
  return true;
}

/**
 * Reports an error. Fire-and-forget: never throws, never blocks the request,
 * and drops events beyond a small per-minute budget so an error loop can't
 * flood Sentry or the network.
 */
export function captureException(err: unknown, request?: { method?: string; path?: string }): void {
  if (!target || !allowedByRateLimit(Date.now())) return;

  try {
    const error = err instanceof Error ? err : new Error(String(err));
    const eventId = randomBytes(16).toString('hex');

    const event = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: 'node',
      level: 'error',
      environment: process.env.NODE_ENV || 'development',
      release: process.env.RENDER_GIT_COMMIT || undefined,
      server_name: process.env.RENDER_SERVICE_NAME || undefined,
      exception: { values: [{ type: error.name, value: error.message }] },
      extra: { stack: error.stack },
      request: request ? { method: request.method, url: request.path } : undefined,
    };

    const body = [
      JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn: target.dsn }),
      JSON.stringify({ type: 'event' }),
      JSON.stringify(event),
    ].join('\n');

    void fetch(target.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${target.publicKey}, sentry_client=unstpbl-lite/1.0`,
      },
      body,
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {
      /* reporting is best effort */
    });
  } catch {
    /* reporting must never take the request down with it */
  }
}
