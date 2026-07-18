import { createMiddleware } from 'hono/factory';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function getClientKey(c: any, prefix: string): string {
  const user = c.get('user');
  if (user?.id) return `${prefix}:user:${user.id}`;

  const forwardedFor = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = c.req.header('x-real-ip');
  return `${prefix}:ip:${forwardedFor || realIp || 'unknown'}`;
}

export function createRateLimit({ windowMs, max, keyPrefix = 'route' }: RateLimitOptions) {
  return createMiddleware(async (c, next) => {
    const now = Date.now();
    const key = getClientKey(c, keyPrefix);
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    if (current.count >= max) {
      c.header('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
      return c.json({ error: 'Too many requests. Please try again shortly.' }, 429);
    }

    current.count += 1;
    await next();
  });
}

export function resetRateLimitBuckets() {
  buckets.clear();
}
