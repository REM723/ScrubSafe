import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkerOutbound } from '@scrubsafe/shared-types';
import { dispatch, cancel, cancelAll, activeCount } from '$lib/workers/dispatcher';

// ── Mock Worker ───────────────────────────────────────────────────────────────

// Track every worker created in the current test so we can inspect and drive them.
let createdWorkers: MockWorker[] = [];

class MockWorker {
  terminate = vi.fn();
  postMessage = vi.fn();
  private listeners: Map<string, Array<(e: Event) => void>> = new Map();

  constructor(_url: string | URL, _opts?: WorkerOptions) {
    createdWorkers.push(this);
  }

  addEventListener(type: string, handler: (e: Event) => void): void {
    const bucket = this.listeners.get(type) ?? [];
    bucket.push(handler);
    this.listeners.set(type, bucket);
  }

  simulateMessage(data: WorkerOutbound): void {
    const event = new MessageEvent('message', { data });
    for (const h of this.listeners.get('message') ?? []) h(event);
  }

  simulateError(message: string): void {
    const event = new ErrorEvent('error', { message });
    for (const h of this.listeners.get('error') ?? []) h(event);
  }
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  createdWorkers = [];
  vi.stubGlobal('Worker', MockWorker);
  cancelAll(); // reset module-level active Map between tests
});

afterEach(() => {
  cancelAll();
  vi.unstubAllGlobals();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function lastWorker(): MockWorker {
  const w = createdWorkers[createdWorkers.length - 1];
  if (!w) throw new Error('No worker was created');
  return w;
}

const DONE_MSG = (id: string): WorkerOutbound => ({
  type: 'DONE',
  id,
  cleanBuffer: new ArrayBuffer(4),
  report: {
    before: { fields: [] },
    after:  { fields: [] },
    originalSize: 8,
    cleanSize: 4,
  },
});

const ERR_MSG = (id: string): WorkerOutbound => ({
  type: 'ERROR',
  id,
  code: 'PROCESSOR_ERROR',
  message: 'something went wrong',
});

// ── dispatch ──────────────────────────────────────────────────────────────────

describe('dispatch', () => {
  it('spawns a new Worker for each call', () => {
    dispatch('a', new ArrayBuffer(4), 'image/jpeg', vi.fn());
    dispatch('b', new ArrayBuffer(4), 'image/jpeg', vi.fn());
    expect(createdWorkers).toHaveLength(2);
    expect(createdWorkers[0]).not.toBe(createdWorkers[1]);
  });

  it('sends a SCRUB message with the correct id, mime, and transfer list', () => {
    const buffer = new ArrayBuffer(8);
    dispatch('id-1', buffer, 'image/png', vi.fn());

    const w = lastWorker();
    expect(w.postMessage).toHaveBeenCalledOnce();

    const [msg, opts] = w.postMessage.mock.calls[0]!;
    expect(msg).toMatchObject({ type: 'SCRUB', id: 'id-1', mime: 'image/png', buffer });
    expect(opts).toMatchObject({ transfer: [buffer] });
  });

  it('increments activeCount', () => {
    expect(activeCount()).toBe(0);
    dispatch('id-2', new ArrayBuffer(4), 'image/jpeg', vi.fn());
    expect(activeCount()).toBe(1);
    dispatch('id-3', new ArrayBuffer(4), 'image/jpeg', vi.fn());
    expect(activeCount()).toBe(2);
  });

  it('forwards PROGRESS messages to the callback unchanged', () => {
    const cb = vi.fn();
    dispatch('id-p', new ArrayBuffer(4), 'image/jpeg', cb);
    lastWorker().simulateMessage({ type: 'PROGRESS', id: 'id-p', percent: 42 });
    expect(cb).toHaveBeenCalledWith({ type: 'PROGRESS', id: 'id-p', percent: 42 });
  });

  it('forwards DONE messages and removes the job from active', () => {
    const cb = vi.fn();
    dispatch('id-d', new ArrayBuffer(4), 'image/jpeg', cb);
    lastWorker().simulateMessage(DONE_MSG('id-d'));

    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0]![0]).toMatchObject({ type: 'DONE', id: 'id-d' });
    expect(activeCount()).toBe(0);
  });

  it('calls terminate after DONE', () => {
    dispatch('id-dt', new ArrayBuffer(4), 'image/jpeg', vi.fn());
    const w = lastWorker();
    w.simulateMessage(DONE_MSG('id-dt'));
    expect(w.terminate).toHaveBeenCalledOnce();
  });

  it('forwards ERROR messages and removes the job from active', () => {
    const cb = vi.fn();
    dispatch('id-e', new ArrayBuffer(4), 'image/jpeg', cb);
    lastWorker().simulateMessage(ERR_MSG('id-e'));

    expect(cb).toHaveBeenCalledWith(ERR_MSG('id-e'));
    expect(activeCount()).toBe(0);
  });

  it('calls terminate after ERROR', () => {
    dispatch('id-et', new ArrayBuffer(4), 'image/jpeg', vi.fn());
    const w = lastWorker();
    w.simulateMessage(ERR_MSG('id-et'));
    expect(w.terminate).toHaveBeenCalledOnce();
  });

  it('converts worker crash (ErrorEvent) into an ERROR callback', () => {
    const cb = vi.fn();
    dispatch('id-crash', new ArrayBuffer(4), 'image/jpeg', cb);
    lastWorker().simulateError('Script error');

    expect(cb).toHaveBeenCalledOnce();
    const msg = cb.mock.calls[0]![0];
    expect(msg.type).toBe('ERROR');
    expect(msg.id).toBe('id-crash');
    expect(msg.code).toBe('WORKER_CRASH');
    expect(activeCount()).toBe(0);
  });

  it('does not call terminate after a PROGRESS message (job is still live)', () => {
    dispatch('id-live', new ArrayBuffer(4), 'image/jpeg', vi.fn());
    const w = lastWorker();
    w.simulateMessage({ type: 'PROGRESS', id: 'id-live', percent: 25 });
    expect(w.terminate).not.toHaveBeenCalled();
    expect(activeCount()).toBe(1);
  });
});

