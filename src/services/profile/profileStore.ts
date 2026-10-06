import { createStore, type StoreApi } from 'zustand/vanilla';

import type { AuthStore } from '@/services/auth/authStore';
import type { SessionManager } from '@/services/auth/sessionManager';
import type { KeyValueStorage } from '@/services/auth/storage';
import { isAuthError } from '@/services/auth/types';

import { createDocumentStore, type DocumentState } from './documentStore';
import { mergeOnboarding } from './mergeOnboarding';
import type { ProfileClient } from './profileClient';
import {
  defaultOnboarding,
  defaultSettings,
  isOnboardingDoc,
  isSettingsDoc,
  type OnboardingDoc,
  type SettingsDoc,
} from './types';

export type ProfileStatus = 'idle' | 'loading' | 'ready';

export interface ProfileState {
  /**
   * `ready` once the documents for the signed-in user can be trusted for routing: the device copy
   * is in, and, when the device had nothing, the server has answered (or the wait ran out).
   */
  status: ProfileStatus;
  userId: string | null;
  onboarding: OnboardingDoc;
  settings: SettingsDoc;
  /** Any document has a change the server has not confirmed. */
  dirty: boolean;
  /** The last sync failure, if the latest attempt failed. */
  syncError: unknown;
  /** While `loading` on a device without a copy: the server could not be reached yet. */
  loadError: unknown;

  /** Loads both documents for a user. `fresh` for a brand-new account (nothing on the server). */
  load(userId: string, options?: { fresh?: boolean }): Promise<void>;
  updateOnboarding(change: (doc: OnboardingDoc) => OnboardingDoc): Promise<void>;
  updateSettings(change: (doc: SettingsDoc) => SettingsDoc): Promise<void>;
  /** Asks the server now: pending reads first, then pending writes (e.g. when back online). */
  flush(): Promise<void>;
  /** Forgets everything, including the device copies (they hold health data). */
  reset(): Promise<void>;
}

export type ProfileStore = StoreApi<ProfileState>;

export interface ProfileStoreOptions {
  client: ProfileClient;
  session: SessionManager;
  storage: KeyValueStorage;
  now?: () => number;
  debounceMs?: number;
  retryMs?: { first: number; max: number };
}

export const ONBOARDING_KEY = 'mhp.hypnose.onboarding.v1';
export const SETTINGS_KEY = 'mhp.hypnose.settings.v1';

/**
 * The signed-in user's documents, as one store for screens. Each document is its own synced
 * store underneath; this one combines their state and drives their lifecycle.
 */
export function createProfileStore({
  client,
  session,
  storage,
  now = Date.now,
  debounceMs,
  retryMs,
}: ProfileStoreOptions): ProfileStore {
  const withToken = <T>(fn: (token: string) => Promise<T>) => session.withAccessToken(fn);
  const onboarding = createDocumentStore<OnboardingDoc>({
    key: ONBOARDING_KEY,
    storage,
    defaults: () => defaultOnboarding(),
    validate: isOnboardingDoc,
    fetch: () => withToken((token) => client.get('onboarding', token)),
    push: (_user, doc) => withToken((token) => client.put('onboarding', doc, token)),
    merge: mergeOnboarding,
    now,
    debounceMs,
    retryMs,
  });
  const settings = createDocumentStore<SettingsDoc>({
    key: SETTINGS_KEY,
    storage,
    defaults: () => defaultSettings(),
    validate: isSettingsDoc,
    fetch: () => withToken((token) => client.get('settings', token)),
    push: (_user, doc) => withToken((token) => client.put('settings', doc, token)),
    now,
    debounceMs,
    retryMs,
  });
  const docs = [onboarding, settings] as const;
  let generation = 0;

  const store = createStore<ProfileState>()((set, get) => {
    const mirror = () => {
      const o = onboarding.getState();
      const s = settings.getState();
      set({
        onboarding: o.doc,
        settings: s.doc,
        dirty: o.dirty || s.dirty,
        syncError: o.syncError ?? s.syncError ?? null,
        loadError: get().status === 'loading' ? (o.syncError ?? null) : null,
      });
    };
    onboarding.subscribe(mirror);
    settings.subscribe(mirror);

    return {
      status: 'idle',
      userId: null,
      onboarding: defaultOnboarding(),
      settings: defaultSettings(),
      dirty: false,
      syncError: null,
      loadError: null,

      async load(userId, { fresh = false } = {}) {
        generation += 1;
        const startedIn = generation;
        set({ status: 'loading', userId, loadError: null });
        // The device copies first: with one, routing can proceed and the server check follows.
        await Promise.all(docs.map((d) => d.getState().load(userId, { fresh })));
        if (startedIn !== generation) return;
        const hasLocal = onboarding.getState().source !== 'none';
        if (!fresh && !hasLocal) {
          // A new device (or cleared storage): the server's copy decides where the user is. The
          // document store keeps asking; the app shows a loading state with a retry meanwhile.
          await waitFor(() => onboarding.getState().serverKnown, onboarding);
          if (startedIn !== generation) return;
        }
        set({ status: 'ready', loadError: null });
      },

      updateOnboarding: (change) => onboarding.getState().update(change),
      updateSettings: (change) => settings.getState().update(change),

      async flush() {
        await Promise.all(docs.map((d) => d.getState().flush()));
      },

      async reset() {
        generation += 1;
        await Promise.all(docs.map((d) => d.getState().reset()));
        set({ status: 'idle', userId: null, dirty: false, syncError: null, loadError: null });
      },
    };
  });

  return store;
}

function waitFor<T>(
  predicate: () => boolean,
  source: StoreApi<DocumentState<T & { version: number; updatedAt: number }>>,
): Promise<void> {
  if (predicate()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = source.subscribe(() => {
      if (!predicate()) return;
      unsubscribe();
      resolve();
    });
  });
}

/**
 * Keeps the profile in step with the account: loads it on sign-in (fresh after a sign-up),
 * forgets it on sign-out, and retries pending writes when the user comes back to the app.
 */
export function followAuth(profile: ProfileStore, auth: AuthStore): () => void {
  let current: string | null = null;
  const apply = () => {
    const state = auth.getState();
    const userId = state.status === 'signedIn' ? (state.user?.id ?? null) : null;
    if (userId === current) return;
    current = userId;
    if (userId) void profile.getState().load(userId, { fresh: state.justSignedUp });
    else void profile.getState().reset();
  };
  apply();
  return auth.subscribe(apply);
}

/** True for errors worth telling the user about (not plain connectivity). */
export function isSyncProblem(error: unknown): boolean {
  return (
    !!error && !(isAuthError(error) && (error.isConnectivity || error.code === 'session_ended'))
  );
}
