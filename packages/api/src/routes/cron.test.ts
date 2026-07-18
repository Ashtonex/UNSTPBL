import { afterEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { cronRoutes } from './cron.js';

describe('cron routes', () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('rejects dispatch requests without the configured cron secret', async () => {
    process.env.CRON_SECRET = 'expected-secret';
    const app = new Hono();
    app.route('/', cronRoutes);

    const missingSecret = await app.request('/cron/push/dispatch-due', { method: 'POST' });
    expect(missingSecret.status).toBe(401);

    const wrongSecret = await app.request('/cron/push/dispatch-due', {
      method: 'POST',
      headers: { 'x-cron-secret': 'wrong-secret' },
    });
    expect(wrongSecret.status).toBe(401);
  });
});
