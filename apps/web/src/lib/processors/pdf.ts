import { PDFDocument, PDFDict, PDFName, PDFString, PDFHexString } from 'pdf-lib';
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

// ─── Info dictionary field → profile flag mapping ─────────────────────────────

const INFO_FLAG: Record<string, keyof ScrubProfile> = {
  Title:            'removeAuthor',
  Author:           'removeAuthor',
  Subject:          'removeAuthor',
  Keywords:         'removeAuthor',
  Creator:          'removeSoftware',
  Producer:         'removeSoftware',
  CreationDate:     'removeHistory',
  ModDate:          'removeHistory',
  ModificationDate: 'removeHistory',
};

// ─── inspect ─────────────────────────────────────────────────────────────────
// Uses pdf-lib's public getters for known Info fields — more reliable than
// low-level trailer traversal which depends on PDFRef type guards.

export async function inspect(buffer: ArrayBuffer): Promise<MetadataSnapshot> {
  const fields: MetadataField[] = [];

  try {
    const doc = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });

    // Known Info dictionary fields via public API
    const strings: Array<[string, string | undefined]> = [
      ['Title',    doc.getTitle()],
      ['Author',   doc.getAuthor()],
      ['Subject',  doc.getSubject()],
      ['Keywords', doc.getKeywords()],
      ['Creator',  doc.getCreator()],
      ['Producer', doc.getProducer()],
    ];
    for (const [key, val] of strings) {
      if (val?.trim()) fields.push(buildField('pdf', key, val.trim()));
    }

    const created = doc.getCreationDate();
    if (created) fields.push(buildField('pdf', 'CreationDate', created.toISOString()));

    const modified = doc.getModificationDate();
    if (modified) fields.push(buildField('pdf', 'ModDate', modified.toISOString()));

    // Any additional custom Info fields not covered by the public getters
    try {
      const infoRef = doc.context.trailerInfo.Info;
      if (infoRef) {
        const info = doc.context.lookup(infoRef, PDFDict);
        const knownKeys = new Set(Object.keys(INFO_FLAG).concat(
          ['Title','Author','Subject','Keywords','Creator','Producer','CreationDate','ModDate','ModificationDate'],
        ));
        for (const [keyName, value] of info.entries()) {
          const key = keyName.toString().replace(/^\//, '');
          if (knownKeys.has(key)) continue; // already captured above
          let str = '';
          if (value instanceof PDFString)    str = value.decodeText();
          else if (value instanceof PDFHexString) str = value.decodeText();
          else str = value.toString();
          if (str.trim()) fields.push(buildField('pdf', key, str.trim()));
        }
      }
    } catch { /* no Info dict or unreadable */ }

    const catalog = doc.catalog;

    // XMP metadata stream
    if (catalog.get(PDFName.of('Metadata')) !== undefined) {
      fields.push(buildField('pdf', 'XMP', 'present'));
    }

    // OpenAction (auto-executes on open)
    if (catalog.get(PDFName.of('OpenAction')) !== undefined) {
      fields.push(buildField('pdf', 'OpenAction', 'present'));
    }

    // JavaScript in Names tree
    const namesRef = catalog.get(PDFName.of('Names'));
    if (namesRef) {
      try {
        const names = doc.context.lookup(namesRef, PDFDict);
        if (names.get(PDFName.of('JavaScript')) !== undefined) {
          fields.push(buildField('pdf', 'JavaScript', 'present'));
        }
      } catch { /* ignore */ }
    }
  } catch { /* not parseable */ }

  return { fields };
}

// ─── scrubber ─────────────────────────────────────────────────────────────────

async function scrubPdf(buffer: ArrayBuffer, profile: ScrubProfile): Promise<ArrayBuffer> {
  const doc = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
  const catalog = doc.catalog;

  // — /Info dictionary ────────────────────────────────────────────────────────
  // doc.context.trailerInfo.Info is the same accessor pdf-lib uses internally in
  // updateInfoDict(), so it's the reliable path for cross-version compatibility.
  try {
    const infoRef = doc.context.trailerInfo.Info;
    if (infoRef) {
      const info = doc.context.lookup(infoRef, PDFDict);
      for (const [key, flag] of Object.entries(INFO_FLAG)) {
        if (profile[flag]) info.delete(PDFName.of(key));
      }
      // If Info dict is now empty, remove the trailer reference so pdf-lib
      // doesn't try to update it (and re-add ModDate) during save().
      if (info.keys().length === 0) {
        doc.context.trailer.delete(PDFName.of('Info'));
      }
    }
  } catch { /* no Info dict */ }

  // Prevent pdf-lib's flush() from silently re-adding ModificationDate.
  // updateInfoDict() is a private prototype method; overriding the instance
  // is intentional here so the saved output contains exactly what we chose.
  (doc as unknown as Record<string, () => void>)['updateInfoDict'] = (): void => { /* no-op */ };

  // — XMP metadata stream ─────────────────────────────────────────────────────
  const anyFlag = profile.removeAuthor || profile.removeSoftware ||
                  profile.removeHistory || profile.removeDevice || profile.removeGps;
  if (anyFlag) catalog.delete(PDFName.of('Metadata'));

  // — OpenAction and JavaScript ───────────────────────────────────────────────
  // Removed unconditionally — they auto-execute code on open.
  catalog.delete(PDFName.of('OpenAction'));

  const namesRef = catalog.get(PDFName.of('Names'));
  if (namesRef) {
    try {
      const names = doc.context.lookup(namesRef, PDFDict);
      names.delete(PDFName.of('JavaScript'));
    } catch { /* ignore */ }
  }

  const savedBytes = await doc.save({ useObjectStreams: false });
  const result = new Uint8Array(savedBytes.length);
  result.set(savedBytes);
  return result.buffer;
}

// ─── clean ───────────────────────────────────────────────────────────────────

export async function clean(
  buffer: ArrayBuffer,
  profile: ScrubProfile = DEFAULT_PROFILE,
): Promise<CleanResult> {
  const before = await inspect(buffer);

  let cleaned: ArrayBuffer;
  try {
    cleaned = await scrubPdf(buffer, profile);
  } catch {
    cleaned = buffer;
  }

  const after = await inspect(cleaned);
  return { clean: cleaned, before, after };
}

// ─── Worker entry point ───────────────────────────────────────────────────────

export async function stripPdf(buffer: ArrayBuffer): Promise<CleanResult> {
  return clean(buffer, DEFAULT_PROFILE);
}
