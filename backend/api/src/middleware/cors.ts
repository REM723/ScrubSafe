import { cors } from 'hono/cors';

const ALLOWED_ORIGINS = ['http://localhost:5173', 'https://scrubsafe.com'];

export const corsMiddleware = cors({
  origin: (origin) => (ALLOWED_ORIGINS.includes(origin) ? origin : null),
  credentials: true,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
});
