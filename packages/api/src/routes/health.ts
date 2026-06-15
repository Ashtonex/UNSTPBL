import { Hono } from 'hono';

export const healthRoutes = new Hono();

healthRoutes.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'unstpbl-api',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});
