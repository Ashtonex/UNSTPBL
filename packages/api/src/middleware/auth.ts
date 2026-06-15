import { createMiddleware } from 'hono/factory';
import { createClient } from '@supabase/supabase-js';
import type { UserRole } from '@unstpbl/shared';

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

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    return c.json({ error: 'Server configuration error' }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  // Fetch user role from our users table
  const { data: dbUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  c.set('user', {
    id: user.id,
    email: user.email || '',
    role: (dbUser?.role as UserRole) || 'member',
  });

  await next();
});
