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

// ─── TIFF IFD tags ────────────────────────────────────────────────────────────
// Tags always kept — structural / colorimetric.
const TIFF_PRESERVE = new Set<number>([
  0x0100, // ImageWidth
  0x0101, // ImageLength
  0x0102, // BitsPerSample
  0x0103, // Compression
  0x0106, // PhotometricInterpretation
  0x0111, // StripOffsets
  0x0112, // Orientation
  0x0115, // SamplesPerPixel
  0x0116, // RowsPerStrip
  0x0117, // StripByteCounts
  0x011A, // XResolution
  0x011B, // YResolution
  0x0128, // ResolutionUnit
  0x011C, // PlanarConfiguration
  0x0140, // ColorMap
  0x0142, // TileWidth
  0x0143, // TileLength
  0x0144, // TileOffsets
  0x0145, // TileByteCounts
  0x0152, // ExtraSamples
  0x0153, // SampleFormat
  0x0211, // YCbCrCoefficients
  0x0212, // YCbCrSubSampling
  0x0213, // YCbCrPositioning
  0x013E, // WhitePoint
  0x013F, // PrimaryChromaticities
  0x8769, // ExifIFD pointer — handled separately
  0x8825, // GPSIFD pointer — handled separately
]);

// Per-category IFD0 removal tags.
const TIFF_DEVICE   = new Set<number>([0x010F, 0x0110, 0x013C]); // Make, Model, HostComputer
const TIFF_AUTHOR   = new Set<number>([0x010E, 0x013B, 0x8298]); // ImageDescription, Artist, Copyright
const TIFF_SOFTWARE = new Set<number>([0x0131]);                  // Software
const TIFF_HISTORY  = new Set<number>([0x0132]);                  // DateTime

// TIFF tag type sizes in bytes.
const TYPE_SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

// ─── Low-level TIFF reader ────────────────────────────────────────────────────

interface TiffView {
  src: Uint8Array;
  le: boolean; // true = little-endian (II), false = big-endian (MM)
}

function u16(v: TiffView, off: number): number {
  return v.le
    ? (v.src[off]! | (v.src[off+1]! << 8)) >>> 0
    : ((v.src[off]! << 8) | v.src[off+1]!) >>> 0;
}

function u32(v: TiffView, off: number): number {
  return v.le
    ? (v.src[off]! | (v.src[off+1]! << 8) | (v.src[off+2]! << 16) | (v.src[off+3]! << 24)) >>> 0
    : ((v.src[off]! << 24) | (v.src[off+1]! << 16) | (v.src[off+2]! << 8) | v.src[off+3]!) >>> 0;
}

function w16(out: Uint8Array, off: number, val: number, le: boolean): void {
  if (le) { out[off] = val & 0xff; out[off+1] = (val >> 8) & 0xff; }
  else     { out[off] = (val >> 8) & 0xff; out[off+1] = val & 0xff; }
}

function w32(out: Uint8Array, off: number, val: number, le: boolean): void {
  if (le) {
    out[off]=val&0xff; out[off+1]=(val>>8)&0xff; out[off+2]=(val>>16)&0xff; out[off+3]=(val>>24)&0xff;
  } else {
    out[off]=(val>>24)&0xff; out[off+1]=(val>>16)&0xff; out[off+2]=(val>>8)&0xff; out[off+3]=val&0xff;
  }
}

function isTiff(src: Uint8Array): boolean {
  if (src.length < 4) return false;
  const le = src[0] === 0x49 && src[1] === 0x49;
  const be = src[0] === 0x4d && src[1] === 0x4d;
  if (!le && !be) return false;
  const magic = le ? (src[2]! | (src[3]! << 8)) : ((src[2]! << 8) | src[3]!);
  return magic === 42;
}

// ─── IFD entry ────────────────────────────────────────────────────────────────

interface IfdEntry {
  tag: number;
  type: number;
  count: number;
  valueOrOffset: number; // raw 4-byte field from IFD
  dataSize: number;      // total bytes for this entry's value
  inline: boolean;       // true if data fits in 4 bytes
  // For offset entries, valueOrOffset is the absolute offset into src
}

