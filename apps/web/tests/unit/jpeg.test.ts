import { describe, it, expect, beforeAll } from 'vitest';
import piexif from 'piexifjs';
import { inspect, clean, DEFAULT_PROFILE } from '$lib/processors/jpeg';
import type { ScrubProfile } from '@scrubsafe/shared-types';

// ── Test JPEG builder ─────────────────────────────────────────────────────────
// Creates a minimal valid JPEG (SOI + EOI) then injects EXIF via piexifjs.

// piexifjs.splitIntoSegments() only stops when it finds SOS (\xff\xda), never on EOI.
// Passing a bare SOI+EOI causes it to call unpack(">H", "") on the EOI, crashing.
// This base JPEG ends with SOS so piexifjs copies everything from SOS onwards verbatim.
const MINIMAL_JPEG =
  '\xff\xd8' +                          // SOI
  '\xff\xe0\x00\x10' +                  // APP0 marker + length = 16
  'JFIF\x00' +                          // JFIF identifier (5)
  '\x01\x01' +                          // version 1.1 (2)
  '\x00' +                              // density units: none (1)
  '\x00\x01\x00\x01' +                  // X/Y density = 1 (4)
  '\x00\x00' +                          // no thumbnail (2) → 14 bytes after length = 16 ✓
  '\xff\xda' +                          // SOS marker — splitIntoSegments stops here
  '\x00\x08\x01\x01\x00\x00\x3f\x00' + // minimal SOS header (8 bytes including length)
  '\xff\xd9';                           // EOI treated as scan data

// @types/piexifjs declares thumbnail as `string`, but piexifjs accepts null at runtime.
type PiexifObj = Omit<Parameters<typeof piexif.dump>[0], 'thumbnail'> & { thumbnail?: string | null };

function makeJpeg(exifData: PiexifObj): ArrayBuffer {
  // Cast required: @types/piexifjs says thumbnail:string but runtime accepts null.
  const exifBytes = piexif.dump(exifData as Parameters<typeof piexif.dump>[0]);
  const bstr = piexif.insert(exifBytes, MINIMAL_JPEG);
  const bytes = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) bytes[i] = bstr.charCodeAt(i) & 0xff;
  return bytes.buffer;
}

function minimalJpeg(): ArrayBuffer {
  const bytes = new Uint8Array(MINIMAL_JPEG.length);
  for (let i = 0; i < MINIMAL_JPEG.length; i++) bytes[i] = MINIMAL_JPEG.charCodeAt(i) & 0xff;
  return bytes.buffer;
}

// GPS coordinates for Chicago (~41°52'N, 87°37'W).
const GPS_DATA = {
  [piexif.GPSIFD.GPSLatitudeRef]: 'N',
  [piexif.GPSIFD.GPSLatitude]: [[41, 1], [52, 1], [4116, 100]],
  [piexif.GPSIFD.GPSLongitudeRef]: 'W',
  [piexif.GPSIFD.GPSLongitude]: [[87, 1], [37, 1], [700, 100]],
};

const FULL_EXIF: PiexifObj = {
  '0th': {
    [piexif.ImageIFD.Make]:         'Apple',
    [piexif.ImageIFD.Model]:        'iPhone 15 Pro',
    [piexif.ImageIFD.Orientation]:  1,
    [piexif.ImageIFD.Artist]:       'Jane Doe',
    [piexif.ImageIFD.Software]:     'Photos 1.0',
    [piexif.ImageIFD.DateTime]:     '2024:01:15 12:30:00',
    [piexif.ImageIFD.Copyright]:    '© 2024 Jane Doe',
  },
  Exif: {
    [piexif.ExifIFD.DateTimeOriginal]:  '2024:01:15 12:30:00',
    [piexif.ExifIFD.DateTimeDigitized]: '2024:01:15 12:30:00',
  },
  GPS: GPS_DATA,
  Interop: {},
  '1st': {},
  thumbnail: null,
};

// ── inspect ───────────────────────────────────────────────────────────────────

