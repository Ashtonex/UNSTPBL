import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import 'dotenv/config';

import { healthRoutes } from './routes/health.js';
import { verseRoutes } from './routes/verses.js';
import { adminRoutes } from './routes/admin.js';

const app = new Hono();

// ── Global Middleware ───────────────────────────────────────────────────────

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// ── Routes ──────────────────────────────────────────────────────────────────

app.route('/', healthRoutes);
app.route('/', verseRoutes);
app.route('/', adminRoutes);

// ── Error Handling ──────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// ── Start Server ────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT || '3001', 10);
console.log(`🚀 UNSTPBL API running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });

export default app;
