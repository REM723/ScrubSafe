import { writable } from 'svelte/store';
import type { ToastMessage } from '$lib/types';

const DEFAULT_DURATION_MS = 5000;

function createToastStore() {
  const { subscribe, update } = writable<ToastMessage[]>([]);

  function dismiss(id: string): void {
    update((list) => list.filter((t) => t.id !== id));
  }

  function add(partial: Omit<ToastMessage, 'id'>): string {
    const id = crypto.randomUUID();
    const duration = partial.duration ?? DEFAULT_DURATION_MS;
    const toast: ToastMessage = { ...partial, id, duration };

    update((list) => [...list, toast]);

    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }

    return id;
  }

  return {
    subscribe,
    add,
    dismiss,

    error(message: string, duration?: number): string {
      return add({ type: 'error', message, ...(duration !== undefined && { duration }) });
    },

    success(message: string, duration?: number): string {
      return add({ type: 'success', message, ...(duration !== undefined && { duration }) });
    },

    info(message: string, duration?: number): string {
      return add({ type: 'info', message, ...(duration !== undefined && { duration }) });
    },
  };
}

export const toasts = createToastStore();
