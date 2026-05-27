export type WasmModuleId = 'libheif' | 'qpdf';

export interface WasmModule {
  instance: WebAssembly.Instance;
  memory: WebAssembly.Memory;
}

// SHA-256 hashes populated after WASM binaries are built.
const EXPECTED_HASHES: Record<WasmModuleId, string> = {
  libheif: '', // TODO: populate after running scripts/build-wasm.sh
  qpdf: '', // TODO: populate after running scripts/build-wasm.sh
};

const cache = new Map<WasmModuleId, WasmModule>();

export async function loadWasm(id: WasmModuleId): Promise<WasmModule> {
  const cached = cache.get(id);
  if (cached) return cached;

  const response = await fetch(`/wasm/${id}.wasm`);
  if (!response.ok) {
    throw new Error(`Failed to fetch WASM module "${id}": HTTP ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  await verifyIntegrity(id, buffer);

  const { instance } = await WebAssembly.instantiate(buffer, buildImports(id));
  const memory = instance.exports['memory'] as WebAssembly.Memory;

  if (!(memory instanceof WebAssembly.Memory)) {
    throw new Error(`WASM module "${id}" does not export a memory instance`);
  }

  const module: WasmModule = { instance, memory };
  cache.set(id, module);
  return module;
}

export function unloadWasm(id: WasmModuleId): void {
  cache.delete(id);
}

async function verifyIntegrity(id: WasmModuleId, buffer: ArrayBuffer): Promise<void> {
  const expected = EXPECTED_HASHES[id];
  if (!expected) return; // Skip verification until hashes are populated

  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const actual = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (actual !== expected) {
    throw new Error(
      `WASM integrity check failed for "${id}". Expected ${expected}, got ${actual}`,
    );
  }
}

function buildImports(id: WasmModuleId): WebAssembly.Imports {
  const base: WebAssembly.Imports = {
    env: {
      memory: new WebAssembly.Memory({ initial: 256, maximum: id === 'libheif' ? 4096 : 2048 }),
    },
  };
  return base;
}
