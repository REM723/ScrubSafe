import type { D1Database } from '@cloudflare/workers-types';

export interface User {
  id: string;
  email: string;
  plan: 'free' | 'pro';
  stripe_customer_id: string | null;
  created_at: number;
  updated_at: number;
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>();
  return row ?? null;
}

export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  const row = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User>();
  return row ?? null;
}

export async function upsertUser(db: D1Database, id: string, email: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (id, email)
       VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET updated_at = unixepoch()`,
    )
    .bind(id, email)
    .run();
}

export async function updateUserPlan(
  db: D1Database,
  id: string,
  plan: 'free' | 'pro',
  stripeCustomerId?: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE users
       SET plan = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), updated_at = unixepoch()
       WHERE id = ?`,
    )
    .bind(plan, stripeCustomerId ?? null, id)
    .run();
}

export async function getMonthlyUsage(db: D1Database, userId: string): Promise<number> {
  const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(count), 0) AS total
       FROM usage_events
       WHERE user_id = ? AND created_at >= ?`,
    )
    .bind(userId, monthStart)
    .first<{ total: number }>();
  return row?.total ?? 0;
}

export async function incrementUsage(
  db: D1Database,
  userId: string,
  count: number,
): Promise<void> {
  await db
    .prepare('INSERT INTO usage_events (id, user_id, count) VALUES (?, ?, ?)')
    .bind(crypto.randomUUID(), userId, count)
    .run();
}
