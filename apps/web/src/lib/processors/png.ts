import exifr from 'exifr';
import type { MetadataField, MetadataSnapshot, ScrubProfile } from '@scrubsafe/shared-types';
import { buildField } from '../utils/metadata-schema';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CleanResult {
  clean: ArrayBuffer;
  before: MetadataSnapshot;
  after: MetadataSnapshot;
}

export const DEFAULT_PROFILE: ScrubProfile = {
  removeGps: true,
  removeDevice: true,
  removeAuthor: true,
  removeSoftware: true,
  removeHistory: true,
};

// ─── PNG chunk parser ─────────────────────────────────────────────────────────

interface PngChunk {
  type: string;   // 4-char ASCII
  data: Uint8Array;
  offset: number; // byte offset in source buffer (for debugging)
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(src: Uint8Array): boolean {
  if (src.length < 8) return false;
  for (let i = 0; i < 8; i++) if (src[i] !== PNG_SIG[i]) return false;
  return true;
}

function parsePng(buffer: ArrayBuffer): PngChunk[] {
  const src = new Uint8Array(buffer);
  if (!isPng(src)) throw new Error('Not a PNG');

  const chunks: PngChunk[] = [];
  let i = 8; // skip signature

  while (i + 12 <= src.length) {
    const length = (src[i]! << 24 | src[i+1]! << 16 | src[i+2]! << 8 | src[i+3]!) >>> 0;
    const type = String.fromCharCode(src[i+4]!, src[i+5]!, src[i+6]!, src[i+7]!);
    const data = src.slice(i + 8, i + 8 + length);
    chunks.push({ type, data, offset: i });
    i += 12 + length; // length(4) + type(4) + data(length) + crc(4)
    if (type === 'IEND') break;
  }

  return chunks;
}

// ─── CRC-32 ───────────────────────────────────────────────────────────────────

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c;
  }
  return t;
})();

function crc32(type: string, data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < 4; i++) crc = CRC_TABLE[(crc ^ type.charCodeAt(i)) & 0xff]! ^ (crc >>> 8);
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── PNG reassembly ───────────────────────────────────────────────────────────

function assemblePng(chunks: PngChunk[]): ArrayBuffer {
  // Each chunk: 4 (length) + 4 (type) + data.length + 4 (crc)
  const total = 8 + chunks.reduce((n, c) => n + 12 + c.data.length, 0);
  const out = new Uint8Array(total);

  // Write PNG signature.
  for (let i = 0; i < 8; i++) out[i] = PNG_SIG[i]!;
  let off = 8;

  for (const chunk of chunks) {
    const len = chunk.data.length;
    // Length (big-endian)
    out[off]     = (len >>> 24) & 0xff;
    out[off + 1] = (len >>> 16) & 0xff;
    out[off + 2] = (len >>> 8)  & 0xff;
    out[off + 3] =  len         & 0xff;
    // Type
    for (let i = 0; i < 4; i++) out[off + 4 + i] = chunk.type.charCodeAt(i);
    // Data
    out.set(chunk.data, off + 8);
    // CRC over type+data
    const crc = crc32(chunk.type, chunk.data);
    out[off + 8 + len]     = (crc >>> 24) & 0xff;
    out[off + 8 + len + 1] = (crc >>> 16) & 0xff;
    out[off + 8 + len + 2] = (crc >>> 8)  & 0xff;
    out[off + 8 + len + 3] =  crc         & 0xff;
    off += 12 + len;
  }

  return out.buffer;
}

// ─── Chunk classification ─────────────────────────────────────────────────────
// Structural chunks that must be preserved regardless of profile.
const STRUCTURAL = new Set(['IHDR', 'IDAT', 'IEND', 'PLTE', 'tRNS',
  'sRGB', 'gAMA', 'cHRM', 'iCCP', 'sBIT', 'bKGD', 'hIST', 'pHYs', 'sPLT', 'acTL', 'fcTL', 'fdAT']);

function shouldDropChunk(chunk: PngChunk, profile: ScrubProfile): boolean {
  if (STRUCTURAL.has(chunk.type)) return false;

  switch (chunk.type) {
    case 'eXIf':
      // Embedded EXIF — contains GPS, device, author, history.
      return profile.removeGps || profile.removeDevice || profile.removeAuthor ||
             profile.removeSoftware || profile.removeHistory;
    case 'tEXt':
    case 'iTXt':
    case 'zTXt': {
      // Text chunks: keyword is null-terminated (tEXt/zTXt) or starts before \0 (iTXt).
      const nullIdx = chunk.data.indexOf(0);
      const keyword = new TextDecoder('latin1')
        .decode(nullIdx >= 0 ? chunk.data.slice(0, nullIdx) : chunk.data)
        .toLowerCase();
      // Author/creator keywords
      if (/author|artist|creator|copyright|rights|by-line|contact|email/.test(keyword))
        return profile.removeAuthor;
      // Software keywords
      if (/software|tool|producer|comment|description|source|generator/.test(keyword))
        return profile.removeSoftware;
      // Date/history keywords
      if (/date|time|creat|modif|origin|digit/.test(keyword))
        return profile.removeHistory;
      // Drop unrecognised text chunks under any active flag (they may contain PII).
      return profile.removeAuthor || profile.removeSoftware || profile.removeHistory;
    }
    case 'tIME':
      return profile.removeHistory;
    default:
      return false;
  }
}

