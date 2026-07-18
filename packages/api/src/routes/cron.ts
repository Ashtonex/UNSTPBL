import { timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { dispatchDueScheduledPushNotifications } from '../lib/pushDispatcher.js';
import { dispatchTodaysBirthdayAnnouncements } from '../lib/birthdayDispatcher.js';

export const cronRoutes = new Hono();

function isValidCronSecret(value: string | undefined): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !value) return false;

  const expectedBuffer = Buffer.from(expected);
  const valueBuffer = Buffer.from(value);
  if (expectedBuffer.length !== valueBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, valueBuffer);
}

cronRoutes.post('/cron/push/dispatch-due', async (c) => {
  const secret = c.req.header('x-cron-secret') || c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!isValidCronSecret(secret)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const result = await dispatchDueScheduledPushNotifications();
    return c.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Cron push dispatch failed:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

cronRoutes.post('/cron/birthdays/dispatch-today', async (c) => {
  const secret = c.req.header('x-cron-secret') || c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!isValidCronSecret(secret)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const result = await dispatchTodaysBirthdayAnnouncements();
    return c.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Cron birthday dispatch failed:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});
