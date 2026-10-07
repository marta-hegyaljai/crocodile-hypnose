import { createStore, type StoreApi } from 'zustand/vanilla';

import type { KeyValueStorage } from '@/services/auth/storage';
import { isAuthError } from '@/services/auth/types';

import type { SyncedDocument } from './types';

export type DocumentStatus = 'idle' | 'loading' | 'ready';

export interface DocumentState<T extends SyncedDocument> {
  status: DocumentStatus;
  /** The user the document belongs to; null when nobody is signed in. */
  userId: string | null;
  /** The current document: what was stored locally or on the server, or the defaults. */
  doc: T;
  /** Where `doc` came from on load: nothing stored anywhere, the device, or the server. */
  source: 'none' | 'local' | 'server';
  /** A local change the server has not confirmed yet. */
  dirty: boolean;
  syncing: boolean;
  /** The last sync failure (connectivity, typically). Cleared when a sync succeeds. */
  syncError: unknown;
  /**
   * The server's copy has been seen for this user (a successful read, or a brand-new account).
   * Until then nothing is pushed: a document whose server base was never seen could overwrite
   * what another device finished.
   */
  serverKnown: boolean;
  /** The server refused the document itself (not a connectivity problem); retrying cannot help. */
  rejected: boolean;
  /**
   * `doc` rests on a stored copy (the device's, the server's or another tab's), not only on the
   * defaults: what it shows is the user's own.
   */
  seeded: boolean;

  /**
   * Switches to `userId`: reads the device copy, then asks the server (retrying with a backoff
   * until it answers) and merges. Resolves when the device copy is in. With `fresh`, the server is
   * not asked (a brand-new account has nothing there).
   */
  load(userId: string, options?: { fresh?: boolean }): Promise<void>;
  /** Applies a change: stamps `updatedAt`, persists on the device, schedules a server write. */
  update(change: (doc: T) => T): Promise<void>;
  /** Asks the server now: the pending read if there is one, else a pending write. Never throws. */
  flush(): Promise<void>;
  /** Forgets the document (and the device copy) when the user signs out. */
  reset(options?: { keepLocal?: boolean }): Promise<void>;
}

export interface DocumentStoreOptions<T extends SyncedDocument> {
  /** Device storage key prefix; the user id is appended. */
  key: string;
  storage: KeyValueStorage;
  defaults: () => T;
  validate: (value: unknown) => value is T;
  /** Reads the document from the server; null when it has none. */
  fetch: (userId: string) => Promise<T | null>;
  /** Writes to the server; resolves what is stored afterwards (possibly a newer document). */
  push: (userId: string, doc: T) => Promise<T>;
  /** How two copies combine (default: the later `updatedAt` wins, the local copy on a tie). */
  merge?: (local: T, remote: T) => T;
  /**
   * Stamps a local change made at `at` (default: `updatedAt` only). Returning `prev` means the
   * change changed nothing.
   */
  stamp?: (prev: T, next: T, at: number) => T;
  now?: () => number;
  /** How long after a change the server write starts (changes within it coalesce). */
  debounceMs?: number;
  /** Backoff for a failed server read: first wait, doubled each time, capped. */
  retryMs?: { first: number; max: number };
}

/** Last write wins; on a tie the local copy stays (it is what the user sees). */
export function newerOf<T extends SyncedDocument>(local: T | null, remote: T | null): T | null {
  if (!local) return remote;
  if (!remote) return local;
  return remote.updatedAt > local.updatedAt ? remote : local;
}

/** JSON with object keys sorted, so two copies built in a different key order compare equal. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : v,
  );
}

/**
 * Equal apart from the timestamps: the server may clamp `updatedAt` and the per-field stamps to
 * its own clock (a client clock that runs ahead), so a clamped answer is still the same content.
 * Comparing the stamps would never settle: every push is clamped anew.
 */
function sameContent<T extends SyncedDocument>(a: T, b: T): boolean {
  return stableJson(withoutStamps(a)) === stableJson(withoutStamps(b));
}

