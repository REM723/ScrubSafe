# ScrubSafe

Browser-based metadata stripping tool. All file processing happens in-browser via WebAssembly.

## Critical rule

**NO FILE BYTES may ever leave the browser.** Any server-side file handling is a fundamental architectural violation. The backend never receives, processes, or stores file content.

## Stack

- SvelteKit + Svelte 5 (apps/web)
- TypeScript strict throughout
- Tailwind CSS v4 (@tailwindcss/vite)
- Hono on Cloudflare Workers (backend/api)
- Cloudflare Pages + D1 + KV
- Vitest (unit) + Playwright (e2e)

## Dev commands

```bash
pnpm dev                              # SvelteKit on :5173
pnpm --filter @scrubsafe/api dev      # Hono worker on :8787
pnpm check                            # TypeScript check all packages
pnpm test                             # Vitest unit tests
pnpm test:e2e                         # Playwright e2e
pnpm lint                             # ESLint all packages
pnpm format                           # Prettier all packages
```

## Workspace layout

```
apps/web/          SvelteKit frontend — all file processing lives here
backend/api/       Hono Cloudflare Worker — auth, usage counters, billing only
packages/shared-types/  Types shared between web and api
infra/             Caddyfile for local reverse proxy
scripts/           WASM build + DB seed scripts
```

## File processing pipeline

```
UI thread → postMessage(ArrayBuffer) → Web Worker → WASM processor → postMessage(cleanBuffer) → UI thread
```

Worker owns WASM lifecycle. ArrayBuffer is transferred (zero-copy), never cloned.
