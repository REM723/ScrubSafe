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

// ─── ISOBMFF box helpers ──────────────────────────────────────────────────────

function ru16(src: Uint8Array, off: number): number {
  return ((src[off]! << 8) | src[off + 1]!) >>> 0;
}

function ru32(src: Uint8Array, off: number): number {
  return ((src[off]! << 24) | (src[off + 1]! << 16) | (src[off + 2]! << 8) | src[off + 3]!) >>> 0;
}

function btype(src: Uint8Array, off: number): string {
  return String.fromCharCode(src[off]!, src[off + 1]!, src[off + 2]!, src[off + 3]!);
}

interface ISOBox {
  type: string;
  offset: number;    // byte position of the box in src
  size: number;      // total box size (including header)
  dataOffset: number; // byte position of box payload (after size+type)
}

/** Walk a flat sequence of ISOBMFF boxes within [start, end). */
function walkBoxes(src: Uint8Array, start: number, end: number): ISOBox[] {
  const result: ISOBox[] = [];
  let off = start;
  while (off + 8 <= end) {
    const size32 = ru32(src, off);
    const type   = btype(src, off + 4);
    let size: number;
    let headerSize = 8;

    if (size32 === 1) {
      // 64-bit extended size — we support up to 4 GB
      if (off + 16 > end) break;
      if (ru32(src, off + 8) !== 0) break; // > 4 GB, skip
      size = ru32(src, off + 12);
      headerSize = 16;
    } else if (size32 === 0) {
      size = end - off;
    } else {
      size = size32;
    }

    if (size < 8 || off + size > end) break;
    result.push({ type, offset: off, size, dataOffset: off + headerSize });
    off += size;
  }
  return result;
}

function findBox(src: Uint8Array, start: number, end: number, type: string): ISOBox | undefined {
  return walkBoxes(src, start, end).find((b) => b.type === type);
}

// ─── HEIC validation ──────────────────────────────────────────────────────────

// All known HEIC/HEIF/AVIF major brands.
const HEIF_BRANDS = new Set([
  'heic', 'heis', 'hevc', 'hevm', 'hevs', 'heix',
  'avif', 'avis', 'mif1', 'msf1',
]);

function isHeic(src: Uint8Array): boolean {
  if (src.length < 12) return false;
  if (btype(src, 4) !== 'ftyp') return false;
  return HEIF_BRANDS.has(btype(src, 8));
}

// ─── iinf / infe parsing ──────────────────────────────────────────────────────

/** Returns a map of itemId → item_type (e.g. 'Exif', 'mime'). */
function parseIinf(src: Uint8Array, box: ISOBox): Map<number, string> {
  const items = new Map<number, string>();
  // iinf is a FullBox: 1-byte version + 3-byte flags before payload.
  const ver = src[box.dataOffset]!;
  let p    = box.dataOffset + 4; // skip version+flags

  const entryCount = ver >= 1 ? ru32(src, p) : ru16(src, p);
  p += ver >= 1 ? 4 : 2;

  const infeBoxes = walkBoxes(src, p, box.offset + box.size);
  void entryCount; // we rely on the box list, not the count field

  for (const infe of infeBoxes) {
    if (infe.type !== 'infe') continue;
    const infeVer = src[infe.dataOffset]!;
    if (infeVer < 2) continue; // item_type field only in version >= 2

    let q = infe.dataOffset + 4; // skip version+flags
    const itemId = infeVer >= 3 ? ru32(src, q) : ru16(src, q);
    q += infeVer >= 3 ? 4 : 2;
    q += 2; // item_protection_index
    const itemType = btype(src, q);
    items.set(itemId, itemType);
  }

  return items;
}

// ─── iloc parsing ─────────────────────────────────────────────────────────────

interface IlocExtent { fileOffset: number; length: number; }
interface IlocEntry  { itemId: number; extents: IlocExtent[]; }

