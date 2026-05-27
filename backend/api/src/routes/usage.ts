import { Hono } from 'hono';
import { getMonthlyUsage, incrementUsage } from '../db/queries';
import type { HonoEnv } from '../types';

const usage = new Hono<HonoEnv>();

// Accepts ONLY a scrub count. File bytes must never appear here.
usage.post('/', async (c) => {
  const body = await c.req.json<{ count?: unknown }>();

  if (typeof body.count !== 'number' || !Number.isInteger(body.count) || body.count < 1) {
    return c.json({ error: 'count must be a positive integer' }, 400);
  }

  // TODO: extract user from JWT, enforce plan limits
  const userId = 'anonymous'; // placeholder until auth is wired
  await incrementUsage(c.env.SCRUBSAFE_DB, userId, body.count);

  return c.json({ ok: true });
});

usage.get('/', async (c) => {
  // TODO: extract user from JWT
  const userId = 'anonymous';
  const total = await getMonthlyUsage(c.env.SCRUBSAFE_DB, userId);

  return c.json({
    filesScrubbedThisMonth: total,
    plan: 'free',
    limit: 25,
  });
});

export default usage;
