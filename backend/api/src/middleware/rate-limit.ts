import type { MiddlewareHandler } from 'hono';
import type { HonoEnv } from '../types';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

export const rateLimitMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
  const key = `rl:${ip}:${Math.floor(Date.now() / WINDOW_MS)}`;

  const current = await c.env.RATE_LIMIT.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= MAX_REQUESTS) {
    return c.json({ error: 'Too many requests' }, 429);
  }

  await c.env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 120 });

  await next();
};
