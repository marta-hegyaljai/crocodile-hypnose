/**
 * Web fallback for token storage. Browsers have no keychain: the refresh token goes to
 * localStorage (so a reload keeps you signed in) and the access token never leaves memory.
 * When storage is blocked (private mode, disabled cookies) it falls back to memory, which keeps
 * the app working for the tab's lifetime. The native build uses secureStorage.native.ts.
 *
 * Production web would move the refresh token into an httpOnly cookie; the web build is a
 * QA/preview target today (see README).
 */
import type { KeyValueStorage } from './storage';

const memory = new Map<string, string>();

function local(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const secureStorage: KeyValueStorage = {
  async getItem(key) {
    try {
      const store = local();
      if (store) return store.getItem(key);
    } catch {
      // Fall through to memory.
    }
    return memory.get(key) ?? null;
  },
  async setItem(key, value) {
    memory.set(key, value);
    try {
      local()?.setItem(key, value);
    } catch {
      // Quota or blocked: memory keeps the session for this tab.
    }
  },
  async removeItem(key) {
    memory.delete(key);
    try {
      local()?.removeItem(key);
    } catch {
      // Nothing to remove.
    }
  },
  subscribe(key, listener) {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return () => undefined;
    }
    // Fired in every other tab of this origin when one tab writes or clears the key.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key && event.key !== null) return;
      const value = event.key === null ? null : event.newValue;
      if (value === null) memory.delete(key);
      else memory.set(key, value);
      listener(value);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  },
};
