import type { WorkerInbound, WorkerOutbound, SupportedMime, MetadataSnapshot } from '@scrubsafe/shared-types';
import { stripJpeg } from '../processors/jpeg';
import { stripPng } from '../processors/png';
import { stripTiff } from '../processors/tiff';
import { stripHeic } from '../processors/heic';
import { stripPdf } from '../processors/pdf';
import { stripOffice } from '../processors/office';

interface ProcessorResult {
  clean: ArrayBuffer;
  before: MetadataSnapshot;
  after: MetadataSnapshot;
}

type Processor = (buffer: ArrayBuffer) => Promise<ProcessorResult>;

const PROCESSORS: Record<SupportedMime, Processor> = {
  'image/jpeg': stripJpeg,
  'image/png': stripPng,
  'image/tiff': stripTiff,
  'image/heic': stripHeic,
  'application/pdf': stripPdf,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': stripOffice,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': stripOffice,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': stripOffice,
};

// Each worker instance handles exactly one file and shuts itself down afterwards.
self.addEventListener(
  'message',
  (event: MessageEvent<WorkerInbound>) => {
    const { id, buffer, mime } = event.data;
    run(id, buffer, mime).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      post({ type: 'ERROR', id, code: 'INTERNAL', message });
      self.close();
    });
  },
  { once: true },
);

async function run(id: string, buffer: ArrayBuffer, mime: SupportedMime): Promise<void> {
  const processor = PROCESSORS[mime];

  if (!processor) {
    post({ type: 'ERROR', id, code: 'UNSUPPORTED_FORMAT', message: `No processor for: ${mime}` });
    self.close();
    return;
  }

  post({ type: 'PROGRESS', id, percent: 5 });

  // Capture size before processor may transfer the buffer to WASM (which detaches it).
  const originalSize = buffer.byteLength;

  try {
    const { clean, before, after } = await processor(buffer);

    post({ type: 'PROGRESS', id, percent: 100 });

    const done: WorkerOutbound = {
      type: 'DONE',
      id,
      cleanBuffer: clean,
      report: { before, after, originalSize, cleanSize: clean.byteLength },
    };
    // Transfer clean buffer back — zero-copy, buffer detaches after postMessage.
    self.postMessage(done, { transfer: [clean] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'ERROR', id, code: 'PROCESSOR_ERROR', message });
  } finally {
    // self.close() marks the worker for termination; queued messages are flushed first.
    self.close();
  }
}

function post(msg: WorkerOutbound): void {
  self.postMessage(msg);
}

export {};
