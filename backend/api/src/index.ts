import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { corsMiddleware } from './middleware/cors';
import { rateLimitMiddleware } from './middleware/rate-limit';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import usageRoutes from './routes/usage';
import billingRoutes from './routes/billing';
import type { HonoEnv } from './types';

const app = new Hono<HonoEnv>();

app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', corsMiddleware);
app.use('/api/usage/*', rateLimitMiddleware);
app.use('/api/billing/*', rateLimitMiddleware);

app.route('/health', healthRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/usage', usageRoutes);
app.route('/api/billing', billingRoutes);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error('[error]', err.message);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
