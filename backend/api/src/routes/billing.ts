import { Hono } from 'hono';
import type { HonoEnv } from '../types';

const billing = new Hono<HonoEnv>();

// Stripe webhook — updates plan in D1 after successful payment
billing.post('/webhook', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) return c.json({ error: 'Missing signature' }, 400);

  // TODO: verify Stripe signature, handle checkout.session.completed and
  //       customer.subscription.deleted events, update D1 plan field
  return c.json({ received: true });
});

// Creates a Stripe Checkout session and returns the redirect URL
billing.post('/checkout', async (c) => {
  // TODO: create Stripe Checkout session for authenticated user
  return c.json({ error: 'Not implemented' }, 501);
});

// Redirects authenticated user to Stripe Customer Portal
billing.get('/portal', async (c) => {
  // TODO: create portal session, redirect
  return c.json({ error: 'Not implemented' }, 501);
});

export default billing;
