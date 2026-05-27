import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { inspect, clean, DEFAULT_PROFILE } from '$lib/processors/pdf';
import type { ScrubProfile } from '@scrubsafe/shared-types';

// ── Test PDF builder ──────────────────────────────────────────────────────────

interface PdfMeta {
  author?:   string;
  title?:    string;
  subject?:  string;
  keywords?: string[];
  creator?:  string;
  producer?: string;
  pages?:    number;
}

async function makePdf(meta: PdfMeta = {}): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < (meta.pages ?? 1); i++) doc.addPage();
  if (meta.author)   doc.setAuthor(meta.author);
  if (meta.title)    doc.setTitle(meta.title);
  if (meta.subject)  doc.setSubject(meta.subject);
  if (meta.keywords) doc.setKeywords(meta.keywords);
  if (meta.creator)  doc.setCreator(meta.creator);
  if (meta.producer) doc.setProducer(meta.producer);
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function blankPdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  doc.addPage();
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

// ── inspect ───────────────────────────────────────────────────────────────────

describe('inspect', () => {
  it('returns a MetadataSnapshot for a valid PDF', async () => {
    const buf = await blankPdf();
    const snap = await inspect(buf);
    expect(snap).toHaveProperty('fields');
    expect(Array.isArray(snap.fields)).toBe(true);
  });

  it('detects Author field', async () => {
    const buf = await makePdf({ author: 'Jane Doe' });
    const { fields } = await inspect(buf);
    const f = fields.find((x) => x.key === 'pdf/Author');
    expect(f?.value).toBe('Jane Doe');
  });

  it('detects Title field', async () => {
    const buf = await makePdf({ title: 'Confidential Report' });
    const { fields } = await inspect(buf);
    const f = fields.find((x) => x.key === 'pdf/Title');
    expect(f?.value).toBe('Confidential Report');
  });

  it('detects Creator field', async () => {
    const buf = await makePdf({ creator: 'Microsoft Word' });
    const { fields } = await inspect(buf);
    const f = fields.find((x) => x.key === 'pdf/Creator');
    expect(f?.value).toBe('Microsoft Word');
  });

  it('detects Producer field', async () => {
    const buf = await makePdf({ producer: 'Adobe PDF Library' });
    const { fields } = await inspect(buf);
    const f = fields.find((x) => x.key === 'pdf/Producer');
    expect(f?.value).toBe('Adobe PDF Library');
  });

  it('classifies Author as identity category', async () => {
    const buf = await makePdf({ author: 'John Smith' });
    const { fields } = await inspect(buf);
    const f = fields.find((x) => x.key === 'pdf/Author');
    expect(f?.category).toBe('identity');
  });

  it('classifies Creator as software category', async () => {
    const buf = await makePdf({ creator: 'Word 365' });
    const { fields } = await inspect(buf);
    const f = fields.find((x) => x.key === 'pdf/Creator');
    expect(f?.category).toBe('software');
  });

  it('classifies ModDate as history category via fallback pattern', async () => {
    const buf = await makePdf({ author: 'x' }); // force Info dict; ModDate added by pdf-lib
    const { fields } = await inspect(buf);
    const mod = fields.find((x) => x.key === 'pdf/ModDate' || x.key === 'pdf/ModificationDate');
    if (mod) expect(mod.category).toBe('history');
  });

  it('returns empty snapshot for non-PDF bytes', async () => {
    const junk = new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer;
    const snap = await inspect(junk);
    expect(snap.fields).toHaveLength(0);
  });
});

// ── clean — Author / identity ─────────────────────────────────────────────────

describe('clean — author/identity', () => {
  it('removes Author', async () => {
    const buf = await makePdf({ author: 'Jane Doe' });
    const { after } = await clean(buf);
    expect(after.fields.map((f) => f.key)).not.toContain('pdf/Author');
  });

  it('removes Title', async () => {
    const buf = await makePdf({ title: 'Private Notes' });
    const { after } = await clean(buf);
    expect(after.fields.map((f) => f.key)).not.toContain('pdf/Title');
  });

  it('removes Subject', async () => {
    const buf = await makePdf({ subject: 'Internal Use Only' });
    const { after } = await clean(buf);
    expect(after.fields.map((f) => f.key)).not.toContain('pdf/Subject');
  });

  it('preserves Author when removeAuthor is false', async () => {
    const buf = await makePdf({ author: 'Jane Doe' });
    const profile: ScrubProfile = { ...DEFAULT_PROFILE, removeAuthor: false };
    const { after } = await clean(buf, profile);
    const f = after.fields.find((x) => x.key === 'pdf/Author');
    expect(f?.value).toBe('Jane Doe');
  });

  it('reports Author in before snapshot', async () => {
    const buf = await makePdf({ author: 'Jane Doe' });
    const { before } = await clean(buf);
    expect(before.fields.map((f) => f.key)).toContain('pdf/Author');
  });
});

// ── clean — Software ──────────────────────────────────────────────────────────

