// The one place that talks to the API: base URL, auth header, timeouts, one shared token refresh
// after a 401, and NetworkError for requests that never got an answer.
import { supabase } from '../supabase';
import { NetworkError } from '../errors';

const getApiBase = () => {
  const configured = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  if (
    typeof window !== 'undefined' &&
    window.location.hostname &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    if (configured.includes('localhost')) {
      return configured.replace('localhost', window.location.hostname);
    }
  }
  return configured;
};

const API_BASE = getApiBase();

/**
 * Fire-and-forget request that wakes a sleeping API. `no-cors` keeps it a simple
 * request (no preflight) and we never read the response, we only want the server up.
 */
export function prewarmApi(): void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  fetch(`${API_BASE}/health`, { mode: 'no-cors', cache: 'no-store' }).catch(() => {
    /* best effort */
  });
}
async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function currentUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// The API runs on a free tier that sleeps when idle and can take most of a minute
// to wake. A short cut-off (it used to be 3.5s) aborts the very request that would
// have succeeded, and the app then shows the fallback verse and empty dashboards.
// Writes get longer still: aborting one that actually reached the server makes the
// client think it failed and retry it.
const READ_TIMEOUT_MS = 30_000;
const WRITE_TIMEOUT_MS = 45_000;

interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

// Concurrent 401s (a page fires several requests at once) must share one refresh:
// refresh tokens are single-use, so refreshing twice would invalidate the session.
let sessionRefresh: Promise<boolean> | null = null;

function refreshSessionOnce(): Promise<boolean> {
  if (!sessionRefresh) {
    sessionRefresh = supabase.auth
      .refreshSession()
      .then(({ data, error }) => !error && !!data.session)
      .catch(() => false)
      .finally(() => {
        sessionRefresh = null;
      });
  }
  return sessionRefresh;
}

export async function apiFetch<T>(path: string, options?: ApiFetchOptions, retriedAfterRefresh = false): Promise<T> {
  if (!navigator.onLine) {
    throw new NetworkError('Offline');
  }
  const { timeoutMs, ...init } = options ?? {};
  const method = (init.method || 'GET').toUpperCase();
  const timeoutLimit = timeoutMs ?? (method === 'GET' ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS);

  const headers = await getAuthHeaders();
  let res: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutLimit);

  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: init.signal || controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...init.headers,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new NetworkError(
        `Failed to fetch – the server took longer than ${Math.round(timeoutLimit / 1000)}s to respond (${API_BASE})`,
      );
    }
    // A TypeError from fetch means the request never reached the server. Callers queue work for
    // later on `instanceof NetworkError`, not on message text.
    if (err instanceof TypeError) {
      throw new NetworkError(`Failed to fetch – cannot reach the API at ${API_BASE}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401 && headers.Authorization && !retriedAfterRefresh) {
    // The access token was rejected. Try one refresh and replay the request. Only
    // if the refresh itself fails is the session really dead (expired or revoked,
    // e.g. signed out elsewhere): then sign out locally so the app returns to the
    // login screen instead of showing a signed-in UI whose every call fails.
    if (await refreshSessionOnce()) {
      return apiFetch<T>(path, options, true);
    }
    await supabase.auth.signOut({ scope: 'local' });
  }

  if (!res.ok) {
    const detail = await res.json().then(
      (body) => (typeof body?.error === 'string' ? body.error : undefined),
      () => undefined,
    );
    throw new Error(`API error: ${res.status}${detail ? ` – ${detail}` : ''}`);
  }
  return res.json();
}
