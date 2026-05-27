import { Hono } from 'hono';
import type { HonoEnv } from '../types';

const health = new Hono<HonoEnv>();

health.get('/', (c) =>
  c.json({
    status: 'ok',
    env: c.env.ENVIRONMENT,
    ts: Date.now(),
  }),
);

export default health;