/** Returns a map of itemId → extents (file-offset positions of its data). */
function parseIloc(src: Uint8Array, box: ISOBox): Map<number, IlocEntry> {
  const result = new Map<number, IlocEntry>();
  const ver = src[box.dataOffset]!;
  let p     = box.dataOffset + 4; // skip version+flags

  const sizeField = src[p]!; p++;
  const offsetSize      = (sizeField >> 4) & 0x0f; // 0, 4, or 8
  const lengthSize      = sizeField & 0x0f;         // 0, 4, or 8
  const baseField = src[p]!; p++;
  const baseOffsetSize  = (baseField >> 4) & 0x0f;  // 0, 4, or 8
  // lower nibble = index_size (only meaningful for ver >= 1, ignored here)

  const itemCount = ver >= 2 ? ru32(src, p) : ru16(src, p);
  p += ver >= 2 ? 4 : 2;

  for (let i = 0; i < itemCount; i++) {
    if (p >= src.length) break;

    const itemId = ver >= 2 ? ru32(src, p) : ru16(src, p);
    p += ver >= 2 ? 4 : 2;

    if (ver >= 1) p += 2; // construction_method nibble pair

    p += 2; // data_reference_index

    let baseOffset = 0;
    if (baseOffsetSize === 4) { baseOffset = ru32(src, p); p += 4; }
    else if (baseOffsetSize === 8) { p += 8; } // skip 64-bit base (>4GB not supported)

    const extentCount = ru16(src, p); p += 2;

    const extents: IlocExtent[] = [];
    for (let j = 0; j < extentCount; j++) {
      // item_index field (ver >= 1 and index_size > 0) — not present in common Apple HEIC
      let extOffset = 0;
      let extLength = 0;
      if (offsetSize === 4) { extOffset = ru32(src, p); p += 4; }
      else if (offsetSize === 8) { p += 8; }
      if (lengthSize === 4) { extLength = ru32(src, p); p += 4; }
      else if (lengthSize === 8) { p += 8; }
      extents.push({ fileOffset: extOffset + baseOffset, length: extLength });
    }

    result.set(itemId, { itemId, extents });
  }

  return result;
}

// ─── Metadata item finder ─────────────────────────────────────────────────────

const METADATA_ITEM_TYPES = new Set(['Exif', 'mime']);

interface HeicMetaItem {
  itemId: number;
  itemType: string; // 'Exif' | 'mime'
  extents: IlocExtent[];
}

function findMetadataItems(src: Uint8Array): HeicMetaItem[] {
  const topBoxes = walkBoxes(src, 0, src.length);

  // HEIC: meta is at top level. HEIF-in-MP4: meta is inside moov.
  let metaBox = topBoxes.find((b) => b.type === 'meta');
  if (!metaBox) {
    const moov = topBoxes.find((b) => b.type === 'moov');
    if (moov) {
      metaBox = findBox(src, moov.dataOffset, moov.offset + moov.size, 'meta');
    }
  }
  if (!metaBox) return [];

  // meta is a FullBox — its child boxes start after the 4-byte version+flags.
  const metaChildStart = metaBox.dataOffset + 4;
  const metaEnd        = metaBox.offset + metaBox.size;

  const iinfBox = findBox(src, metaChildStart, metaEnd, 'iinf');
  const ilocBox = findBox(src, metaChildStart, metaEnd, 'iloc');
  if (!iinfBox || !ilocBox) return [];

  const itemTypes     = parseIinf(src, iinfBox);
  const itemLocations = parseIloc(src, ilocBox);

  const result: HeicMetaItem[] = [];
  for (const [itemId, itemType] of itemTypes) {
    if (!METADATA_ITEM_TYPES.has(itemType)) continue;
    const loc = itemLocations.get(itemId);
    if (!loc || loc.extents.length === 0) continue;
    result.push({ itemId, itemType, extents: loc.extents });
  }
  return result;
}

// ─── TIFF IFD in-place zeroing (for EXIF-in-HEIC) ────────────────────────────
// Zeroes sensitive TIFF IFD fields inside the EXIF item data without changing
// the TIFF layout (no offsets need updating).