function readIfd(v: TiffView, ifdOffset: number): IfdEntry[] {
  if (ifdOffset + 2 > v.src.length) return [];
  const count = u16(v, ifdOffset);
  const entries: IfdEntry[] = [];

  for (let i = 0; i < count; i++) {
    const base = ifdOffset + 2 + i * 12;
    if (base + 12 > v.src.length) break;
    const tag  = u16(v, base);
    const type = u16(v, base + 2);
    const cnt  = u32(v, base + 4);
    const vom  = u32(v, base + 8); // value or offset
    const sz   = (TYPE_SIZE[type] ?? 1) * cnt;
    entries.push({ tag, type, count: cnt, valueOrOffset: vom, dataSize: sz, inline: sz <= 4 });
  }

  return entries;
}

// ─── TIFF scrubber ────────────────────────────────────────────────────────────
// Strategy: read source IFDs, decide which tags to keep, copy all data into a
// freshly laid-out buffer with updated offsets.  Image data (strips/tiles) is
// copied verbatim; its StripOffsets/TileOffsets are rewritten to new positions.

interface ScrubOptions {
  profile: ScrubProfile;
  removeExifIfd: boolean; // clear ExifIFD entirely
  removeGpsIfd: boolean;  // clear GPSIFD entirely
}

function shouldKeepTag(tag: number, opts: ScrubOptions): boolean {
  if (TIFF_PRESERVE.has(tag)) {
    // Pointer to ExifIFD — drop if we're removing it.
    if (tag === 0x8769) return !opts.removeExifIfd;
    // Pointer to GPSIFD — drop if removing GPS.
    if (tag === 0x8825) return !opts.removeGpsIfd;
    return true;
  }
  if (opts.profile.removeDevice   && TIFF_DEVICE.has(tag))   return false;
  if (opts.profile.removeAuthor   && TIFF_AUTHOR.has(tag))   return false;
  if (opts.profile.removeSoftware && TIFF_SOFTWARE.has(tag)) return false;
  if (opts.profile.removeHistory  && TIFF_HISTORY.has(tag))  return false;
  return true;
}