describe('clean — software', () => {
  it('removes Creator', async () => {
    const buf = await makePdf({ creator: 'Microsoft Word' });
    const { after } = await clean(buf);
    expect(after.fields.map((f) => f.key)).not.toContain('pdf/Creator');
  });

  it('removes Producer', async () => {
    const buf = await makePdf({ producer: 'Adobe PDF Library' });
    const { after } = await clean(buf);
    expect(after.fields.map((f) => f.key)).not.toContain('pdf/Producer');
  });

  it('preserves Creator when removeSoftware is false', async () => {
    const buf = await makePdf({ creator: 'InDesign CC' });
    const profile: ScrubProfile = { ...DEFAULT_PROFILE, removeSoftware: false };
    const { after } = await clean(buf, profile);
    const f = after.fields.find((x) => x.key === 'pdf/Creator');
    expect(f?.value).toBe('InDesign CC');
  });
});

// ── clean — History ───────────────────────────────────────────────────────────

describe('clean — history', () => {
  it('removes ModDate / ModificationDate after full scrub', async () => {
    const buf = await makePdf({ author: 'x' }); // forces ModDate via pdf-lib Info dict
    const { after } = await clean(buf, DEFAULT_PROFILE);
    const keys = after.fields.map((f) => f.key);
    expect(keys).not.toContain('pdf/ModDate');
    expect(keys).not.toContain('pdf/ModificationDate');
  });

  it('removes CreationDate after full scrub', async () => {
    const buf = await makePdf({ author: 'x' });
    const { after } = await clean(buf, DEFAULT_PROFILE);
    const keys = after.fields.map((f) => f.key);
    expect(keys).not.toContain('pdf/CreationDate');
  });

  it('preserves date fields when removeHistory is false', async () => {
    const buf = await makePdf({ author: 'x' });
    const profile: ScrubProfile = { ...DEFAULT_PROFILE, removeHistory: false };
    const { after } = await clean(buf, profile);
    const hasDate = after.fields.some(
      (f) => f.key === 'pdf/ModDate' || f.key === 'pdf/ModificationDate' || f.key === 'pdf/CreationDate',
    );
    expect(hasDate).toBe(true);
  });
});

// ── clean — full DEFAULT_PROFILE produces empty Info ─────────────────────────

describe('clean — DEFAULT_PROFILE', () => {
  it('produces zero Info-dict fields after full scrub', async () => {
    const buf = await makePdf({
      author:   'Jane Doe',
      title:    'Secret Report',
      creator:  'Word 365',
      producer: 'Adobe PDF',
    });
    const { after } = await clean(buf, DEFAULT_PROFILE);
    const infoKeys = ['pdf/Author', 'pdf/Title', 'pdf/Subject', 'pdf/Keywords',
                      'pdf/Creator', 'pdf/Producer', 'pdf/CreationDate',
                      'pdf/ModDate', 'pdf/ModificationDate'];
    for (const k of infoKeys) {
      expect(after.fields.map((f) => f.key)).not.toContain(k);
    }
  });

  it('before has more fields than after for a richly-tagged PDF', async () => {
    const buf = await makePdf({ author: 'Jane', title: 'Title', creator: 'App' });
    const { before, after } = await clean(buf, DEFAULT_PROFILE);
    expect(before.fields.length).toBeGreaterThan(after.fields.length);
  });
});

// ── clean — visual content preserved ─────────────────────────────────────────

describe('clean — visual content preserved', () => {
  it('cleaned buffer starts with PDF magic bytes', async () => {
    const buf = await makePdf({ author: 'x' });
    const { clean: cleaned } = await clean(buf);
    const bytes = new Uint8Array(cleaned);
    // PDF files start with %PDF
    expect(bytes[0]).toBe(0x25); // %
    expect(bytes[1]).toBe(0x50); // P
    expect(bytes[2]).toBe(0x44); // D
    expect(bytes[3]).toBe(0x46); // F
  });

  it('preserves page count after scrubbing', async () => {
    const buf = await makePdf({ author: 'x', pages: 3 });
    const { clean: cleaned } = await clean(buf);
    const doc = await PDFDocument.load(new Uint8Array(cleaned));
    expect(doc.getPageCount()).toBe(3);
  });

  it('cleaned output is a non-empty ArrayBuffer', async () => {
    const buf = await makePdf({ author: 'x' });
    const { clean: cleaned } = await clean(buf);
    expect(cleaned.byteLength).toBeGreaterThan(0);
  });
});

// ── clean — before/after diff ─────────────────────────────────────────────────

describe('clean — before/after diff', () => {
  it('every after field was also present in before', async () => {
    const buf = await makePdf({ author: 'Jane', creator: 'Word' });
    const profile: ScrubProfile = { ...DEFAULT_PROFILE, removeAuthor: false };
    const { before, after } = await clean(buf, profile);
    const beforeKeys = new Set(before.fields.map((f) => f.key));
    for (const f of after.fields) {
      expect(beforeKeys.has(f.key)).toBe(true);
    }
  });
});

// ── clean — edge cases ────────────────────────────────────────────────────────

describe('clean — edge cases', () => {
  it('does not throw on a PDF with no metadata', async () => {
    const buf = await blankPdf();
    await expect(clean(buf)).resolves.toBeDefined();
  });

  it('returns original buffer when input is not a valid PDF', async () => {
    const junk = new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer;
    const { clean: cleaned } = await clean(junk);
    expect(cleaned.byteLength).toBe(4);
  });

  it('single-page PDF survives a full scrub round-trip', async () => {
    const buf = await makePdf({ author: 'x', title: 'y', creator: 'z' });
    const { clean: cleaned } = await clean(buf);
    const doc = await PDFDocument.load(new Uint8Array(cleaned));
    expect(doc.getPageCount()).toBe(1);
  });
});
