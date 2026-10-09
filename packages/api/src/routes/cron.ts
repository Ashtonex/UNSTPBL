import { timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { dispatchDueScheduledPushNotifications } from '../lib/pushDispatcher.js';
import { dispatchTodaysBirthdayAnnouncements } from '../lib/birthdayDispatcher.js';
import { db } from '../lib/db.js';
import { sendDailyVerses } from '../lib/sms/memberMessages.js';
import { defaultSmsDeps } from '../lib/sms/store.js';
import { churchToday, getTodayVersePayload } from './verses.js';

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

// Texts today's verse to members who opted in. Idempotent: anyone already messaged
// today is skipped, so it is safe for a scheduler to call this repeatedly.
cronRoutes.post('/cron/sms/daily-verse', async (c) => {
  const secret = c.req.header('x-cron-secret') || c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!isValidCronSecret(secret)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Africa/Harare is UTC+2 all year (no daylight saving), so "today" starts at 22:00 UTC the day before.
    const startOfTodayUtc = new Date(`${churchToday()}T00:00:00+02:00`);
    const summary = await sendDailyVerses(db, defaultSmsDeps(), {
      startOfTodayUtc,
      getVerse: (translation) => getTodayVersePayload(translation),
    });
    return c.json({ success: true, ...summary });
  } catch (err) {
    console.error('Cron daily-verse SMS failed:', err);
    return c.json({ error: 'Internal server error' }, 500);
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
