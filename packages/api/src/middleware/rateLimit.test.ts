import { describe, expect, it, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createRateLimit, resetRateLimitBuckets } from './rateLimit.js';

describe('createRateLimit', () => {
  beforeEach(() => {
    resetRateLimitBuckets();
  });

  it('returns 429 after the configured request budget is exhausted', async () => {
    const app = new Hono();
    app.get('/limited', createRateLimit({ windowMs: 60_000, max: 2, keyPrefix: 'test' }), (c) => c.json({ ok: true }));

    expect((await app.request('/limited')).status).toBe(200);
    expect((await app.request('/limited')).status).toBe(200);

    const blocked = await app.request('/limited');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
  });
});
