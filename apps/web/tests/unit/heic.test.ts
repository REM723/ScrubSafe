import { describe, it, expect } from 'vitest';
import { inspect, clean, DEFAULT_PROFILE } from '$lib/processors/heic';
import type { ScrubProfile } from '@scrubsafe/shared-types';

// ── HEIC builder ──────────────────────────────────────────────────────────────
// Constructs minimal but structurally valid HEIC files using real ISOBMFF boxes.
// Structure: ftyp | meta(hdlr + iinf + iloc) | mdat(exif_item)

function w16(buf: Uint8Array, off: number, val: number): void {
  buf[off] = (val >> 8) & 0xff; buf[off + 1] = val & 0xff;
}
function w16le(buf: Uint8Array, off: number, val: number): void {
  buf[off] = val & 0xff; buf[off + 1] = (val >> 8) & 0xff;
}
function w32(buf: Uint8Array, off: number, val: number): void {
  buf[off] = (val >> 24) & 0xff; buf[off + 1] = (val >> 16) & 0xff;
  buf[off + 2] = (val >> 8) & 0xff; buf[off + 3] = val & 0xff;
}
function w32le(buf: Uint8Array, off: number, val: number): void {
  buf[off] = val & 0xff; buf[off + 1] = (val >> 8) & 0xff;
  buf[off + 2] = (val >> 16) & 0xff; buf[off + 3] = (val >> 24) & 0xff;
}
function wstr(buf: Uint8Array, off: number, s: string): void {
  for (let i = 0; i < s.length; i++) buf[off + i] = s.charCodeAt(i);
}

// ── ftyp box (20 bytes) ───────────────────────────────────────────────────────
// size(4) + 'ftyp'(4) + major_brand(4) + minor_version(4) + compat_brand(4)
function buildFtyp(): Uint8Array {
  const b = new Uint8Array(20);
  w32(b, 0, 20); wstr(b, 4, 'ftyp');
  wstr(b, 8, 'heic'); w32(b, 12, 0); wstr(b, 16, 'mif1');
  return b;
}

// ── hdlr box (33 bytes) ───────────────────────────────────────────────────────
// size(4)+'hdlr'(4)+ver+flags(4)+pre_defined(4)+handler_type(4)+reserved(12)+name(1)
function buildHdlr(): Uint8Array {
  const b = new Uint8Array(33);
  w32(b, 0, 33); wstr(b, 4, 'hdlr');
  // version+flags = 0
  wstr(b, 12, 'pict');
  // reserved 12 bytes, null name — all zero
  return b;
}

// ── infe box (21 bytes, version 2) ───────────────────────────────────────────
// size(4)+'infe'(4)+ver+flags(4)+item_id(2)+protection(2)+item_type(4)+name(1)
function buildInfe(itemId: number, itemType: string): Uint8Array {
  const b = new Uint8Array(21);
  w32(b, 0, 21); wstr(b, 4, 'infe');
  b[8] = 2; // version 2
  w16(b, 12, itemId);    // item_id (big-endian, version < 3)
  w16(b, 14, 0);         // item_protection_index
  wstr(b, 16, itemType); // item_type (4 bytes)
  // item_name: null byte at offset 20, already 0
  return b;
}

// ── iinf box (14 + infe bytes) ───────────────────────────────────────────────
// size(4)+'iinf'(4)+ver+flags(4)+entry_count(2)+[infe]
function buildIinf(infe: Uint8Array): Uint8Array {
  const size = 14 + infe.length;
  const b = new Uint8Array(size);
  w32(b, 0, size); wstr(b, 4, 'iinf');
  // version+flags = 0
  w16(b, 12, 1); // entry_count = 1
  b.set(infe, 14);
  return b;
}

// ── iloc box (30 bytes, version 0, offset_size=4, length_size=4) ─────────────
// size(4)+'iloc'(4)+ver+flags(4)+sizes(2)+item_count(2)+item_id(2)+dref(2)+extents...
function buildIloc(itemId: number, fileOffset: number, extentLength: number): Uint8Array {
  const b = new Uint8Array(30);
  w32(b, 0, 30); wstr(b, 4, 'iloc');
  // version+flags = 0
  b[12] = 0x44; // offset_size=4 | length_size=4
  b[13] = 0x00; // base_offset_size=0 | index_size=0
  w16(b, 14, 1); // item_count = 1
  // Item entry:
  w16(b, 16, itemId); // item_id
  w16(b, 18, 0);      // data_reference_index
  // base_offset: none (base_offset_size=0)
  w16(b, 20, 1);      // extent_count = 1
  w32(b, 22, fileOffset);  // extent_offset
  w32(b, 26, extentLength); // extent_length
  return b;
}

