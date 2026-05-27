import exifr from 'exifr';
import piexif from 'piexifjs';
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

// ─── IFD0 tag lists ───────────────────────────────────────────────────────────
// Tag numbers come from the EXIF 2.32 specification.

// Structural/colorimetric tags — always kept regardless of profile.
const IFD0_PRESERVE = new Set<number>([
  0x0100, // ImageWidth
  0x0101, // ImageLength
  0x0102, // BitsPerSample
  0x0103, // Compression
  0x0106, // PhotometricInterpretation
  0x0112, // Orientation  ← always kept
  0x0115, // SamplesPerPixel
  0x011A, // XResolution
  0x011B, // YResolution
  0x0128, // ResolutionUnit
  0x011C, // PlanarConfiguration
  0x0211, // YCbCrCoefficients
  0x0212, // YCbCrSubSampling
  0x0213, // YCbCrPositioning
  0x013E, // WhitePoint
  0x013F, // PrimaryChromaticities
]);

// Per-category removal sets for IFD0.
const IFD0_DEVICE   = new Set<number>([0x010F, 0x0110, 0x013C]); // Make, Model, HostComputer
const IFD0_AUTHOR   = new Set<number>([0x010E, 0x013B, 0x8298]); // ImageDescription, Artist, Copyright
const IFD0_SOFTWARE = new Set<number>([0x0131]);                  // Software
const IFD0_HISTORY  = new Set<number>([0x0132]);                  // DateTime

// exifr group keys when mergeOutput:false.
type ExifrGroups = Record<string, Record<string, unknown> | null | undefined>;

// ─── inspect ─────────────────────────────────────────────────────────────────

/**
 * Read all removable metadata from a JPEG buffer.
 * ICC color profiles are excluded — they are structural, not PII.
 */
export async function inspect(buffer: ArrayBuffer): Promise<MetadataSnapshot> {
  let parsed: ExifrGroups | undefined;
  try {
    parsed = (await exifr.parse(buffer, {
      translateValues: false,
      reviveValues: false,
      sanitize: false,
      mergeOutput: false,
      gps: true,
      exif: true,
      iptc: true,
      xmp: true,
      tiff: true,
      jfif: false,
      icc: false, // color profile: structural, not metadata to scrub
    })) as ExifrGroups | undefined;
  } catch {
    return { fields: [] };
  }

  if (!parsed) return { fields: [] };

  const fields: MetadataField[] = [];
  for (const [group, tags] of Object.entries(parsed)) {
    if (!tags || typeof tags !== 'object') continue;
    for (const [tagName, value] of Object.entries(tags)) {
      fields.push(buildField(group, tagName, value));
    }
  }

  return { fields };
}

// ─── clean ───────────────────────────────────────────────────────────────────

/**
 * Remove metadata from a JPEG buffer according to the given profile.
 * Preserves: APP0 (JFIF), APP2 (ICC color profile), Orientation, and image data.
 * Returns before/after snapshots so the UI can diff what changed.
 */
export async function clean(
  buffer: ArrayBuffer,
  profile: ScrubProfile = DEFAULT_PROFILE,
): Promise<CleanResult> {
  const before = await inspect(buffer);

  let cleaned: ArrayBuffer;
  try {
    // Step 1: selectively rewrite the EXIF APP1 segment via piexifjs.
    const afterExif = scrubExif(buffer, profile);
    // Step 2: drop XMP (APP1), IPTC (APP13), and COM segments.
    cleaned = dropMarkers(afterExif, profile);
  } catch {
    // Corrupt or EXIF-less JPEG — return buffer unchanged.
    cleaned = buffer;
  }

  const after = await inspect(cleaned);
  return { clean: cleaned, before, after };
}

// ─── Worker entry point ───────────────────────────────────────────────────────

export async function stripJpeg(buffer: ArrayBuffer): Promise<CleanResult> {
  return clean(buffer, DEFAULT_PROFILE);
}

// ─── EXIF scrubbing (piexifjs) ────────────────────────────────────────────────

type PiexifObj = {
  '0th': Record<number, unknown>;
  Exif: Record<number, unknown>;
  GPS: Record<number, unknown>;
  Interop: Record<number, unknown>;
  '1st': Record<number, unknown>;
  thumbnail: string | null;
};

