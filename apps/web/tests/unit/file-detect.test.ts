import { describe, it, expect } from 'vitest';
import { detectMime } from '$lib/utils/file-detect';

function makeFile(bytes: number[], name = 'test', mimeHint = 'application/octet-stream'): File {
  const buffer = new Uint8Array(bytes).buffer;
  return new File([buffer], name, { type: mimeHint });
}

// Build a minimal HEIC-like header (ftyp box with a given brand).
function heicFile(brand: string, name = 'photo.heic'): File {
  const brandBytes = brand.split('').map((c) => c.charCodeAt(0));
  const bytes = [
    0x00, 0x00, 0x00, 0x18, // box size (24)
    0x66, 0x74, 0x79, 0x70, // "ftyp"
    ...brandBytes.slice(0, 4).map((b) => b ?? 0x00), // major brand (padded to 4)
    0x00, 0x00, 0x00, 0x00, // minor version
  ];
  return makeFile(bytes, name);
}

describe('detectMime', () => {
  // ── Standard signatures ───────────────────────────────────────────────────

  it('detects JPEG', async () => {
    const f = makeFile([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], 'photo.jpg');
    expect(await detectMime(f)).toBe('image/jpeg');
  });

  it('detects PNG', async () => {
    const f = makeFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'image.png');
    expect(await detectMime(f)).toBe('image/png');
  });

  it('detects TIFF little-endian', async () => {
    const f = makeFile([0x49, 0x49, 0x2a, 0x00], 'scan.tif');
    expect(await detectMime(f)).toBe('image/tiff');
  });

  it('detects TIFF big-endian', async () => {
    const f = makeFile([0x4d, 0x4d, 0x00, 0x2a], 'scan.tif');
    expect(await detectMime(f)).toBe('image/tiff');
  });

  it('detects PDF', async () => {
    const f = makeFile([0x25, 0x50, 0x44, 0x46, 0x2d], 'document.pdf');
    expect(await detectMime(f)).toBe('application/pdf');
  });

  // ── HEIC / HEIF brand detection ───────────────────────────────────────────

  it('detects HEIC with "heic" major brand', async () => {
    expect(await detectMime(heicFile('heic'))).toBe('image/heic');
  });

  it('detects HEIC with "heif" major brand', async () => {
    expect(await detectMime(heicFile('heif'))).toBe('image/heic');
  });

  it('detects HEIC with "mif1" major brand (multi-image)', async () => {
    expect(await detectMime(heicFile('mif1'))).toBe('image/heic');
  });

  it('detects HEIC with "heis" major brand', async () => {
    expect(await detectMime(heicFile('heis'))).toBe('image/heic');
  });

  it('does NOT mis-detect an MP4 video (mp41 brand) as HEIC', async () => {
    expect(await detectMime(heicFile('mp41', 'video.mp4'))).toBeNull();
  });

  it('does NOT mis-detect an M4A audio (M4A  brand) as HEIC', async () => {
    expect(await detectMime(heicFile('M4A ', 'audio.m4a'))).toBeNull();
  });

  it('does NOT mis-detect an isom MP4 container as HEIC', async () => {
    expect(await detectMime(heicFile('isom', 'container.mp4'))).toBeNull();
  });

  // ── Unknown / unsupported ─────────────────────────────────────────────────

  it('returns null for unknown magic bytes', async () => {
    const f = makeFile([0x00, 0x01, 0x02, 0x03], 'unknown.bin');
    expect(await detectMime(f)).toBeNull();
  });

  it('returns null for a file that is too short to match any signature', async () => {
    const f = makeFile([0xff], 'tiny.jpg');
    expect(await detectMime(f)).toBeNull();
  });

  it('returns null for a ZIP that is not a recognised Office format', async () => {
    // PK magic + non-Office content
    const f = makeFile([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00], 'archive.zip');
    expect(await detectMime(f)).toBeNull();
  });
});
