# ScrubSafe

**Strip file metadata entirely in your browser.** No uploads. No accounts. No exceptions.

ScrubSafe removes EXIF, GPS, XMP, IPTC, and document metadata from images and office files using WebAssembly running inside your browser tab. Your file bytes never touch a server.

## Supported formats

| Format | Metadata removed |
|--------|-----------------|
| JPEG | EXIF, GPS, XMP, IPTC, COM segments |
| PNG | tEXt/zTXt/iTXt/eXIf chunks |
| TIFF | All IFD fields except structural tags |
| HEIC/HEIF | EXIF item data, XMP mime items (in-place ISOBMFF patch) |
| PDF | Info dictionary, XMP stream, OpenAction, embedded JavaScript |
| DOCX / XLSX / PPTX | `core.xml`, `app.xml`, custom properties |

## Architecture

```
UI thread
  └─ postMessage(ArrayBuffer, [transfer])
       └─ Web Worker
            └─ processor (JS / WASM)
                 └─ postMessage(cleanBuffer, [transfer])
                      └─ UI thread
```

The `ArrayBuffer` is **transferred** (zero-copy) to the worker — the original reference is detached. File bytes never touch a network socket.


## Monorepo layout

```
apps/web/          SvelteKit frontend — all file processing lives here
backend/api/       Hono Cloudflare Worker — auth, usage counters, billing only
packages/shared-types/  TypeScript types shared between web and api
infra/             Caddyfile for local reverse proxy
scripts/           WASM build + DB seed scripts
```

## Getting started

**Prerequisites:** Node ≥ 20, pnpm ≥ 9

```bash
# Install dependencies
pnpm install

# Start the SvelteKit dev server (http://localhost:5173)
pnpm dev

# Start the Hono API worker (http://localhost:8787)
pnpm --filter @scrubsafe/api dev
```

## Dev commands

```bash
pnpm dev           # SvelteKit on :5173
pnpm check         # TypeScript check all packages
pnpm test          # Vitest unit tests
pnpm test:e2e      # Playwright e2e tests
pnpm lint          # ESLint all packages
pnpm format        # Prettier all packages
```

## Privacy guarantee

The core architectural rule: **no file bytes may ever leave the browser.** The backend never receives, processes, or stores file content. Any server-side file handling is a fundamental violation of ScrubSafe's product contract.