function scrubExif(buffer: ArrayBuffer, profile: ScrubProfile): ArrayBuffer {
  const bstr = bufferToBinaryString(buffer);

  let exifObj: PiexifObj;
  try {
    exifObj = piexif.load(bstr) as PiexifObj;
  } catch {
    return buffer; // no APP1 EXIF — nothing to scrub
  }

  // GPS IFD — remove entirely.
  if (profile.removeGps) exifObj.GPS = {};

  // ExifIFD contains device settings (focal length, ISO, etc.) and timestamps.
  if (profile.removeDevice || profile.removeHistory) exifObj.Exif = {};

  // Interoperability IFD — only meaningful alongside ExifIFD.
  exifObj.Interop = {};

  // Thumbnail (IFD1) — thumbnails embed their own metadata.
  exifObj['1st'] = {};
  exifObj.thumbnail = null;

  // IFD0 selective scrub — build the removal set from active profile flags.
  const toRemove = new Set<number>();
  if (profile.removeDevice)   for (const t of IFD0_DEVICE)   toRemove.add(t);
  if (profile.removeAuthor)   for (const t of IFD0_AUTHOR)   toRemove.add(t);
  if (profile.removeSoftware) for (const t of IFD0_SOFTWARE) toRemove.add(t);
  if (profile.removeHistory)  for (const t of IFD0_HISTORY)  toRemove.add(t);

  const ifd0 = exifObj['0th'];
  for (const tag of toRemove) {
    if (!IFD0_PRESERVE.has(tag)) delete ifd0[tag];
  }

  const newExifBytes = piexif.dump(exifObj as Parameters<typeof piexif.dump>[0]);
  const newBstr = piexif.insert(newExifBytes, bstr);
  return binaryStringToBuffer(newBstr);
}

// ─── JPEG marker rewriter ─────────────────────────────────────────────────────
// Walks the JPEG segment list and drops APP1-XMP, APP13-IPTC, and COM markers.

const XMP_IDENTIFIER = 'http://ns.adobe.com/xap/1.0/\x00';

function shouldDrop(marker: number, payload: Uint8Array, profile: ScrubProfile): boolean {
  // APP1 (0xE1): EXIF or XMP
  if (marker === 0xe1) {
    if (payload.length < XMP_IDENTIFIER.length) return false;
    // XMP segment starts with the XMP namespace URI.
    const prefix = new TextDecoder('latin1').decode(payload.slice(0, XMP_IDENTIFIER.length));
    if (prefix === XMP_IDENTIFIER) {
      return profile.removeAuthor || profile.removeSoftware || profile.removeHistory;
    }
    // EXIF APP1 — already handled by scrubExif(); keep as-is.
    return false;
  }
  // APP13 (0xED): Photoshop / IPTC — contains author/creator metadata.
  if (marker === 0xed) return profile.removeAuthor;
  // COM (0xFE): freeform comment — can contain author or software strings.
  if (marker === 0xfe) return profile.removeAuthor || profile.removeSoftware;
  return false;
}

function dropMarkers(buffer: ArrayBuffer, profile: ScrubProfile): ArrayBuffer {
  const src = new Uint8Array(buffer);
  if (src[0] !== 0xff || src[1] !== 0xd8) return buffer; // not a JPEG

  const segments: Uint8Array[] = [new Uint8Array([0xff, 0xd8])]; // SOI
  let i = 2;

  while (i < src.length - 1) {
    if (src[i] !== 0xff) break; // malformed; stop and use what we have

    const marker = src[i + 1]!;
    i += 2;

    // Standalone markers (no length field).
    if (marker === 0xd8 || marker === 0xd9) {
      segments.push(new Uint8Array([0xff, marker]));
      if (marker === 0xd9) break; // EOI
      continue;
    }
    // Restart markers (0xD0–0xD7).
    if (marker >= 0xd0 && marker <= 0xd7) {
      segments.push(new Uint8Array([0xff, marker]));
      continue;
    }

    // Variable-length segment.
    if (i + 1 >= src.length) break;
    const len = ((src[i]! << 8) | src[i + 1]!); // includes 2 length bytes
    const segBytes = src.slice(i, i + len);       // length field + payload
    const payload  = segBytes.slice(2);            // payload only
    i += len;

    if (!shouldDrop(marker, payload, profile)) {
      const seg = new Uint8Array(2 + len);
      seg[0] = 0xff;
      seg[1] = marker;
      seg.set(segBytes, 2);
      segments.push(seg);
    }

    // After SOS header, the rest is raw scan data — copy verbatim.
    if (marker === 0xda) {
      segments.push(src.slice(i));
      break;
    }
  }

  const total = segments.reduce((n, s) => n + s.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const s of segments) { out.set(s, off); off += s.length; }
  return out.buffer;
}

// ─── Binary string ↔ ArrayBuffer ──────────────────────────────────────────────
// piexifjs operates on Latin-1 binary strings, not ArrayBuffers.

function bufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000; // 32 KB — avoids call-stack overflow for large files
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...Array.from(bytes.subarray(i, i + CHUNK))));
  }
  return parts.join('');
}

function binaryStringToBuffer(str: string): ArrayBuffer {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
  return bytes.buffer;
}
