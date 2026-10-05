import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Uses the real supabase-js on purpose: the failure being guarded against lives
// inside the library's createClient(), so mocking it would hide the problem.
const { getSupabaseClient } = await import('./authCache.js');

describe('getSupabaseClient on Node versions without native WebSocket', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('can be created on Node 20 (Render), where supabase-js otherwise throws', () => {
    // supabase-js builds a Realtime client inside createClient() and, on Node < 22
    // with no WebSocket, throws "Node.js 20 detected without native WebSocket support".
    vi.stubGlobal(
      'process',
      Object.create(process, { versions: { value: { ...process.versions, node: '20.19.0' } } }),
    );
    vi.stubGlobal('WebSocket', undefined);

    expect(() => getSupabaseClient()).not.toThrow();
  });
});
