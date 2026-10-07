import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { isCorsOriginAllowed } from './lib/env.js';

if (process.env.SENTRY_DSN_API) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN_API,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  });
}

import { healthRoutes } from './routes/health.js';
import { verseRoutes } from './routes/verses.js';
import { adminRoutes } from './routes/admin.js';
import { profileRoutes } from './routes/profile.js';
import { pushRoutes } from './routes/push.js';
import { cronRoutes } from './routes/cron.js';
import { communityRoutes } from './routes/community.js';
import { birthdayRoutes } from './routes/birthdays.js';

export function createApp() {
  const app = new Hono();

  // ── Global Middleware ─────────────────────────────────────────────────────

  app.use('*', logger());
  app.use(
    '*',
    cors({
      origin: (origin) => {
        return isCorsOriginAllowed(origin) ? origin : undefined;
      },
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  );

  // ── Routes ────────────────────────────────────────────────────────────────

  app.route('/', healthRoutes);
  app.route('/', verseRoutes);
  app.route('/', adminRoutes);
  app.route('/', profileRoutes);
  app.route('/', pushRoutes);
  app.route('/', cronRoutes);
  app.route('/', communityRoutes);
  app.route('/', birthdayRoutes);

  // ── Error Handling ────────────────────────────────────────────────────────

  app.notFound((c) => c.json({ error: 'Not found' }, 404));

  app.onError((err, c) => {
    console.error('Unhandled error:', err);
    Sentry.captureException(err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  return app;
}

// ── Start Server ────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT || '3001', 10);
const app = createApp();

if (process.env.NODE_ENV !== 'test') {
  console.log(`UNSTPBL API running on http://localhost:${port}`);
  serve({ fetch: app.fetch, port, hostname: '0.0.0.0' });
}

export default app;
