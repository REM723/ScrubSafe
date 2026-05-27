import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { HonoEnv } from '../types';

export const authMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const token = getCookie(c, 'session');

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // TODO: verify JWT using c.env.JWT_SECRET, set c.set('user', payload)
  await next();
};
