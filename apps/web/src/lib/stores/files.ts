import { writable, derived } from 'svelte/store';
import type { ScrubJob, MetadataReport } from '@scrubsafe/shared-types';

export interface FileEntry extends ScrubJob {
  progress: number;
  cleanUrl: string | null;
  report: MetadataReport | null;
  error: string | null;
}

function createFileStore() {
  const { subscribe, update, set } = writable<Map<string, FileEntry>>(new Map());

  return {
    subscribe,

    add(entry: FileEntry) {
      update((m) => new Map(m).set(entry.id, entry));
    },

    updateProgress(id: string, progress: number) {
      update((m) => {
        const map = new Map(m);
        const entry = map.get(id);
        if (entry) map.set(id, { ...entry, status: 'processing', progress });
        return map;
      });
    },

    markDone(id: string, cleanUrl: string, report: MetadataReport) {
      update((m) => {
        const map = new Map(m);
        const entry = map.get(id);
        if (entry) map.set(id, { ...entry, status: 'done', progress: 100, cleanUrl, report });
        return map;
      });
    },

    markError(id: string, error: string) {
      update((m) => {
        const map = new Map(m);
        const entry = map.get(id);
        if (entry) map.set(id, { ...entry, status: 'error', error });
        return map;
      });
    },

    revokeUrl(id: string) {
      update((m) => {
        const map = new Map(m);
        const entry = map.get(id);
        if (entry) map.set(id, { ...entry, cleanUrl: null });
        return map;
      });
    },

    remove(id: string) {
      update((m) => {
        const map = new Map(m);
        map.delete(id);
        return map;
      });
    },

    clear() {
      set(new Map());
    },
  };
}

export const fileStore = createFileStore();
export const fileList = derived(fileStore, ($store) => [...$store.values()]);
