import { describe, it, expect } from 'vitest';
import {
  processFiles,
  fingerprint,
  fileKey,
  ensureFilename,
  formatRejectionMessage,
  MAX_FILE_SIZE,
} from '$lib/utils/upload';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFile(bytes: number[], name = 'test.bin'): File {
  return new File([new Uint8Array(bytes)], name);
}

function jpegFile(name = 'photo.jpg', extraBytes = 0): File {
  const header = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
  const padding = new Array(extraBytes).fill(0x00);
  return makeFile([...header, ...padding], name);
}

function pngFile(name = 'image.png'): File {
  return makeFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], name);
}

function pdfFile(name = 'doc.pdf'): File {
  return makeFile([0x25, 0x50, 0x44, 0x46, 0x2d], name);
}

function unknownFile(name = 'mystery.bin'): File {
  return makeFile([0x00, 0x01, 0x02, 0x03], name);
}

function oversizedFile(name = 'huge.jpg'): File {
  // processFiles checks file.size before reading bytes, so we only need to
  // spoof the size.  Object.defineProperty cannot override Blob.size (it is a
  // non-configurable getter on the prototype), so we use a Proxy instead.
  const real = new File([new Uint8Array([0xff, 0xd8, 0xff])], name);
  return new Proxy(real, {
    get(target, prop: string | symbol) {
      if (prop === 'size') return MAX_FILE_SIZE + 1;
      const val = Reflect.get(target, prop, target);
      return typeof val === 'function' ? val.bind(target) : val;
    },
  }) as File;
}

// ── processFiles ──────────────────────────────────────────────────────────────

describe('processFiles', () => {
  it('accepts a valid JPEG', async () => {
    const { accepted, rejected } = await processFiles([jpegFile()]);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]!.mime).toBe('image/jpeg');
    expect(rejected).toHaveLength(0);
  });

  it('accepts a valid PNG', async () => {
    const { accepted, rejected } = await processFiles([pngFile()]);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]!.mime).toBe('image/png');
    expect(rejected).toHaveLength(0);
  });

  it('accepts a valid PDF', async () => {
    const { accepted, rejected } = await processFiles([pdfFile()]);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]!.mime).toBe('application/pdf');
    expect(rejected).toHaveLength(0);
  });

  it('accepts a mix of valid files', async () => {
    const { accepted, rejected } = await processFiles([jpegFile(), pngFile(), pdfFile()]);
    expect(accepted).toHaveLength(3);
    expect(rejected).toHaveLength(0);
  });

  it('rejects a file that is too large', async () => {
    const file = oversizedFile();
    const { accepted, rejected } = await processFiles([file]);
    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBe('too-large');
    expect(rejected[0]!.file).toBe(file);
  });

  it('rejects unsupported format', async () => {
    const file = unknownFile();
    const { accepted, rejected } = await processFiles([file]);
    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBe('unsupported-format');
  });

  it('rejects a file already in the seen set', async () => {
    const file = jpegFile('a.jpg');
    const seen = new Set([fingerprint(file)]);
    const { accepted, rejected } = await processFiles([file], seen);
    expect(accepted).toHaveLength(0);
    expect(rejected[0]!.reason).toBe('duplicate');
  });

  it('deduplicates files within the same batch', async () => {
    // Two File objects with identical name+size — second should be duplicate.
    const f1 = jpegFile('shot.jpg');
    const f2 = jpegFile('shot.jpg'); // same name, same content → same size
    const { accepted, rejected } = await processFiles([f1, f2]);
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBe('duplicate');
  });

  it('does NOT deduplicate files with same name but different sizes', async () => {
    const f1 = jpegFile('shot.jpg', 0);  // 9 bytes
    const f2 = jpegFile('shot.jpg', 10); // 19 bytes — different size
    const { accepted } = await processFiles([f1, f2]);
    expect(accepted).toHaveLength(2);
  });

  it('processes an empty list without errors', async () => {
    const { accepted, rejected } = await processFiles([]);
    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(0);
  });

  it('reports all failures in a mixed batch', async () => {
    const { accepted, rejected } = await processFiles([
      jpegFile(),
      unknownFile(),
      pngFile(),
    ]);
    expect(accepted).toHaveLength(2);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBe('unsupported-format');
  });
});

// ── fingerprint / fileKey ─────────────────────────────────────────────────────

describe('fingerprint', () => {
  it('returns the same key for files with identical name+size', () => {
    const a = new File([new Uint8Array(8)], 'test.jpg');
    const b = new File([new Uint8Array(8)], 'test.jpg');
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it('returns different keys for different names', () => {
    const a = new File([new Uint8Array(8)], 'a.jpg');
    const b = new File([new Uint8Array(8)], 'b.jpg');
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });

  it('returns different keys for different sizes', () => {
    const a = new File([new Uint8Array(8)], 'x.jpg');
    const b = new File([new Uint8Array(9)], 'x.jpg');
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });

  it('matches fileKey(name, size)', () => {
    const f = new File([new Uint8Array(12)], 'test.png');
    expect(fingerprint(f)).toBe(fileKey('test.png', 12));
  });
});

// ── ensureFilename ────────────────────────────────────────────────────────────

describe('ensureFilename', () => {
  it('returns the original file unchanged when it already has a name', () => {
    const f = new File([new Uint8Array(4)], 'photo.jpg', { type: 'image/jpeg' });
    expect(ensureFilename(f, 0)).toBe(f);
  });

  it('assigns a generated name to files with an empty name', () => {
    const f = new File([new Uint8Array(4)], '', { type: 'image/png' });
    const result = ensureFilename(f, 0);
    expect(result.name).toMatch(/^pasted-\d+-0\.png$/);
  });

  it('uses index in the generated name', () => {
    const f = new File([new Uint8Array(4)], '', { type: 'image/jpeg' });
    const r0 = ensureFilename(f, 0);
    const r3 = ensureFilename(f, 3);
    expect(r0.name).toContain('-0.');
    expect(r3.name).toContain('-3.');
  });

  it('falls back to .bin extension for unknown MIME types', () => {
    const f = new File([new Uint8Array(4)], '', { type: 'application/octet-stream' });
    const result = ensureFilename(f, 0);
    expect(result.name).toMatch(/\.bin$/);
  });
});

// ── formatRejectionMessage ────────────────────────────────────────────────────

describe('formatRejectionMessage', () => {
  it('includes the filename and reason for too-large', () => {
    const f = new File([], 'photo.jpg');
    const msg = formatRejectionMessage(f, 'too-large');
    expect(msg).toContain('photo.jpg');
    expect(msg).toContain('100 MB');
  });

  it('includes the filename and supported formats for unsupported-format', () => {
    const f = new File([], 'data.bin');
    const msg = formatRejectionMessage(f, 'unsupported-format');
    expect(msg).toContain('data.bin');
    expect(msg).toContain('JPEG');
  });

  it('includes the filename for duplicate', () => {
    const f = new File([], 'shot.png');
    const msg = formatRejectionMessage(f, 'duplicate');
    expect(msg).toContain('shot.png');
    expect(msg).toContain('queue');
  });

  it('truncates very long filenames', () => {
    const longName = 'a'.repeat(60) + '.jpg';
    const f = new File([], longName);
    const msg = formatRejectionMessage(f, 'too-large');
    expect(msg).toContain('…');
    // The visible portion should be shorter than the full name.
    expect(msg.length).toBeLessThan(longName.length + 60);
  });

  it('handles files with no name', () => {
    const f = new File([], '');
    const msg = formatRejectionMessage(f, 'unsupported-format');
    expect(msg).toContain('Unnamed file');
  });
});
