import { createMiddleware } from 'hono/factory';

/**
 * Role guard that restricts access to bishop-only routes.
 * Must be used after authMiddleware.
 */
export const bishopMiddleware = createMiddleware(async (c, next) => {
  const user = c.get('user');

  if (!user || (user.role !== 'bishop' && user.role !== 'admin')) {
    return c.json({ error: 'Forbidden: Bishop or Admin access required' }, 403);
  }

  await next();
});