// Structural tags always kept — do not zero these.
const TIFF_STRUCTURAL = new Set<number>([
  0x0100, 0x0101, 0x0102, 0x0103, 0x0106, 0x0112, 0x0115,
  0x011A, 0x011B, 0x0128, 0x011C, 0x0211, 0x0212, 0x0213,
  0x013E, 0x013F,
]);

const TIFF_DEVICE   = new Set<number>([0x010F, 0x0110, 0x013C]);
const TIFF_AUTHOR   = new Set<number>([0x010E, 0x013B, 0x8298]);
const TIFF_SOFTWARE = new Set<number>([0x0131]);
const TIFF_HISTORY  = new Set<number>([0x0132]);

// TIFF value type sizes in bytes (index = TIFF type code).
const TIFF_TYPE_SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

function scrubTiffInPlace(tiff: Uint8Array, profile: ScrubProfile): void {
  if (tiff.length < 8) return;

  const le  = tiff[0] === 0x49;
  const r16 = (off: number): number =>
    le ? (tiff[off]! | (tiff[off + 1]! << 8)) >>> 0
       : ((tiff[off]! << 8) | tiff[off + 1]!) >>> 0;
  const r32 = (off: number): number =>
    le
      ? (tiff[off]! | (tiff[off+1]! << 8) | (tiff[off+2]! << 16) | (tiff[off+3]! << 24)) >>> 0
      : ((tiff[off]! << 24) | (tiff[off+1]! << 16) | (tiff[off+2]! << 8) | tiff[off+3]!) >>> 0;

  if (r16(2) !== 42) return; // not TIFF

  const ifd0Off = r32(4);
  if (ifd0Off + 2 > tiff.length) return;

  const entryCount = r16(ifd0Off);

  for (let i = 0; i < entryCount; i++) {
    const base = ifd0Off + 2 + i * 12;
    if (base + 12 > tiff.length) break;

    const tag  = r16(base);
    const type = r16(base + 2);
    const cnt  = r32(base + 4);

    // GPS sub-IFD — zero entire GPS IFD block.
    if (tag === 0x8825 && profile.removeGps) {
      const gpsOff = r32(base + 8);
      zeroSubIfd(tiff, gpsOff, r16);
      tiff.fill(0, base + 8, base + 12); // zero the pointer too
      continue;
    }

    // Exif sub-IFD — contains device settings + timestamps.
    if (tag === 0x8769 && (profile.removeDevice || profile.removeHistory)) {
      const exifOff = r32(base + 8);
      zeroSubIfd(tiff, exifOff, r16);
      tiff.fill(0, base + 8, base + 12);
      continue;
    }

    if (TIFF_STRUCTURAL.has(tag)) continue;

    let shouldZero = false;
    if (profile.removeDevice   && TIFF_DEVICE.has(tag))   shouldZero = true;
    if (profile.removeAuthor   && TIFF_AUTHOR.has(tag))   shouldZero = true;
    if (profile.removeSoftware && TIFF_SOFTWARE.has(tag)) shouldZero = true;
    if (profile.removeHistory  && TIFF_HISTORY.has(tag))  shouldZero = true;

    if (!shouldZero) continue;

    const typeSize  = TIFF_TYPE_SIZE[type] ?? 1;
    const dataSize  = typeSize * cnt;

    if (dataSize <= 4) {
      tiff.fill(0, base + 8, base + 12);
    } else {
      // Out-of-line value: zero both the offset pointer and the data.
      const valOff = r32(base + 8);
      if (valOff + dataSize <= tiff.length) tiff.fill(0, valOff, valOff + dataSize);
      tiff.fill(0, base + 8, base + 12);
    }
  }
}

function zeroSubIfd(
  tiff: Uint8Array,
  ifdOff: number,
  r16: (off: number) => number,
): void {
  if (ifdOff + 2 > tiff.length) return;
  const count = r16(ifdOff);
  const end   = ifdOff + 2 + count * 12 + 4;
  if (end <= tiff.length) tiff.fill(0, ifdOff, end);
}