function withoutStamps<T extends SyncedDocument>(doc: T): Record<string, unknown> {
  const { updatedAt: _updatedAt, fieldsAt: _fieldsAt, ...rest } = doc as T & { fieldsAt?: unknown };
  return rest;
}

/** A server answer that means the document itself was refused, so a retry cannot help. */
function isRejection(err: unknown): boolean {
  return isAuthError(err) && (err.code === 'invalid_request' || err.code === 'unknown');
}

/**
 * One synced JSON document per user: offline-first (the device copy is the working copy), merged
 * against the server's copy with `merge`. Changes are persisted locally at once and pushed shortly
 * after; a failed push stays `dirty` and is retried on the next change, the next load, an explicit
 * flush, or when the app is back online. Another tab of the same browser that writes the device
 * copy is followed too.
 */
export function createDocumentStore<T extends SyncedDocument>(
  options: DocumentStoreOptions<T>,
): StoreApi<DocumentState<T>> {
  const { key, storage, defaults, validate, fetch, push } = options;
  const merge = options.merge ?? ((local: T, remote: T) => newerOf(local, remote) ?? local);
  const stamp = options.stamp;
  const now = options.now ?? Date.now;
  const debounceMs = options.debounceMs ?? 250;
  const retryMs = options.retryMs ?? { first: 1000, max: 30_000 };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryWait = retryMs.first;
  // Bumped on every load/reset so late answers for another user (or a signed-out one) are dropped.
  let generation = 0;
  let pushing: Promise<void> | null = null;
  let reading: Promise<void> | null = null;
  let unsubscribeStorage: (() => void) | null = null;

  const storageKey = (userId: string) => `${key}.${userId}`;

  const parse = (raw: string | null): T | null => {
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return validate(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  async function readLocal(userId: string): Promise<T | null> {
    try {
      return parse(await storage.getItem(storageKey(userId)));
    } catch {
      return null;
    }
  }

  async function writeLocal(userId: string, doc: T): Promise<void> {
    try {
      await storage.setItem(storageKey(userId), JSON.stringify(doc));
    } catch (err) {
      if (__DEV__) console.warn(`[profile] could not store ${key} on the device`, err);
    }
  }

  function clearTimers() {
    if (timer) clearTimeout(timer);
    if (retryTimer) clearTimeout(retryTimer);
    timer = null;
    retryTimer = null;
    retryWait = retryMs.first;
  }

  const store = createStore<DocumentState<T>>()((set, get) => {
    function schedulePush() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void get().flush();
      }, debounceMs);
    }

    /** Takes in a copy from elsewhere (the server, another tab) by merging it with ours. */
    async function adopt(userId: string, remote: T, source: 'server' | 'local') {
      const state = get();
      const local = state.source === 'none' && !state.dirty ? null : state.doc;
      const merged = local ? merge(local, remote) : remote;
      if (!state.seeded) set({ seeded: true });
      if (local && sameContent(merged, local)) {
        // Ours is what counts; the server catches up if it has something else.
        if (source === 'server' && !sameContent(remote, local)) {
          set({ dirty: true });
          schedulePush();
        }
        return;
      }
      // The merge may carry local facts the other side lacks: then it is a new write.
      const dirty = !sameContent(merged, remote);
      set({ doc: merged, source, dirty, syncError: null, seeded: true });
      if (source === 'server' || dirty) await writeLocal(userId, merged);
      if (dirty) schedulePush();
    }

    function readServer(userId: string, startedIn: number): Promise<void> {
      if (reading) return reading;
      reading = (async () => {
        let remote: T | null = null;
        try {
          remote = await fetch(userId);
        } catch (err) {
          if (startedIn !== generation) return;
          set({ syncError: err });
          if (__DEV__ && !(isAuthError(err) && err.isConnectivity)) {
            console.warn(`[profile] could not read ${key} from the server`, err);
          }
          // Keep asking: without the server's copy nothing may be pushed.
          retryTimer = setTimeout(() => {
            retryTimer = null;
            if (startedIn === generation) void readServer(userId, startedIn);
          }, retryWait);
          retryWait = Math.min(retryWait * 2, retryMs.max);
          return;
        }
        if (startedIn !== generation) return;
        retryWait = retryMs.first;
        set({ serverKnown: true, seeded: true, syncError: null });
        if (remote) await adopt(userId, remote, 'server');
        else if (get().source === 'local') set({ dirty: true });
        if (get().dirty) await get().flush();
      })().finally(() => {
        reading = null;
      });
      return reading;
    }

    function followOtherTabs(userId: string, startedIn: number) {
      unsubscribeStorage?.();
      unsubscribeStorage =
        storage.subscribe?.(storageKey(userId), (raw) => {
          if (startedIn !== generation) return;
          const other = parse(raw);
          if (other) void adopt(userId, other, 'local');
        }) ?? null;
    }

    return {
      status: 'idle',
      userId: null,
      doc: defaults(),
      source: 'none',
      dirty: false,
      syncing: false,
      syncError: null,
      serverKnown: false,
      rejected: false,
      seeded: false,

      async load(userId, { fresh = false } = {}) {
        generation += 1;
        const startedIn = generation;
        clearTimers();
        set({
          status: 'loading',
          userId,
          doc: defaults(),
          source: 'none',
          dirty: false,
          syncing: false,
          syncError: null,
          serverKnown: fresh,
          rejected: false,
          seeded: fresh,
        });
        const local = await readLocal(userId);
        if (startedIn !== generation) return;
        set({
          status: 'ready',
          doc: local ?? defaults(),
          source: local ? 'local' : 'none',
          seeded: fresh || !!local,
        });
        followOtherTabs(userId, startedIn);
        if (fresh) return;
        void readServer(userId, startedIn);
      },

      async update(change) {
        const { userId, doc } = get();
        if (!userId) return;
        const changed = change(doc);
        // Nothing to write (e.g. finishing a stop that is already finished).
        if (changed === doc) return;
        const at = Math.max(now(), doc.updatedAt + 1);
        const next = stamp ? stamp(doc, changed, at) : { ...changed, updatedAt: at };
        if (next === doc) return;
        set({
          doc: next,
          dirty: true,
          rejected: false,
          source: get().source === 'none' ? 'local' : get().source,
        });
        await writeLocal(userId, next);
        schedulePush();
      },

      async flush() {
        const { userId, dirty, serverKnown, rejected } = get();
        if (!userId) return;
        if (!serverKnown) {
          // The read comes first (now, not after the backoff); it pushes when it succeeds.
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = null;
          return readServer(userId, generation);
        }
        if (pushing) return pushing;
        if (!dirty || rejected) return;
        const startedIn = generation;
        pushing = (async () => {
          const sent = get().doc;
          set({ syncing: true });
          try {
            const stored = await push(userId, sent);
            if (startedIn !== generation) return;
            if (get().doc !== sent) {
              // Changed again while the write was in flight: push once more.
              set({ syncError: null });
              schedulePush();
            } else if (!sameContent(stored, sent)) {
              // The server kept or merged something of its own (another device): take it in.
              set({ dirty: false, syncError: null });
              await adopt(userId, stored, 'server');
            } else {
              set({ dirty: false, syncError: null });
            }
          } catch (err) {
            if (startedIn !== generation) return;
            set({ syncError: err, rejected: isRejection(err) });
            if (__DEV__ && !(isAuthError(err) && err.isConnectivity)) {
              console.warn(`[profile] could not write ${key} to the server`, err);
            }
          } finally {
            if (startedIn === generation) set({ syncing: false });
            pushing = null;
          }
        })();
        return pushing;
      },

      async reset({ keepLocal = false } = {}) {
        generation += 1;
        clearTimers();
        unsubscribeStorage?.();
        unsubscribeStorage = null;
        const { userId } = get();
        set({
          status: 'idle',
          userId: null,
          doc: defaults(),
          source: 'none',
          dirty: false,
          syncing: false,
          syncError: null,
          serverKnown: false,
          rejected: false,
          seeded: false,
        });
        if (userId && !keepLocal)
          await storage.removeItem(storageKey(userId)).catch(() => undefined);
      },
    };
  });

  return store;
}
