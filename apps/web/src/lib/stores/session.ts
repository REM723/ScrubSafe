import { writable } from 'svelte/store';

export interface User {
  id: string;
  email: string;
  plan: 'free' | 'pro';
}

function createSessionStore() {
  const { subscribe, set } = writable<User | null>(null);

  return {
    subscribe,
    set,
    logout() {
      set(null);
    },
  };
}

export const session = createSessionStore();
