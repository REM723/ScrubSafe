import { describe, it, expect } from 'vitest';
import { inspect, clean, DEFAULT_PROFILE } from '$lib/processors/png';
import type { ScrubProfile } from '@scrubsafe/shared-types';

// ── PNG builder ───────────────────────────────────────────────────────────────

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function crc32(type: string, data: Uint8Array): number {
  const TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (let i = 0; i < 4; i++) crc = TABLE[(crc ^ type.charCodeAt(i)) & 0xff]! ^ (crc >>> 8);
  for (let i = 0; i < data.length; i++) crc = TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

interface RawChunk { type: string; data: Uint8Array; }

function buildPng(chunks: RawChunk[]): ArrayBuffer {
  const total = 8 + chunks.reduce((n, c) => n + 12 + c.data.length, 0);
  const buf = new Uint8Array(total);
  for (let i = 0; i < 8; i++) buf[i] = PNG_SIG[i]!;
  let off = 8;
  for (const { type, data } of chunks) {
    const len = data.length;
    buf[off]     = (len >>> 24) & 0xff;
    buf[off + 1] = (len >>> 16) & 0xff;
    buf[off + 2] = (len >>> 8)  & 0xff;
    buf[off + 3] =  len         & 0xff;
    for (let i = 0; i < 4; i++) buf[off + 4 + i] = type.charCodeAt(i);
    buf.set(data, off + 8);
    const crc = crc32(type, data);
    buf[off + 8 + len]     = (crc >>> 24) & 0xff;
    buf[off + 8 + len + 1] = (crc >>> 16) & 0xff;
    buf[off + 8 + len + 2] = (crc >>> 8)  & 0xff;
    buf[off + 8 + len + 3] =  crc         & 0xff;
    off += 12 + len;
  }
  return buf.buffer;
}

// Minimal 1×1 grayscale PNG: IHDR + IDAT + IEND.
function ihdrChunk(w = 1, h = 1): RawChunk {
  const d = new Uint8Array(13);
  d[0] = (w >>> 24) & 0xff; d[1] = (w >>> 16) & 0xff; d[2] = (w >>> 8) & 0xff; d[3] = w & 0xff;
  d[4] = (h >>> 24) & 0xff; d[5] = (h >>> 16) & 0xff; d[6] = (h >>> 8) & 0xff; d[7] = h & 0xff;
  d[8] = 8; // bit depth
  d[9] = 0; // color type: grayscale
  // compression, filter, interlace all 0
  return { type: 'IHDR', data: d };
}

// Minimal valid IDAT: deflate-compressed single row (filter 0 + one 0x00 pixel).
function idatChunk(): RawChunk {
  // zlib: CMF=0x78, FLG=0x01, deflate non-compressed block
  // Raw data: filter_byte(0) + pixel(0) = [0x00, 0x00]
  const d = new Uint8Array([
    0x78, 0x01,             // zlib header
    0x01,                   // BFINAL=1, BTYPE=00 (no compression)
    0x02, 0x00,             // LEN = 2
    0xfd, 0xff,             // NLEN (one's complement)
    0x00, 0x00,             // filter byte + pixel
    0x00, 0x00, 0x02, 0x00, // Adler-32 checksum
  ]);
  return { type: 'IDAT', data: d };
}

function iendChunk(): RawChunk {
  return { type: 'IEND', data: new Uint8Array(0) };
}

function textChunk(keyword: string, value: string): RawChunk {
  const enc = new TextEncoder();
  const kw  = enc.encode(keyword);
  const val = enc.encode(value);
  const d   = new Uint8Array(kw.length + 1 + val.length);
  d.set(kw);
  d[kw.length] = 0; // null separator
  d.set(val, kw.length + 1);
  return { type: 'tEXt', data: d };
}

function tIMEChunk(year = 2024, month = 1, day = 15, h = 12, m = 30, s = 0): RawChunk {
  const d = new Uint8Array(7);
  d[0] = (year >>> 8) & 0xff; d[1] = year & 0xff;
  d[2] = month; d[3] = day; d[4] = h; d[5] = m; d[6] = s;
  return { type: 'tIME', data: d };
}

function minimalPng(): ArrayBuffer {
  return buildPng([ihdrChunk(), idatChunk(), iendChunk()]);
}

function fullPng(): ArrayBuffer {
  return buildPng([
    ihdrChunk(),
    idatChunk(),
    textChunk('Author',   'Jane Doe'),
    textChunk('Software', 'GIMP 2.10'),
    textChunk('Comment',  'taken at the park'),
    textChunk('Creation Time', '2024-01-15'),
    tIMEChunk(),
    iendChunk(),
  ]);
}

// ── inspect ───────────────────────────────────────────────────────────────────

describe('inspect', () => {
  it('returns no sensitive or PII fields for a bare PNG with no metadata chunks', async () => {
    const result = await inspect(minimalPng());
    const pii = result.fields.filter((f) => f.sensitive || f.category === 'identity' || f.category === 'location');
    expect(pii).toHaveLength(0);
  });

  it('detects tEXt Author chunk', async () => {
    const buf = buildPng([ihdrChunk(), idatChunk(), textChunk('Author', 'Jane Doe'), iendChunk()]);
    const { fields } = await inspect(buf);
    const f = fields.find((x) => x.value === 'Jane Doe');
    expect(f).toBeDefined();
  });

  it('detects tEXt Software chunk', async () => {
    const buf = buildPng([ihdrChunk(), idatChunk(), textChunk('Software', 'GIMP'), iendChunk()]);
    const { fields } = await inspect(buf);
    const f = fields.find((x) => x.value === 'GIMP');
    expect(f).toBeDefined();
  });

  it('detects tIME chunk', async () => {
    const buf = buildPng([ihdrChunk(), idatChunk(), tIMEChunk(), iendChunk()]);
    const { fields } = await inspect(buf);
    const f = fields.find((x) => x.key === 'png/tIME');
    expect(f).toBeDefined();
    expect(f!.category).toBe('history');
  });

  it('classifies Author chunk as identity', async () => {
    const buf = buildPng([ihdrChunk(), idatChunk(), textChunk('Author', 'Jane Doe'), iendChunk()]);
    const { fields } = await inspect(buf);
    const f = fields.find((x) => x.value === 'Jane Doe');
    expect(f?.category).toBe('identity');
  });

  it('classifies Software chunk as software', async () => {
    const buf = buildPng([ihdrChunk(), idatChunk(), textChunk('Software', 'GIMP'), iendChunk()]);
    const { fields } = await inspect(buf);
    const f = fields.find((x) => x.value === 'GIMP');
    expect(f?.category).toBe('software');
  });
});

// ── clean ─────────────────────────────────────────────────────────────────────

describe('clean — text chunk removal', () => {
  it('removes Author tEXt chunk', async () => {
    const buf = buildPng([ihdrChunk(), idatChunk(), textChunk('Author', 'Jane Doe'), iendChunk()]);
    const { after } = await clean(buf);
    expect(after.fields.find((f) => f.value === 'Jane Doe')).toBeUndefined();
  });

  it('removes Software tEXt chunk', async () => {
    const buf = buildPng([ihdrChunk(), idatChunk(), textChunk('Software', 'GIMP'), iendChunk()]);
    const { after } = await clean(buf);
    expect(after.fields.find((f) => f.value === 'GIMP')).toBeUndefined();
  });

  it('removes tIME chunk by default', async () => {
    const buf = buildPng([ihdrChunk(), idatChunk(), tIMEChunk(), iendChunk()]);
    const { after } = await clean(buf);
    expect(after.fields.find((f) => f.key === 'png/tIME')).toBeUndefined();
  });

  it('preserves tIME when removeHistory is false', async () => {
    const buf = buildPng([ihdrChunk(), idatChunk(), tIMEChunk(), iendChunk()]);
    const profile: ScrubProfile = { ...DEFAULT_PROFILE, removeHistory: false };
    const { after } = await clean(buf, profile);
    expect(after.fields.find((f) => f.key === 'png/tIME')).toBeDefined();
  });

  it('preserves Author when removeAuthor is false', async () => {
    const buf = buildPng([ihdrChunk(), idatChunk(), textChunk('Author', 'Jane Doe'), iendChunk()]);
    const profile: ScrubProfile = { ...DEFAULT_PROFILE, removeAuthor: false };
    const { after } = await clean(buf, profile);
    expect(after.fields.find((f) => f.value === 'Jane Doe')).toBeDefined();
  });
});

describe('clean — structural preservation', () => {
  it('returns a valid PNG (correct signature)', async () => {
    const { clean: cleaned } = await clean(fullPng());
    const bytes = new Uint8Array(cleaned);
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50); // 'P'
    expect(bytes[2]).toBe(0x4e); // 'N'
    expect(bytes[3]).toBe(0x47); // 'G'
  });

  it('clean() returns a non-empty ArrayBuffer', async () => {
    const { clean: cleaned } = await clean(fullPng());
    expect(cleaned.byteLength).toBeGreaterThan(0);
  });

  it('does not throw on a PNG with no metadata chunks', async () => {
    const result = await clean(minimalPng());
    // Structural fields (width/height) may surface; PII fields should not.
    const pii = (snap: typeof result.before) =>
      snap.fields.filter((f) => f.sensitive || f.category === 'identity' || f.category === 'location');
    expect(pii(result.before)).toHaveLength(0);
    expect(pii(result.after)).toHaveLength(0);
  });

  it('before has more fields than after for a tagged PNG', async () => {
    const { before, after } = await clean(fullPng());
    expect(before.fields.length).toBeGreaterThan(after.fields.length);
  });

  it('every after field was also in before', async () => {
    const { before, after } = await clean(fullPng());
    const beforeKeys = new Set(before.fields.map((f) => f.key));
    for (const f of after.fields) {
      expect(beforeKeys.has(f.key)).toBe(true);
    }
  });
});

describe('clean — before/after diff', () => {
  it('reports metadata in before snapshot', async () => {
    const buf = buildPng([ihdrChunk(), idatChunk(), textChunk('Author', 'Jane Doe'), iendChunk()]);
    const { before } = await clean(buf);
    expect(before.fields.length).toBeGreaterThan(0);
  });

  it('reports clean snapshot after removal', async () => {
    const buf = buildPng([ihdrChunk(), idatChunk(), textChunk('Author', 'Jane Doe'), iendChunk()]);
    const { after } = await clean(buf);
    expect(after.fields.find((f) => f.value === 'Jane Doe')).toBeUndefined();
  });
});