describe('inspect', () => {
  it('returns an empty snapshot for a bare JPEG with no EXIF', async () => {
    const result = await inspect(minimalJpeg());
    expect(result.fields).toHaveLength(0);
  });

  it('detects GPS latitude and longitude', async () => {
    const buf = makeJpeg({ '0th': {}, Exif: {}, GPS: GPS_DATA, Interop: {}, '1st': {}, thumbnail: null });
    const { fields } = await inspect(buf);
    const keys = fields.map((f) => f.key);
    expect(keys).toContain('gps/GPSLatitude');
    expect(keys).toContain('gps/GPSLongitude');
  });

  it('classifies GPS fields as location category', async () => {
    const buf = makeJpeg({ '0th': {}, Exif: {}, GPS: GPS_DATA, Interop: {}, '1st': {}, thumbnail: null });
    const { fields } = await inspect(buf);
    const gps = fields.filter((f) => f.key.startsWith('gps/'));
    expect(gps.length).toBeGreaterThan(0);
    for (const f of gps) expect(f.category).toBe('location');
  });

  it('marks GPS fields as sensitive', async () => {
    const buf = makeJpeg({ '0th': {}, Exif: {}, GPS: GPS_DATA, Interop: {}, '1st': {}, thumbnail: null });
    const { fields } = await inspect(buf);
    const gps = fields.filter((f) => f.key.startsWith('gps/'));
    for (const f of gps) expect(f.sensitive).toBe(true);
  });

  it('detects Artist in the identity category', async () => {
    const buf = makeJpeg({ '0th': { [piexif.ImageIFD.Artist]: 'Jane Doe' }, Exif: {}, GPS: {}, Interop: {}, '1st': {}, thumbnail: null });
    const { fields } = await inspect(buf);
    const artist = fields.find((f) => f.key === 'ifd0/Artist');
    expect(artist).toBeDefined();
    expect(artist!.category).toBe('identity');
    expect(artist!.value).toBe('Jane Doe');
    expect(artist!.sensitive).toBe(true);
  });

  it('detects Make and Model in the device category', async () => {
    const buf = makeJpeg({ '0th': { [piexif.ImageIFD.Make]: 'Apple', [piexif.ImageIFD.Model]: 'iPhone 15' }, Exif: {}, GPS: {}, Interop: {}, '1st': {}, thumbnail: null });
    const { fields } = await inspect(buf);
    const make  = fields.find((f) => f.key === 'ifd0/Make');
    const model = fields.find((f) => f.key === 'ifd0/Model');
    expect(make?.category).toBe('device');
    expect(model?.category).toBe('device');
  });

  it('detects Software in the software category', async () => {
    const buf = makeJpeg({ '0th': { [piexif.ImageIFD.Software]: 'Lightroom 13' }, Exif: {}, GPS: {}, Interop: {}, '1st': {}, thumbnail: null });
    const { fields } = await inspect(buf);
    const sw = fields.find((f) => f.key === 'ifd0/Software');
    expect(sw?.category).toBe('software');
  });

  it('detects DateTime in the history category', async () => {
    // exifr renames IFD0 tag 0x0132 to "ModifyDate"
    const buf = makeJpeg({ '0th': { [piexif.ImageIFD.DateTime]: '2024:01:15 12:30:00' }, Exif: {}, GPS: {}, Interop: {}, '1st': {}, thumbnail: null });
    const { fields } = await inspect(buf);
    const dt = fields.find((f) => f.key === 'ifd0/ModifyDate');
    expect(dt?.category).toBe('history');
  });

  it('detects DateTimeOriginal in the history category', async () => {
    const buf = makeJpeg({ '0th': {}, Exif: { [piexif.ExifIFD.DateTimeOriginal]: '2024:01:15 12:30:00' }, GPS: {}, Interop: {}, '1st': {}, thumbnail: null });
    const { fields } = await inspect(buf);
    const dt = fields.find((f) => f.key === 'exif/DateTimeOriginal');
    expect(dt?.category).toBe('history');
  });
});

// ── clean — GPS removal ───────────────────────────────────────────────────────

describe('clean — GPS', () => {
  it('removes GPS latitude and longitude', async () => {
    const buf = makeJpeg(FULL_EXIF);
    const { after } = await clean(buf);
    const keys = after.fields.map((f) => f.key);
    expect(keys).not.toContain('gps/GPSLatitude');
    expect(keys).not.toContain('gps/GPSLongitude');
  });

  it('reports GPS fields in the before snapshot', async () => {
    const buf = makeJpeg(FULL_EXIF);
    const { before } = await clean(buf);
    const keys = before.fields.map((f) => f.key);
    expect(keys).toContain('gps/GPSLatitude');
  });

  it('preserves GPS when removeGps is false', async () => {
    const buf = makeJpeg(FULL_EXIF);
    const profile: ScrubProfile = { ...DEFAULT_PROFILE, removeGps: false };
    const { after } = await clean(buf, profile);
    const keys = after.fields.map((f) => f.key);
    expect(keys).toContain('gps/GPSLatitude');
  });
});

// ── clean — Identity/Author removal ──────────────────────────────────────────

describe('clean — author/identity', () => {
  it('removes Artist', async () => {
    const buf = makeJpeg(FULL_EXIF);
    const { after } = await clean(buf);
    expect(after.fields.map((f) => f.key)).not.toContain('ifd0/Artist');
  });

  it('removes Copyright', async () => {
    const buf = makeJpeg(FULL_EXIF);
    const { after } = await clean(buf);
    expect(after.fields.map((f) => f.key)).not.toContain('ifd0/Copyright');
  });

  it('preserves Artist when removeAuthor is false', async () => {
    const buf = makeJpeg(FULL_EXIF);
    const profile: ScrubProfile = { ...DEFAULT_PROFILE, removeAuthor: false };
    const { after } = await clean(buf, profile);
    expect(after.fields.map((f) => f.key)).toContain('ifd0/Artist');
  });
});

