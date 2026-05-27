import type { SupportedMime } from '@scrubsafe/shared-types';
import { detectMime } from './file-detect';

/** 100 MiB — hard limit enforced before any byte-reading. */
export const MAX_FILE_SIZE = 100 * 1_048_576;

export type RejectionReason = 'too-large' | 'unsupported-format' | 'duplicate';

export interface AcceptedFile {
  file: File;
  mime: SupportedMime;
}

export interface RejectedFile {
  file: File;
  reason: RejectionReason;
}

export interface UploadResult {
  accepted: AcceptedFile[];
  rejected: RejectedFile[];
}

/**
 * Stable dedup key — name + byte size.
 * Name-only dedup misses renamed copies; content-hash is too expensive.
 */
export function fileKey(name: string, size: number): string {
  return `${name}\x00${size}`;
}

export function fingerprint(file: File): string {
  return fileKey(file.name, file.size);
}

/**
 * Validates and classifies a batch of raw files.
 *
 * Checks (in order): duplicate → size → magic-byte MIME.
 * Async because magic-byte detection reads a small slice.
 *
 * @param files - Raw files from drag-drop, click-to-browse, or paste.
 * @param seen  - Fingerprints of files already in the queue.
 */
export async function processFiles(
  files: File[],
  seen: ReadonlySet<string> = new Set(),
): Promise<UploadResult> {
  const accepted: AcceptedFile[] = [];
  const rejected: RejectedFile[] = [];

  // Extend seen with this batch so duplicates within the batch are also caught.
  const seenThisBatch = new Set<string>(seen);

  for (const file of files) {
    const fp = fingerprint(file);

    if (seenThisBatch.has(fp)) {
      rejected.push({ file, reason: 'duplicate' });
      continue;
    }

    if (file.size > MAX_FILE_SIZE) {
      rejected.push({ file, reason: 'too-large' });
      continue;
    }

    const mime = await detectMime(file);

    if (!mime) {
      rejected.push({ file, reason: 'unsupported-format' });
      continue;
    }

    seenThisBatch.add(fp);
    accepted.push({ file, mime });
  }

  return { accepted, rejected };
}

/**
 * Extract File objects from a ClipboardEvent.
 *
 * Prefers `.items` over `.files` because `.items` captures browser-copied
 * images (e.g. right-click → copy image) while `.files` only works for
 * OS file-manager copies.
 */
export function filesFromClipboard(e: ClipboardEvent): File[] {
  const out: File[] = [];

  const items = Array.from(e.clipboardData?.items ?? []);
  for (const item of items) {
    if (item.kind !== 'file') continue;
    const f = item.getAsFile();
    if (f) out.push(f);
  }

  if (out.length === 0) {
    out.push(...Array.from(e.clipboardData?.files ?? []));
  }

  // Pasted screenshots arrive with an empty name — give them one.
  return out.map((f, i) => ensureFilename(f, i));
}

/** Assign a generated name to files that have none (e.g. pasted screenshots). */
export function ensureFilename(file: File, index: number): File {
  if (file.name) return file;
  const ext = MIME_EXT[file.type] ?? 'bin';
  const name = `pasted-${Date.now()}-${index}.${ext}`;
  return new File([file], name, { type: file.type, lastModified: file.lastModified });
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/tiff': 'tiff',
  'image/heic': 'heic',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/** Human-readable rejection message suitable for a toast. */
export function formatRejectionMessage(file: File, reason: RejectionReason): string {
  const name = truncateFilename(file.name || 'Unnamed file', 48);
  switch (reason) {
    case 'too-large':
      return `"${name}" exceeds the 100 MB limit.`;
    case 'unsupported-format':
      return `"${name}" is not a supported format. Try JPEG, PNG, TIFF, HEIC, PDF, DOCX, XLSX, or PPTX.`;
    case 'duplicate':
      return `"${name}" is already in the queue.`;
  }
}

function truncateFilename(name: string, max: number): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf('.');
  const ext = dot !== -1 ? name.slice(dot) : '';
  return name.slice(0, max - ext.length - 1) + '…' + ext;
}
