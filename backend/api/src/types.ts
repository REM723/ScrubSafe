import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

export interface Env {
  ENVIRONMENT: string;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  APP_URL: string;
  SCRUBSAFE_DB: D1Database;
  RATE_LIMIT: KVNamespace;
}

export interface JwtPayload {
  sub: string;
  email: string;
  plan: 'free' | 'pro';
  iat: number;
  exp: number;
}

export type HonoEnv = { Bindings: Env; Variables: { user: JwtPayload } };