// ── meta box (FullBox) ────────────────────────────────────────────────────────
// size(4)+'meta'(4)+ver+flags(4)+[children]
function buildMeta(children: Uint8Array[]): Uint8Array {
  const contentSize = children.reduce((n, c) => n + c.length, 0);
  const size = 12 + contentSize;
  const b = new Uint8Array(size);
  w32(b, 0, size); wstr(b, 4, 'meta');
  // version+flags = 0
  let off = 12;
  for (const c of children) { b.set(c, off); off += c.length; }
  return b;
}

// ── mdat box ─────────────────────────────────────────────────────────────────
function buildMdat(content: Uint8Array): Uint8Array {
  const size = 8 + content.length;
  const b = new Uint8Array(size);
  w32(b, 0, size); wstr(b, 4, 'mdat');
  b.set(content, 8);
  return b;
}

// ── EXIF item wrapper ─────────────────────────────────────────────────────────
// [4 bytes header_offset=0] ["Exif\0\0"] [TIFF bytes]
function buildExifItem(tiff: Uint8Array): Uint8Array {
  const b = new Uint8Array(4 + 6 + tiff.length);
  // header_offset = 0 (already 0)
  wstr(b, 4, 'Exif'); // b[8]=b[9]=0 already (null terminator)
  b.set(tiff, 10);
  return b;
}

// ── TIFF builders (little-endian) ─────────────────────────────────────────────

// Minimal TIFF with no IFD entries.
function buildMinimalTiff(): Uint8Array {
  // header(8) + IFD0: count(2)+next(4) = 14 bytes
  const b = new Uint8Array(14);
  b[0] = 0x49; b[1] = 0x49;    // 'II' little-endian
  w16le(b, 2, 42);              // magic
  w32le(b, 4, 8);               // IFD0 at offset 8
  w16le(b, 8, 0);               // 0 entries
  w32le(b, 10, 0);              // next IFD = 0
  return b;
}

// TIFF with Artist tag (out-of-line, 9 bytes: "Jane Doe\0").
// Layout: header(8) | IFD0: count(2)+artist_entry(12)+next(4) | "Jane Doe\0"(9)
function buildTiffWithArtist(): Uint8Array {
  // Artist value "Jane Doe\0" at offset 26 (8+18=26)
  const artist = 'Jane Doe\0';
  const b = new Uint8Array(8 + 18 + artist.length);
  b[0] = 0x49; b[1] = 0x49;
  w16le(b, 2, 42);
  w32le(b, 4, 8);            // IFD0 at 8
  w16le(b, 8, 1);            // 1 entry
  // Artist entry (tag 0x013B, type 2=ASCII, count=9, offset=26)
  w16le(b, 10, 0x013B);
  w16le(b, 12, 2);           // ASCII
  w32le(b, 14, artist.length);
  w32le(b, 18, 26);          // out-of-line offset
  w32le(b, 22, 0);           // next IFD
  wstr(b, 26, artist);
  return b;
}

// TIFF with GPS sub-IFD.
// IFD0: GPS pointer entry → GPS IFD at offset 26.
// GPS IFD: GPSLatitudeRef 'N' (inline, ASCII 2 bytes).
function buildTiffWithGps(): Uint8Array {
  // IFD0: header(8) + count(2) + GPS_entry(12) + next(4) = 26 bytes
  // GPS IFD at offset 26: count(2) + GPSLatRef_entry(12) + next(4) = 18 bytes
  const b = new Uint8Array(8 + 18 + 18);
  b[0] = 0x49; b[1] = 0x49;
  w16le(b, 2, 42);
  w32le(b, 4, 8);           // IFD0 at 8
  // IFD0
  w16le(b, 8, 1);           // 1 entry
  // GPS IFD pointer: tag=0x8825, type=4 (LONG), count=1, value=26
  w16le(b, 10, 0x8825);
  w16le(b, 12, 4);          // LONG
  w32le(b, 14, 1);
  w32le(b, 18, 26);         // GPS IFD at offset 26
  w32le(b, 22, 0);          // next IFD
  // GPS IFD at offset 26
  w16le(b, 26, 1);          // 1 entry
  // GPSLatitudeRef: tag=0x0001, type=2 (ASCII), count=2, value='N\0' inline
  w16le(b, 28, 0x0001);
  w16le(b, 30, 2);          // ASCII
  w32le(b, 32, 2);          // count 2 ('N' + '\0')
  // Inline ASCII "N\0" — first byte 'N'=0x4E, second byte '\0'=0
  b[36] = 0x4e; b[37] = 0x00; // "N\0" packed into LE 4-byte field
  w32le(b, 40, 0);          // next GPS IFD
  return b;
}