// ─── Text chunk metadata extraction ──────────────────────────────────────────

function extractTextChunkField(chunk: PngChunk): MetadataField | null {
  const nullIdx = chunk.data.indexOf(0);
  if (nullIdx < 0) return null;

  const keyword = new TextDecoder('latin1').decode(chunk.data.slice(0, nullIdx));

  let value: string;
  if (chunk.type === 'tEXt') {
    value = new TextDecoder('latin1').decode(chunk.data.slice(nullIdx + 1));
  } else if (chunk.type === 'iTXt') {
    // iTXt: keyword\0compression_flag(1)\0language\0translated_keyword\0text
    let pos = nullIdx + 3; // skip null + compression flag + null
    // skip language
    const langEnd = chunk.data.indexOf(0, pos);
    pos = langEnd >= 0 ? langEnd + 1 : pos;
    // skip translated keyword
    const tkEnd = chunk.data.indexOf(0, pos);
    pos = tkEnd >= 0 ? tkEnd + 1 : pos;
    value = new TextDecoder('utf-8').decode(chunk.data.slice(pos));
  } else {
    // zTXt: compressed — skip for now, just record keyword
    value = '(compressed)';
  }

  return buildField('png', keyword, value);
}

function extractTimeChunkField(chunk: PngChunk): MetadataField | null {
  if (chunk.data.length < 7) return null;
  const year  = (chunk.data[0]! << 8) | chunk.data[1]!;
  const month = chunk.data[2]!;
  const day   = chunk.data[3]!;
  const hour  = chunk.data[4]!;
  const min   = chunk.data[5]!;
  const sec   = chunk.data[6]!;
  const value = `${year}:${String(month).padStart(2,'0')}:${String(day).padStart(2,'0')} ${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return buildField('png', 'tIME', value);
}

// ─── inspect ─────────────────────────────────────────────────────────────────

type ExifrGroups = Record<string, Record<string, unknown> | null | undefined>;

export async function inspect(buffer: ArrayBuffer): Promise<MetadataSnapshot> {
  const fields: MetadataField[] = [];
  const seenKeys = new Set<string>();

  // exifr handles eXIf chunks and any embedded EXIF.
  try {
    const parsed = (await exifr.parse(buffer, {
      translateValues: false,
      reviveValues: false,
      sanitize: false,
      mergeOutput: false,
      gps: true,
      exif: true,
      iptc: true,
      xmp: true,
      tiff: true,
      icc: false,
    })) as ExifrGroups | undefined;

    if (parsed) {
      for (const [group, tags] of Object.entries(parsed)) {
        if (!tags || typeof tags !== 'object') continue;
        for (const [tagName, value] of Object.entries(tags)) {
          const f = buildField(group, tagName, value);
          if (!seenKeys.has(f.key)) { fields.push(f); seenKeys.add(f.key); }
        }
      }
    }
  } catch { /* no EXIF */ }

  // Manual pass over text/time chunks that exifr doesn't expose.
  try {
    const chunks = parsePng(buffer);
    for (const chunk of chunks) {
      if (chunk.type === 'tEXt' || chunk.type === 'iTXt' || chunk.type === 'zTXt') {
        const f = extractTextChunkField(chunk);
        if (f && !seenKeys.has(f.key)) { fields.push(f); seenKeys.add(f.key); }
      } else if (chunk.type === 'tIME') {
        const f = extractTimeChunkField(chunk);
        if (f && !seenKeys.has(f.key)) { fields.push(f); seenKeys.add(f.key); }
      }
    }
  } catch { /* not a valid PNG */ }

  return { fields };
}

// ─── clean ───────────────────────────────────────────────────────────────────

export async function clean(
  buffer: ArrayBuffer,
  profile: ScrubProfile = DEFAULT_PROFILE,
): Promise<CleanResult> {
  const before = await inspect(buffer);

  let cleaned: ArrayBuffer;
  try {
    const chunks = parsePng(buffer);
    const kept = chunks.filter((c) => !shouldDropChunk(c, profile));
    cleaned = assemblePng(kept);
  } catch {
    cleaned = buffer;
  }

  const after = await inspect(cleaned);
  return { clean: cleaned, before, after };
}

// ─── Worker entry point ───────────────────────────────────────────────────────

export async function stripPng(buffer: ArrayBuffer): Promise<CleanResult> {
  return clean(buffer, DEFAULT_PROFILE);
}
