/**
 * libheif WASM adapter — loaded lazily inside the Web Worker only.
 *
 * Requires a compiled libheif.wasm in /public/wasm/ (see scripts/build-wasm.sh).
 * Hash the final binary and set EXPECTED_HASHES['libheif'] in wasm-loader.ts.
 *
 * libheif C API used here (Emscripten exports):
 *   heif_context_alloc()
 *   heif_context_read_from_memory_without_copy(ctx, data, size, *err)
 *   heif_context_get_primary_image_handle(ctx, *handle, *err)
 *   heif_image_handle_get_number_of_metadata_blocks(handle, type)
 *   heif_image_handle_get_list_of_metadata_block_IDs(handle, type, *ids, count)
 *   heif_image_handle_get_metadata_type(handle, id)
 *   heif_image_handle_get_metadata_size(handle, id)
 *   heif_image_handle_get_metadata(handle, id, *buf)
 *   heif_image_handle_release(handle)
 *   heif_context_free(ctx)
 *
 * Memory contract:
 *   Every allocation via _malloc must be freed via _free.
 *   All pointers passed to C functions must stay valid until the call returns.
 *   After heif_context_free(), all handles/images derived from that context
 *   are invalid — never store them beyond the scope of a decode call.
 */

import { loadWasm } from '../workers/wasm-loader';

// ─── WASM exports interface ───────────────────────────────────────────────────
// Only the subset of the libheif C API used by this adapter.

interface LibHeifExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  _malloc(size: number): number;
  _free(ptr: number): void;
  heif_context_alloc(): number;
  heif_context_free(ctx: number): void;
  heif_context_read_from_memory_without_copy(
    ctx: number, data: number, size: number, errPtr: number,
  ): number; // heif_error.code (0 = ok)
  heif_context_get_primary_image_handle(
    ctx: number, handlePtr: number, errPtr: number,
  ): number;
  heif_image_handle_get_number_of_metadata_blocks(
    handle: number, filterType: number,
  ): number;
  heif_image_handle_get_list_of_metadata_block_IDs(
    handle: number, filterType: number, idsPtr: number, count: number,
  ): number;
  heif_image_handle_get_metadata_size(handle: number, blockId: number): number;
  heif_image_handle_get_metadata(
    handle: number, blockId: number, bufPtr: number,
  ): number; // heif_error.code
  heif_image_handle_get_metadata_type(
    handle: number, blockId: number,
  ): number; // pointer to C string (static, do not free)
  heif_image_handle_release(handle: number): void;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface HeifMetadataBlock {
  /** 'Exif', 'XMP', or other libheif type string. */
  type: string;
  data: ArrayBuffer;
}

export interface HeifDecodeResult {
  blocks: HeifMetadataBlock[];
}

// ─── Module state ─────────────────────────────────────────────────────────────

let _exports: LibHeifExports | null = null;

async function getExports(): Promise<LibHeifExports> {
  if (_exports) return _exports;
  const mod = await loadWasm('libheif');
  _exports = mod.instance.exports as LibHeifExports;
  return _exports;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readCString(mem: WebAssembly.Memory, ptr: number): string {
  const view = new Uint8Array(mem.buffer);
  let end = ptr;
  while (view[end] !== 0) end++;
  return new TextDecoder().decode(view.slice(ptr, end));
}

function readBytes(mem: WebAssembly.Memory, ptr: number, size: number): ArrayBuffer {
  return mem.buffer.slice(ptr, ptr + size);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Decode a HEIC/HEIF buffer and return all embedded metadata blocks.
 * Must only be called from inside a Web Worker (WASM is not safe on main thread).
 *
 * Memory safety: all WASM pointers are freed before returning.
 * On error, throws — callers should catch and fall back to exifr.
 */
export async function extractMetadataBlocks(buffer: ArrayBuffer): Promise<HeifDecodeResult> {
  const ex = await getExports();
  const mem = ex.memory;
  const heap = new Uint8Array(mem.buffer);

  // Copy input bytes into WASM heap.
  const dataPtr = ex._malloc(buffer.byteLength);
  if (!dataPtr) throw new Error('libheif: malloc failed for input data');
  try {
    heap.set(new Uint8Array(buffer), dataPtr);

    // Allocate heif_error struct (16 bytes is safe for all platforms).
    const errPtr = ex._malloc(16);
    if (!errPtr) throw new Error('libheif: malloc failed for error struct');
    try {
      const ctx = ex.heif_context_alloc();
      if (!ctx) throw new Error('libheif: heif_context_alloc() returned null');
      try {
        const readErr = ex.heif_context_read_from_memory_without_copy(
          ctx, dataPtr, buffer.byteLength, errPtr,
        );
        if (readErr !== 0) throw new Error(`libheif: read error code ${readErr}`);

        // Get primary image handle.
        const handleSlot = ex._malloc(4); // pointer-sized slot
        if (!handleSlot) throw new Error('libheif: malloc failed for handle slot');
        try {
          const handleErr = ex.heif_context_get_primary_image_handle(ctx, handleSlot, errPtr);
          if (handleErr !== 0) throw new Error(`libheif: get_primary_image_handle error ${handleErr}`);

          const handle = new DataView(mem.buffer).getUint32(handleSlot, true);
          try {
            const blocks = readMetadataBlocks(ex, mem, handle);
            return { blocks };
          } finally {
            ex.heif_image_handle_release(handle);
          }
        } finally {
          ex._free(handleSlot);
        }
      } finally {
        ex.heif_context_free(ctx);
      }
    } finally {
      ex._free(errPtr);
    }
  } finally {
    ex._free(dataPtr);
  }
}

function readMetadataBlocks(
  ex: LibHeifExports,
  mem: WebAssembly.Memory,
  handle: number,
): HeifMetadataBlock[] {
  // 0 = no type filter (all metadata blocks)
  const count = ex.heif_image_handle_get_number_of_metadata_blocks(handle, 0);
  if (count <= 0) return [];

  const idsPtr = ex._malloc(count * 4); // uint32_t ids[]
  if (!idsPtr) return [];
  try {
    ex.heif_image_handle_get_list_of_metadata_block_IDs(handle, 0, idsPtr, count);
    const ids = new Uint32Array(mem.buffer, idsPtr, count);

    const blocks: HeifMetadataBlock[] = [];
    for (let i = 0; i < count; i++) {
      const blockId = ids[i]!;
      const typePtr = ex.heif_image_handle_get_metadata_type(handle, blockId);
      const type = readCString(mem, typePtr);
      const size = ex.heif_image_handle_get_metadata_size(handle, blockId);
      if (size <= 0) continue;

      const bufPtr = ex._malloc(size);
      if (!bufPtr) continue;
      try {
        const metaErr = ex.heif_image_handle_get_metadata(handle, blockId, bufPtr);
        if (metaErr !== 0) continue;
        blocks.push({ type, data: readBytes(mem, bufPtr, size) });
      } finally {
        ex._free(bufPtr);
      }
    }
    return blocks;
  } finally {
    ex._free(idsPtr);
  }
}

/**
 * Release the cached WASM module (call between tests or when unloading).
 */
export function resetLibHeif(): void {
  _exports = null;
}
