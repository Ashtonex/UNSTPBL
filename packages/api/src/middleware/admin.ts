import { createMiddleware } from 'hono/factory';

/**
 * Role guard that restricts access to admin-only routes.
 * Must be used after authMiddleware.
 */
export const adminOnlyMiddleware = createMiddleware(async (c, next) => {
  const user = c.get('user');

  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }

  await next();
});
