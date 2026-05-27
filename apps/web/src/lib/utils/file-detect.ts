import type { SupportedMime } from '@scrubsafe/shared-types';

interface MagicSignature {
  mime: SupportedMime;
  bytes: number[];
  offset?: number;
}

const SIGNATURES: MagicSignature[] = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/tiff', bytes: [0x49, 0x49, 0x2a, 0x00] }, // little-endian
  { mime: 'image/tiff', bytes: [0x4d, 0x4d, 0x00, 0x2a] }, // big-endian
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
];

// ftyp box: bytes 4-7 are "ftyp", bytes 8-11 are the major brand.
// We check the brand explicitly so we don't false-match MP4 video or M4A audio,
// which also carry an ftyp box but different brands.
const HEIC_BRANDS = new Set([
  'heic', 'heis', 'hevc', 'hevx', 'heim', 'heix', 'hevm', 'hevs',
  'mif1', 'msf1', 'heif',
]);

const ZIP_MAGIC = [0x50, 0x4b];

const OFFICE_PATH_PREFIXES: Array<[string, SupportedMime]> = [
  ['word/', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['xl/', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['ppt/', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
];

export async function detectMime(file: File): Promise<SupportedMime | null> {
  // 16 bytes is enough for all signatures + HEIC brand (8 + 4 = 12).
  const headerBuf = await file.slice(0, 16).arrayBuffer();
  const header = new Uint8Array(headerBuf);

  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (sig.bytes.every((b, i) => header[offset + i] === b)) {
      return sig.mime;
    }
  }

  if (isHeic(header)) {
    return 'image/heic';
  }

  if (header[0] === ZIP_MAGIC[0] && header[1] === ZIP_MAGIC[1]) {
    return detectOfficeMime(file);
  }

  return null;
}

/**
 * HEIC detection: ftyp box type at bytes 4-7, major brand at bytes 8-11.
 * Reading 16 bytes (done in detectMime) is sufficient for both checks.
 */
function isHeic(header: Uint8Array): boolean {
  if (header.length < 12) return false;

  // Box type must be "ftyp"
  if (
    header[4] !== 0x66 || // f
    header[5] !== 0x74 || // t
    header[6] !== 0x79 || // y
    header[7] !== 0x70    // p
  ) {
    return false;
  }

  // length >= 12 is guaranteed by the guard above, so indexing is safe.
  const brand = String.fromCharCode(header[8]!, header[9]!, header[10]!, header[11]!).toLowerCase();
  return HEIC_BRANDS.has(brand);
}

async function detectOfficeMime(file: File): Promise<SupportedMime | null> {
  // Read enough of the ZIP central directory to find the first local file entry name.
  const chunk = await file.slice(0, 512).arrayBuffer();
  const text = new TextDecoder('ascii', { fatal: false }).decode(chunk);

  for (const [prefix, mime] of OFFICE_PATH_PREFIXES) {
    if (text.includes(prefix)) return mime;
  }

  return null;
}