// ── Full HEIC assembler ───────────────────────────────────────────────────────

function assembleHeic(tiff: Uint8Array): ArrayBuffer {
  const ftypBox = buildFtyp();         // 20 bytes
  const hdlrBox = buildHdlr();         // 33 bytes
  const infeBox = buildInfe(1, 'Exif');  // 21 bytes
  const iinfBox = buildIinf(infeBox);  // 35 bytes

  // We need to know the file offset of the EXIF item before building iloc.
  // EXIF item is in mdat, right after ftyp + meta + mdat-header.
  const metaContentSize = hdlrBox.length + iinfBox.length + 30; // 30 = iloc size
  const metaSize = 12 + metaContentSize; // 12 = FullBox header
  const exifOffset = ftypBox.length + metaSize + 8; // 8 = mdat box header

  const exifItem = buildExifItem(tiff);
  const ilocBox  = buildIloc(1, exifOffset, exifItem.length);
  const metaBox  = buildMeta([hdlrBox, iinfBox, ilocBox]);
  const mdatBox  = buildMdat(exifItem);

  const total = ftypBox.length + metaBox.length + mdatBox.length;
  const out = new Uint8Array(total);
  let off = 0;
  out.set(ftypBox, off); off += ftypBox.length;
  out.set(metaBox, off); off += metaBox.length;
  out.set(mdatBox, off);
  return out.buffer;
}

function minimalHeic(): ArrayBuffer { return assembleHeic(buildMinimalTiff()); }
function heicWithArtist(): ArrayBuffer { return assembleHeic(buildTiffWithArtist()); }
function heicWithGps(): ArrayBuffer { return assembleHeic(buildTiffWithGps()); }

// ── inspect ───────────────────────────────────────────────────────────────────

describe('inspect', () => {
  it('returns an array (does not throw on valid HEIC)', async () => {
    const result = await inspect(minimalHeic());
    expect(Array.isArray(result.fields)).toBe(true);
  });

  it('returns empty fields for a minimal HEIC with no metadata tags', async () => {
    const result = await inspect(minimalHeic());
    // Structural data like IFD0 dimensions are not removable metadata.
    const pii = result.fields.filter((f) => f.sensitive);
    expect(pii).toHaveLength(0);
  });

  it('detects Artist in the identity category', async () => {
    const { fields } = await inspect(heicWithArtist());
    const artist = fields.find((f) => f.key === 'ifd0/Artist');
    expect(artist).toBeDefined();
    expect(artist!.category).toBe('identity');
    expect(artist!.value).toBe('Jane Doe');
  });

  it('marks Artist as sensitive', async () => {
    const { fields } = await inspect(heicWithArtist());
    const artist = fields.find((f) => f.key === 'ifd0/Artist');
    expect(artist!.sensitive).toBe(true);
  });

  it('detects GPS fields in the location category', async () => {
    const { fields } = await inspect(heicWithGps());
    const gps = fields.filter((f) => f.key.startsWith('gps/'));
    expect(gps.length).toBeGreaterThan(0);
    for (const f of gps) expect(f.category).toBe('location');
  });
});

// ── clean — HEIC header preservation ─────────────────────────────────────────

describe('clean — structural preservation', () => {
  it('returns a buffer that starts with a valid ftyp box', async () => {
    const { clean: cleaned } = await clean(heicWithArtist());
    const bytes = new Uint8Array(cleaned);
    // ftyp major brand starts at offset 8
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
    expect(brand).toBe('heic');
  });

  it('returns a non-empty ArrayBuffer', async () => {
    const { clean: cleaned } = await clean(heicWithArtist());
    expect(cleaned.byteLength).toBeGreaterThan(0);
  });

  it('cleaned buffer is the same length as the original', async () => {
    const buf = heicWithArtist();
    const { clean: cleaned } = await clean(buf);
    // In-place zeroing — no bytes added or removed.
    expect(cleaned.byteLength).toBe(buf.byteLength);
  });

  it('does not throw on a minimal HEIC with no EXIF', async () => {
    await expect(clean(minimalHeic())).resolves.toBeDefined();
  });
});

// ── clean — author/identity removal ──────────────────────────────────────────

