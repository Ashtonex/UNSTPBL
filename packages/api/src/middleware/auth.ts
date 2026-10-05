import { createMiddleware } from 'hono/factory';
import * as Sentry from '@sentry/node';
import type { UserRole } from '@unstpbl/shared';
import { resolveAuth } from '../lib/authCache.js';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

/**
 * Validates a Supabase JWT from the Authorization header.
 * Sets the authenticated user in the Hono context.
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('Missing Supabase configuration');
    return c.json({ error: 'Server configuration error' }, 500);
  }

  let auth;
  try {
    auth = await resolveAuth(token);
  } catch (err) {
    // The lookup itself broke (bad Supabase config, upstream outage, ...). That
    // is not the caller's fault, so don't report it as an invalid token.
    console.error('Auth lookup failed:', err);
    Sentry.captureException(err);
    return c.json({ error: 'Authentication service unavailable' }, 503);
  }
  if (!auth) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('user', { id: auth.id, email: auth.email, role: auth.role });

  await next();
});
