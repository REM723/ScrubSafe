#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$REPO_ROOT/apps/web/static/wasm"

mkdir -p "$OUT_DIR"

echo "==> Building libheif WASM..."
# TODO: clone libheif, run emcmake cmake, copy output
# Expected output: $OUT_DIR/libheif.wasm
echo "    [skipped — not yet implemented]"

echo "==> Building qpdf WASM..."
# TODO: clone qpdf, configure with Emscripten, copy output
# Expected output: $OUT_DIR/qpdf.wasm
echo "    [skipped — not yet implemented]"

echo "==> Computing SHA-256 hashes..."
if command -v sha256sum &>/dev/null; then
  for f in "$OUT_DIR"/*.wasm; do
    [ -f "$f" ] && sha256sum "$f"
  done
elif command -v shasum &>/dev/null; then
  for f in "$OUT_DIR"/*.wasm; do
    [ -f "$f" ] && shasum -a 256 "$f"
  done
fi

echo "==> Done. Update EXPECTED_HASHES in apps/web/src/lib/workers/wasm-loader.ts"
