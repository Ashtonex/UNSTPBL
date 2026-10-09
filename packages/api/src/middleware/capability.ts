import { createMiddleware } from 'hono/factory';
import { can, type Capability } from '@unstpbl/shared';
import { authMiddleware } from './auth.js';

/**
 * Role guard for one capability (see packages/shared/src/roles.ts for who has what).
 * Must run after authMiddleware; `guard()` bundles the two so a route cannot forget either.
 */
export const requireCapability = (capability: Capability) =>
  createMiddleware(async (c, next) => {
    const user = c.get('user');
    if (!user || !can(user.role, capability)) {
      return c.json({ error: 'Forbidden: you do not have access to this.' }, 403);
    }
    await next();
  });

export const guard = (capability: Capability) => [authMiddleware, requireCapability(capability)] as const;
