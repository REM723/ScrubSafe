import type { WorkerInbound, WorkerOutbound, SupportedMime } from '@scrubsafe/shared-types';

export type WorkerCallback = (msg: WorkerOutbound) => void;

interface ActiveJob {
  worker: Worker;
  callback: WorkerCallback;
}

// id → active worker for each in-flight scrub job.
const active = new Map<string, ActiveJob>();

/**
 * Spawn a dedicated Worker for one file.
 * The ArrayBuffer is transferred to the worker (zero-copy); do not read it after calling this.
 * `callback` is invoked for every PROGRESS, DONE, and ERROR message the worker emits.
 */
export function dispatch(
  id: string,
  buffer: ArrayBuffer,
  mime: SupportedMime,
  callback: WorkerCallback,
): void {
  const worker = new Worker(new URL('./scrub.worker.ts', import.meta.url), { type: 'module' });

  active.set(id, { worker, callback });

  worker.addEventListener('message', (event: MessageEvent<WorkerOutbound>) => {
    const msg = event.data;
    callback(msg);
    if (msg.type === 'DONE' || msg.type === 'ERROR') {
      active.delete(id);
      // Worker already called self.close(); terminate() is safe to call redundantly.
      worker.terminate();
    }
  });

  worker.addEventListener('error', (e: ErrorEvent) => {
    active.delete(id);
    callback({
      type: 'ERROR',
      id,
      code: 'WORKER_CRASH',
      message: e.message || 'Worker crashed unexpectedly',
    });
  });

  const msg: WorkerInbound = { type: 'SCRUB', id, buffer, mime };
  worker.postMessage(msg, { transfer: [buffer] });
}

/**
 * Immediately terminate the worker for a single job.
 * No DONE or ERROR message will be emitted after this call.
 */
export function cancel(id: string): void {
  const job = active.get(id);
  if (job) {
    job.worker.terminate();
    active.delete(id);
  }
}

/** Terminate all active workers. Call on component unmount to prevent leaks. */
export function cancelAll(): void {
  for (const { worker } of active.values()) {
    worker.terminate();
  }
  active.clear();
}

/** Number of workers currently running. Useful for UI state. */
export function activeCount(): number {
  return active.size;
}
