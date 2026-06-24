import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import 'dotenv/config';
import * as Sentry from '@sentry/node';

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN_API || 'https://c00a078fcf47893596672eb2c21b4fa6@o4511622101925888.ingest.de.sentry.io/4511622119424080',
  tracesSampleRate: 1.0,
});

import { healthRoutes } from './routes/health.js';
import { verseRoutes } from './routes/verses.js';
import { adminRoutes } from './routes/admin.js';
import { profileRoutes } from './routes/profile.js';
import { pushRoutes } from './routes/push.js';

const app = new Hono();

// ── Global Middleware ───────────────────────────────────────────────────────

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (
        !origin ||
        origin.startsWith('http://localhost:') ||
        origin.endsWith('.vercel.app') ||
        origin === 'https://unstpbl-seven.vercel.app'
      ) {
        return origin;
      }
      return process.env.CORS_ORIGIN || 'http://localhost:5173';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// ── Routes ──────────────────────────────────────────────────────────────────

app.route('/', healthRoutes);
app.route('/', verseRoutes);
app.route('/', adminRoutes);
app.route('/', profileRoutes);
app.route('/', pushRoutes);

// ── Error Handling ──────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  Sentry.captureException(err);
  return c.json({ error: 'Internal server error' }, 500);
});

// ── Start Server ────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT || '3001', 10);
console.log(`🚀 UNSTPBL API running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });

export default app;
