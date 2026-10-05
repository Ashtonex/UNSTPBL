import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const resolveAuth = vi.fn();
vi.mock('../lib/authCache.js', () => ({ resolveAuth }));

const { authMiddleware } = await import('./auth.js');

function makeApp() {
  const app = new Hono();
  app.get('/private', authMiddleware, (c) => c.json({ user: c.get('user') }));
  return app;
}

describe('authMiddleware', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';
    resolveAuth.mockReset();
  });

  it('rejects requests without a bearer token', async () => {
    const res = await makeApp().request('/private');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a token that does not resolve to a user', async () => {
    resolveAuth.mockResolvedValue(null);
    const res = await makeApp().request('/private', { headers: { Authorization: 'Bearer bad' } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Invalid or expired token' });
  });

  it('exposes the resolved user (id, email, role only) to handlers', async () => {
    resolveAuth.mockResolvedValue({ id: 'u1', email: 'a@b.c', role: 'bishop', translation: 'ESV' });
    const res = await makeApp().request('/private', { headers: { Authorization: 'Bearer good' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { id: 'u1', email: 'a@b.c', role: 'bishop' } });
  });

  it('answers 503, not a generic 500, when the lookup itself throws', async () => {
    resolveAuth.mockRejectedValue(new Error('Invalid supabaseUrl'));
    const res = await makeApp().request('/private', { headers: { Authorization: 'Bearer any' } });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Authentication service unavailable' });
  });

  it('returns a configuration error when Supabase env vars are missing', async () => {
    delete process.env.SUPABASE_SERVICE_KEY;
    const res = await makeApp().request('/private', { headers: { Authorization: 'Bearer any' } });
    expect(res.status).toBe(500);
    expect(resolveAuth).not.toHaveBeenCalled();
  });
});
