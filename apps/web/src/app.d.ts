import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

declare global {
  namespace App {
    interface Locals {
      user: { id: string; email: string; plan: 'free' | 'pro' } | null;
    }
    interface Error {
      code?: string;
      message: string;
    }
    interface PageData {}
    interface PageState {}
    interface Platform {
      env: {
        ENVIRONMENT: string;
        SCRUBSAFE_DB: D1Database;
        RATE_LIMIT: KVNamespace;
      };
      cf: Record<string, unknown>;
      ctx: { waitUntil(promise: Promise<unknown>): void };
    }
  }
}

export {};
