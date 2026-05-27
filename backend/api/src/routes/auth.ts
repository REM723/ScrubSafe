import { Hono } from 'hono';
import type { HonoEnv } from '../types';

const auth = new Hono<HonoEnv>();

// Redirects to Google OAuth2 consent screen
auth.get('/google', (c) => {
  // TODO: build OAuth2 authorization URL and redirect
  return c.json({ error: 'Not implemented' }, 501);
});

// Receives authorization code from Google, issues JWT cookie
auth.get('/google/callback', async (c) => {
  // TODO: exchange code for tokens, upsert user, issue httpOnly JWT cookie
  return c.json({ error: 'Not implemented' }, 501);
});

auth.post('/logout', (c) => {
  c.header(
    'Set-Cookie',
    'session=; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=0',
  );
  return c.json({ ok: true });
});

export default auth;