// ── cancel ────────────────────────────────────────────────────────────────────

describe('cancel', () => {
  it('terminates the worker for the given id', () => {
    dispatch('id-cx', new ArrayBuffer(4), 'image/jpeg', vi.fn());
    const w = lastWorker();
    cancel('id-cx');
    expect(w.terminate).toHaveBeenCalledOnce();
  });

  it('removes the job from active after cancellation', () => {
    dispatch('id-cy', new ArrayBuffer(4), 'image/jpeg', vi.fn());
    cancel('id-cy');
    expect(activeCount()).toBe(0);
  });

  it('does not invoke the callback when cancelled', () => {
    const cb = vi.fn();
    dispatch('id-cz', new ArrayBuffer(4), 'image/jpeg', cb);
    cancel('id-cz');
    expect(cb).not.toHaveBeenCalled();
  });

  it('is a no-op for an unknown id', () => {
    expect(() => cancel('does-not-exist')).not.toThrow();
  });

  it('only terminates the targeted worker when multiple are active', () => {
    dispatch('keep', new ArrayBuffer(4), 'image/jpeg', vi.fn());
    const keepWorker = lastWorker();
    dispatch('kill', new ArrayBuffer(4), 'image/jpeg', vi.fn());
    const killWorker = lastWorker();

    cancel('kill');

    expect(killWorker.terminate).toHaveBeenCalledOnce();
    expect(keepWorker.terminate).not.toHaveBeenCalled();
    expect(activeCount()).toBe(1);
  });
});

// ── cancelAll ─────────────────────────────────────────────────────────────────

describe('cancelAll', () => {
  it('terminates all active workers', () => {
    const ids = ['aa', 'bb', 'cc'];
    for (const id of ids) dispatch(id, new ArrayBuffer(4), 'image/jpeg', vi.fn());

    const workers = [...createdWorkers];
    cancelAll();

    for (const w of workers) expect(w.terminate).toHaveBeenCalledOnce();
  });

  it('clears the active map', () => {
    dispatch('x1', new ArrayBuffer(4), 'image/jpeg', vi.fn());
    dispatch('x2', new ArrayBuffer(4), 'image/jpeg', vi.fn());
    expect(activeCount()).toBe(2);
    cancelAll();
    expect(activeCount()).toBe(0);
  });

  it('is a no-op when no workers are active', () => {
    expect(() => cancelAll()).not.toThrow();
    expect(activeCount()).toBe(0);
  });
});