// ─── HEIC EXIF item patching ──────────────────────────────────────────────────
// HEIC EXIF item layout:
//   [4 bytes] offset from next byte to "Exif" marker (Apple always writes 0)
//   [6 bytes] "Exif\0\0"
//   [n bytes] TIFF data (IFDs, values)

const EXIF_MARKER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

function patchExifExtent(
  out: Uint8Array,
  fileOffset: number,
  length: number,
  profile: ScrubProfile,
): void {
  if (length < 10) return;

  // Read the 4-byte header offset value (should be 0, but respect it).
  const headerOff = ru32(out, fileOffset);
  const exifStart  = fileOffset + 4 + headerOff;

  // Verify "Exif\0\0" marker.
  for (let i = 0; i < 6; i++) {
    if (out[exifStart + i] !== EXIF_MARKER[i]) return;
  }

  // TIFF data starts after "Exif\0\0".
  const tiffStart = exifStart + 6;
  const tiffEnd   = fileOffset + length;
  if (tiffStart >= tiffEnd) return;

  const tiffSlice = out.subarray(tiffStart, tiffEnd);
  scrubTiffInPlace(tiffSlice, profile);
}

function patchXmpExtent(out: Uint8Array, fileOffset: number, length: number): void {
  // XMP is UTF-8 XML — zero the entire item (safe, no structural dependency).
  if (fileOffset + length <= out.length) out.fill(0, fileOffset, fileOffset + length);
}

// ─── inspect ─────────────────────────────────────────────────────────────────

type ExifrGroups = Record<string, Record<string, unknown> | null | undefined>;

/**
 * Read all removable metadata from a HEIC/HEIF buffer.
 * Uses exifr, which implements its own ISOBMFF reader to extract EXIF.
 */
export async function inspect(buffer: ArrayBuffer): Promise<MetadataSnapshot> {
  const fields: MetadataField[] = [];
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
          fields.push(buildField(group, tagName, value));
        }
      }
    }
  } catch { /* unreadable HEIC — return empty */ }

  return { fields };
}

// ─── clean ───────────────────────────────────────────────────────────────────

/**
 * Strip metadata from a HEIC buffer according to the profile.
 * Strategy: copy the buffer then zero/rewrite EXIF/XMP item data in-place.
 * The ISOBMFF container structure (boxes, iinf, iloc) is left untouched —
 * items still appear in iinf/iloc but their data regions are sanitised.
 */
export async function clean(
  buffer: ArrayBuffer,
  profile: ScrubProfile = DEFAULT_PROFILE,
): Promise<CleanResult> {
  const before = await inspect(buffer);

  let cleaned: ArrayBuffer;
  try {
    const src = new Uint8Array(buffer);

    if (!isHeic(src)) {
      cleaned = buffer;
    } else {
      const metaItems = findMetadataItems(src);
      // Clone the buffer so we can modify it in-place.
      const out = new Uint8Array(buffer.slice(0));

      for (const item of metaItems) {
        for (const extent of item.extents) {
          const { fileOffset, length } = extent;
          if (fileOffset + length > out.length) continue;

          if (item.itemType === 'Exif') {
            patchExifExtent(out, fileOffset, length, profile);
          } else if (item.itemType === 'mime') {
            // XMP — all user-visible metadata; zero entire item.
            if (profile.removeAuthor || profile.removeSoftware || profile.removeHistory) {
              patchXmpExtent(out, fileOffset, length);
            }
          }
        }
      }

      cleaned = out.buffer;
    }
  } catch {
    cleaned = buffer;
  }

  const after = await inspect(cleaned);
  return { clean: cleaned, before, after };
}

// ─── Worker entry point ───────────────────────────────────────────────────────

export async function stripHeic(buffer: ArrayBuffer): Promise<CleanResult> {
  return clean(buffer, DEFAULT_PROFILE);
}