function scrubTiff(buffer: ArrayBuffer, profile: ScrubProfile): ArrayBuffer {
  const src = new Uint8Array(buffer);
  if (!isTiff(src)) return buffer;

  const le = src[0] === 0x49;
  const v: TiffView = { src, le };

  const ifdOffset = u32(v, 4);
  const entries = readIfd(v, ifdOffset);

  const opts: ScrubOptions = {
    profile,
    removeExifIfd: profile.removeDevice || profile.removeHistory,
    removeGpsIfd: profile.removeGps,
  };

  const kept = entries.filter((e) => shouldKeepTag(e.tag, opts));

  const IMAGE_OFFSET_TAGS = new Set([0x0111, 0x0144]); // StripOffsets, TileOffsets
  const IMAGE_COUNT_TAGS  = new Set([0x0117, 0x0145]); // StripByteCounts, TileByteCounts

  // Read image strip/tile data positions from the original buffer.
  interface ImageBlock { offset: number; size: number; }
  const imageBlocks: ImageBlock[] = [];

  const srcOffsetEntry = entries.find((e) => IMAGE_OFFSET_TAGS.has(e.tag));
  const srcCountEntry  = entries.find((e) => IMAGE_COUNT_TAGS.has(e.tag));
  if (srcOffsetEntry && srcCountEntry) {
    const offsets = readValues(v, srcOffsetEntry);
    const sizes   = readValues(v, srcCountEntry);
    for (let i = 0; i < offsets.length; i++) {
      imageBlocks.push({ offset: offsets[i]!, size: sizes[i] ?? 0 });
    }
  }

  // ── Layout ──────────────────────────────────────────────────────────────────
  // [0..7]        TIFF header
  // [8..ifdEnd]   IFD (2 + N*12 + 4)
  // [ifdEnd..]    out-of-line values for kept entries
  // [after vals]  image strip/tile data

  const ifdStart = 8;
  const ifdSize  = 2 + kept.length * 12 + 4;
  const valStart = ifdStart + ifdSize;

  // Map each out-of-line entry to its new offset.
  const newOffsets = new Map<IfdEntry, number>();
  let cursor = valStart;

  for (const e of kept) {
    if (e.inline) continue;
    newOffsets.set(e, cursor);
    cursor += e.dataSize + (e.dataSize % 2); // word-align
  }

  // Image data goes after all out-of-line values.
  const newImageOffsets: number[] = [];
  for (const blk of imageBlocks) {
    newImageOffsets.push(cursor);
    cursor += blk.size + (blk.size % 2);
  }
  const totalSize = cursor;

  const out = new Uint8Array(totalSize);

  // Write header.
  out[0] = le ? 0x49 : 0x4d;
  out[1] = le ? 0x49 : 0x4d;
  w16(out, 2, 42, le);
  w32(out, 4, ifdStart, le);

  // Write IFD.
  w16(out, ifdStart, kept.length, le);
  let entryOff = ifdStart + 2;

  for (const e of kept) {
    w16(out, entryOff,     e.tag,   le);
    w16(out, entryOff + 2, e.type,  le);
    w32(out, entryOff + 4, e.count, le);

    if (e.inline) {
      // Single-strip/single-tile inline offset: must point to new image position.
      if (IMAGE_OFFSET_TAGS.has(e.tag) && newImageOffsets.length === 1) {
        w32(out, entryOff + 8, newImageOffsets[0]!, le);
      } else {
        w32(out, entryOff + 8, e.valueOrOffset, le);
      }
    } else {
      const newOff = newOffsets.get(e)!;
      w32(out, entryOff + 8, newOff, le);

      if (IMAGE_OFFSET_TAGS.has(e.tag)) {
        // Write new image strip/tile offsets into the value block.
        let p = newOff;
        for (const no of newImageOffsets) { w32(out, p, no, le); p += 4; }
      } else {
        // Copy original value bytes verbatim.
        out.set(src.slice(e.valueOrOffset, e.valueOrOffset + e.dataSize), newOff);
      }
    }

    entryOff += 12;
  }

  // Next IFD pointer = 0.
  w32(out, entryOff, 0, le);

  // Copy image strip/tile data.
  for (let i = 0; i < imageBlocks.length; i++) {
    const blk = imageBlocks[i]!;
    out.set(src.slice(blk.offset, blk.offset + blk.size), newImageOffsets[i]!);
  }

  return out.buffer;
}

// Helper: read all numeric values for an IFD entry.
// Inline values (≤4 bytes) are stored directly in valueOrOffset in little-endian
// byte order regardless of file endianness (TIFF spec §7).
function readValues(v: TiffView, e: IfdEntry): number[] {
  const result: number[] = [];
  const typeSize = TYPE_SIZE[e.type] ?? 1;

  for (let i = 0; i < e.count; i++) {
    if (e.inline) {
      // Inline bytes are always stored LE in the value field.
      const byteOff = i * typeSize;
      const vom = e.valueOrOffset;
      const b0 = (vom >>> (byteOff * 8)) & 0xff;
      const b1 = (vom >>> ((byteOff + 1) * 8)) & 0xff;
      const b2 = (vom >>> ((byteOff + 2) * 8)) & 0xff;
      const b3 = (vom >>> ((byteOff + 3) * 8)) & 0xff;
      if (typeSize === 4) result.push(((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0);
      else if (typeSize === 2) result.push(((b1 << 8) | b0) >>> 0);
      else result.push(b0);
    } else {
      const off = e.valueOrOffset + i * typeSize;
      if (typeSize === 4) result.push(u32(v, off));
      else if (typeSize === 2) result.push(u16(v, off));
      else result.push(v.src[off]!);
    }
  }

  return result;
}

// ─── inspect ─────────────────────────────────────────────────────────────────

type ExifrGroups = Record<string, Record<string, unknown> | null | undefined>;

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
  } catch { /* not parseable */ }

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
    cleaned = scrubTiff(buffer, profile);
  } catch {
    cleaned = buffer;
  }

  const after = await inspect(cleaned);
  return { clean: cleaned, before, after };
}

// ─── Worker entry point ───────────────────────────────────────────────────────

export async function stripTiff(buffer: ArrayBuffer): Promise<CleanResult> {
  return clean(buffer, DEFAULT_PROFILE);
}