// ── clean — Device removal ────────────────────────────────────────────────────

describe('clean — device', () => {
  it('removes Make and Model', async () => {
    const buf = makeJpeg(FULL_EXIF);
    const { after } = await clean(buf);
    const keys = after.fields.map((f) => f.key);
    expect(keys).not.toContain('ifd0/Make');
    expect(keys).not.toContain('ifd0/Model');
  });

  it('preserves Make when removeDevice is false', async () => {
    const buf = makeJpeg(FULL_EXIF);
    const profile: ScrubProfile = { ...DEFAULT_PROFILE, removeDevice: false };
    const { after } = await clean(buf, profile);
    expect(after.fields.map((f) => f.key)).toContain('ifd0/Make');
  });
});

// ── clean — Software removal ──────────────────────────────────────────────────

describe('clean — software', () => {
  it('removes Software tag', async () => {
    const buf = makeJpeg(FULL_EXIF);
    const { after } = await clean(buf);
    expect(after.fields.map((f) => f.key)).not.toContain('ifd0/Software');
  });

  it('preserves Software when removeSoftware is false', async () => {
    const buf = makeJpeg(FULL_EXIF);
    const profile: ScrubProfile = { ...DEFAULT_PROFILE, removeSoftware: false };
    const { after } = await clean(buf, profile);
    expect(after.fields.map((f) => f.key)).toContain('ifd0/Software');
  });
});

// ── clean — History removal ───────────────────────────────────────────────────

describe('clean — history', () => {
  it('removes DateTime (file-modified timestamp)', async () => {
    // exifr surfaces IFD0 tag 0x0132 as "ModifyDate"
    const buf = makeJpeg(FULL_EXIF);
    const { after } = await clean(buf);
    expect(after.fields.map((f) => f.key)).not.toContain('ifd0/ModifyDate');
  });

  it('removes DateTimeOriginal from ExifIFD', async () => {
    const buf = makeJpeg(FULL_EXIF);
    const { after } = await clean(buf);
    expect(after.fields.map((f) => f.key)).not.toContain('exif/DateTimeOriginal');
  });

  it('preserves DateTime when removeHistory is false', async () => {
    // exifr surfaces IFD0 tag 0x0132 as "ModifyDate"
    const buf = makeJpeg(FULL_EXIF);
    const profile: ScrubProfile = { ...DEFAULT_PROFILE, removeHistory: false };
    const { after } = await clean(buf, profile);
    expect(after.fields.map((f) => f.key)).toContain('ifd0/ModifyDate');
  });
});

// ── clean — Orientation preserved ─────────────────────────────────────────────

describe('clean — preserved fields', () => {
  it('keeps Orientation in the after snapshot', async () => {
    const buf = makeJpeg(FULL_EXIF);
    const { after } = await clean(buf);
    const orientation = after.fields.find((f) => f.key === 'ifd0/Orientation');
    expect(orientation).toBeDefined();
    expect(orientation!.value).toBe('1');
  });

  it('clean() returns a non-empty ArrayBuffer', async () => {
    const buf = makeJpeg(FULL_EXIF);
    const { clean: cleaned } = await clean(buf);
    expect(cleaned.byteLength).toBeGreaterThan(0);
  });

  it('cleaned buffer is a valid JPEG (starts with FF D8)', async () => {
    const buf = makeJpeg(FULL_EXIF);
    const { clean: cleaned } = await clean(buf);
    const bytes = new Uint8Array(cleaned);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
  });
});

// ── clean — diff completeness ─────────────────────────────────────────────────

describe('clean — before/after diff', () => {
  it('before has more fields than after for a fully-tagged JPEG', async () => {
    const buf = makeJpeg(FULL_EXIF);
    const { before, after } = await clean(buf);
    expect(before.fields.length).toBeGreaterThan(after.fields.length);
  });

  it('every after field was also in before', async () => {
    const buf = makeJpeg(FULL_EXIF);
    const { before, after } = await clean(buf);
    const beforeKeys = new Set(before.fields.map((f) => f.key));
    for (const f of after.fields) {
      expect(beforeKeys.has(f.key)).toBe(true);
    }
  });
});

// ── clean — edge cases ────────────────────────────────────────────────────────

describe('clean — edge cases', () => {
  it('does not throw on a JPEG with no EXIF data', async () => {
    const result = await clean(minimalJpeg());
    expect(result.before.fields).toHaveLength(0);
    expect(result.after.fields).toHaveLength(0);
  });

  it('returns a valid ArrayBuffer even when no EXIF is present', async () => {
    const { clean: cleaned } = await clean(minimalJpeg());
    expect(cleaned.byteLength).toBeGreaterThan(0);
  });
});
