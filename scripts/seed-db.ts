/**
 * Seeds the local D1 database with development fixtures.
 * Run via: pnpm --filter @scrubsafe/api db:migrate:local
 * Then:    pnpm tsx scripts/seed-db.ts
 */

const FREE_USER = {
  id: 'dev-user-free-001',
  email: 'free@example.com',
  plan: 'free',
};

const PRO_USER = {
  id: 'dev-user-pro-001',
  email: 'pro@example.com',
  plan: 'pro',
};

async function seed() {
  const { execSync } = await import('child_process');

  const insert = (user: typeof FREE_USER) =>
    `INSERT OR IGNORE INTO users (id, email, plan) VALUES ('${user.id}', '${user.email}', '${user.plan}');`;

  const sql = [insert(FREE_USER), insert(PRO_USER)].join('\n');

  execSync(
    `wrangler d1 execute scrubsafe --local --command="${sql}"`,
    { stdio: 'inherit', cwd: new URL('../backend/api', import.meta.url).pathname },
  );

  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