describe('clean — author/identity', () => {
  it('removes Artist from after snapshot', async () => {
    const { after } = await clean(heicWithArtist());
    const artist = after.fields.find((f) => f.key === 'ifd0/Artist');
    // After zeroing, exifr may still see the key but with empty/zero value.
    // The important check: the value 'Jane Doe' must not appear.
    expect(artist?.value ?? '').not.toBe('Jane Doe');
  });

  it('reports Artist in before snapshot', async () => {
    const { before } = await clean(heicWithArtist());
    const artist = before.fields.find((f) => f.key === 'ifd0/Artist');
    expect(artist).toBeDefined();
    expect(artist!.value).toBe('Jane Doe');
  });

  it('preserves Artist when removeAuthor is false', async () => {
    const buf = heicWithArtist();
    const profile: ScrubProfile = { ...DEFAULT_PROFILE, removeAuthor: false };
    const { after } = await clean(buf, profile);
    const artist = after.fields.find((f) => f.key === 'ifd0/Artist');
    expect(artist?.value).toBe('Jane Doe');
  });
});

// ── clean — GPS removal ───────────────────────────────────────────────────────

describe('clean — GPS', () => {
  it('removes GPS fields from after snapshot', async () => {
    const { after } = await clean(heicWithGps());
    // GPS sub-IFD is zeroed; after cleaning, exifr should not return GPS lat/lon.
    const gpsSensitive = after.fields.filter((f) => f.category === 'location' && f.sensitive);
    // If any GPS fields remain, they must not be the original ref value.
    for (const f of gpsSensitive) {
      expect(f.value).not.toBe('N');
      expect(f.value).not.toBe('W');
    }
  });

  it('reports GPS fields in before snapshot', async () => {
    const { before } = await clean(heicWithGps());
    const gps = before.fields.filter((f) => f.key.startsWith('gps/'));
    expect(gps.length).toBeGreaterThan(0);
  });

  it('preserves GPS when removeGps is false', async () => {
    const buf = heicWithGps();
    const profile: ScrubProfile = { ...DEFAULT_PROFILE, removeGps: false };
    const { after } = await clean(buf, profile);
    const latRef = after.fields.find((f) => f.key === 'gps/GPSLatitudeRef');
    // GPS IFD is not zeroed → exifr can still read it.
    expect(latRef).toBeDefined();
  });
});

// ── clean — before/after diff ────────────────────────────────────────────────

describe('clean — before/after diff', () => {
  it('before has at least as many fields as after', async () => {
    const { before, after } = await clean(heicWithArtist());
    expect(before.fields.length).toBeGreaterThanOrEqual(after.fields.length);
  });

  it('every after field key was present in before', async () => {
    const { before, after } = await clean(heicWithGps());
    const beforeKeys = new Set(before.fields.map((f) => f.key));
    for (const f of after.fields) {
      expect(beforeKeys.has(f.key)).toBe(true);
    }
  });

  it('clean() result returns { clean, before, after }', async () => {
    const result = await clean(heicWithArtist());
    expect(result).toHaveProperty('clean');
    expect(result).toHaveProperty('before');
    expect(result).toHaveProperty('after');
    expect(result.before.fields).toBeInstanceOf(Array);
    expect(result.after.fields).toBeInstanceOf(Array);
  });
});

// ── clean — edge cases ────────────────────────────────────────────────────────

describe('clean — edge cases', () => {
  it('does not throw on an empty ArrayBuffer', async () => {
    const result = await clean(new ArrayBuffer(0));
    expect(result.clean.byteLength).toBe(0);
  });

  it('returns original buffer unchanged for non-HEIC data', async () => {
    // Feed it a JPEG SOI marker — not HEIC.
    const fake = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
    const { clean: cleaned } = await clean(fake);
    expect(cleaned.byteLength).toBe(4);
  });

  it('before and after are both empty for non-HEIC data', async () => {
    const fake = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
    const { before, after } = await clean(fake);
    // exifr will not find HEIC metadata in JPEG bytes
    expect(before.fields.filter((f) => f.category === 'location')).toHaveLength(0);
    expect(after.fields.filter((f) => f.category === 'location')).toHaveLength(0);
  });
});

// ── libheif adapter surface test ──────────────────────────────────────────────
// Verify the adapter module exports the expected API without loading WASM.

describe('heic-libheif module API', () => {
  it('exports extractMetadataBlocks as a function', async () => {
    const mod = await import('$lib/processors/heic-libheif');
    expect(typeof mod.extractMetadataBlocks).toBe('function');
  });

  it('exports resetLibHeif as a function', async () => {
    const mod = await import('$lib/processors/heic-libheif');
    expect(typeof mod.resetLibHeif).toBe('function');
  });

  it('extractMetadataBlocks rejects when WASM is not loaded', async () => {
    const mod = await import('$lib/processors/heic-libheif');
    mod.resetLibHeif(); // ensure no cached module
    // Will fail because /wasm/libheif.wasm is not available in test env.
    await expect(mod.extractMetadataBlocks(new ArrayBuffer(4))).rejects.toThrow();
  });
});
