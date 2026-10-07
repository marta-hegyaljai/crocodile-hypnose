import { createStore, type StoreApi } from 'zustand/vanilla';

import type { AuthStore } from '@/services/auth/authStore';
import type { SessionManager } from '@/services/auth/sessionManager';
import type { KeyValueStorage } from '@/services/auth/storage';
import { isAuthError } from '@/services/auth/types';

import {
  addToLog,
  confirmedLog,
  emptyLog,
  isEventLogDoc,
  mergeLogs,
  pushLog,
} from '@/services/events/eventLog';
import {
  isMoodEntry,
  isSessionCompletedEvent,
  type EventLogDoc,
  type MoodEntry,
  type SessionCompletedEvent,
} from '@/services/events/types';
import { mergeProgress } from '@/services/progress/mergeProgress';
import { defaultProgress, isProgressDoc, type ProgressDoc } from '@/services/progress/types';

import { createDocumentStore, type DocumentState } from './documentStore';
import { mergeOnboarding } from './mergeOnboarding';
import type { ProfileClient, StreamKind, StreamTypes } from './profileClient';
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
  /**
   * The settings are the user's own (a device copy or the server's), not the defaults standing in
   * while they load. Until then, safety choices must come from the onboarding answers.
   */
  settingsKnown: boolean;
  /** Progress along the river (started and finished stops). */
  progress: ProgressDoc;
  /** "Session completed" events (the input of the points ledger). */
  sessions: EventLogDoc<SessionCompletedEvent>;
  /** Mood check-ins; only recorded with consent (health data). */
  moods: EventLogDoc<MoodEntry>;
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
  /** Applies a progress change (see `markStarted` / `markDone`); returning the same doc is a no-op. */
  updateProgress(change: (doc: ProgressDoc) => ProgressDoc): Promise<void>;
  /** Records a finished session once (an id already recorded changes nothing). */
  recordSession(event: SessionCompletedEvent): Promise<void>;
  /** Records a mood check-in once. The caller checks consent. */
  recordMood(entry: MoodEntry): Promise<void>;
  /**
   * Turns mood consent on or off. Off deletes every mood entry: on the device (pending ones
   * included), in the onboarding answers, and on the server.
   */
  setMoodConsent(enabled: boolean): Promise<void>;
  /** The server's copy of everything stored about the user, as JSON text (pending changes sent first). */
  exportData(): Promise<string>;
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
export const PROGRESS_KEY = 'mhp.hypnose.progress.v1';
export const SESSIONS_KEY = 'mhp.hypnose.sessions.v1';
export const MOODS_KEY = 'mhp.hypnose.moods.v1';

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
  // Progress merges per stop (finished never regresses), on the device and on the server.
  const progress = createDocumentStore<ProgressDoc>({
    key: PROGRESS_KEY,
    storage,
    defaults: () => defaultProgress(),
    validate: isProgressDoc,
    fetch: () => withToken((token) => client.get('progress', token)),
    push: (_user, doc) => withToken((token) => client.put('progress', doc, token)),
    merge: mergeProgress,
    now,
    debounceMs,
    retryMs,
  });
  // Append-only streams, synced as logs: union by id, unconfirmed events are sent until stored.
  const eventLog = <S extends StreamKind>(
    stream: S,
    key: string,
    validateItem: (value: unknown) => value is StreamTypes[S],
  ) =>
    createDocumentStore<EventLogDoc<StreamTypes[S]>>({
      key,
      storage,
      defaults: () => emptyLog(),
      validate: isEventLogDoc(validateItem),
      fetch: async () => confirmedLog(await withToken((token) => client.listEvents(stream, token))),
      push: (_user, doc) =>
        pushLog(doc, (items) => withToken((token) => client.appendEvents(stream, items, token))),
      merge: mergeLogs,
      now,
      debounceMs,
      retryMs,
    });
  const sessions = eventLog('events', SESSIONS_KEY, isSessionCompletedEvent);
  const moods = eventLog('mood', MOODS_KEY, isMoodEntry);
  const docs = [onboarding, settings, progress, sessions, moods] as const;
  let generation = 0;

  const store = createStore<ProfileState>()((set, get) => {
    const mirror = () => {
      const o = onboarding.getState();
      const s = settings.getState();
      const p = progress.getState();
      const e = sessions.getState();
      const m = moods.getState();
      set({
        sessions: e.doc,
        moods: m.doc,
        onboarding: o.doc,
        settings: s.doc,
        settingsKnown: s.source !== 'none',
        progress: p.doc,
        dirty: o.dirty || s.dirty || p.dirty || e.dirty || m.dirty,
        syncError: o.syncError ?? s.syncError ?? p.syncError ?? e.syncError ?? null,
        loadError: get().status === 'loading' ? (o.syncError ?? null) : null,
      });
    };
    /**
     * Mood data exists only while the user agrees (health data). Whenever the settings say no,
     * whatever mood data this device holds goes: after a withdrawal here, on another device or tab,
     * or from a server copy that arrives late.
     */
    const enforceMoodConsent = () => {
      const s = settings.getState();
      if (s.source === 'none' || s.doc.moodConsent) return;
      const m = moods.getState();
      if (Object.keys(m.doc.items).length > 0) void m.update(() => emptyLog());
      const o = onboarding.getState().doc;
      if (o.firstSession.moodBefore !== null || o.firstSession.moodAfter !== null) {
        void onboarding.getState().update((doc) => ({
          ...doc,
          firstSession: { ...doc.firstSession, moodBefore: null, moodAfter: null },
        }));
      }
    };
    const onChange = () => {
      enforceMoodConsent();
      mirror();
    };
    onboarding.subscribe(onChange);
    settings.subscribe(onChange);
    progress.subscribe(mirror);
    sessions.subscribe(mirror);
    moods.subscribe(onChange);

    return {
      status: 'idle',
      userId: null,
      onboarding: defaultOnboarding(),
      settings: defaultSettings(),
      settingsKnown: false,
      progress: defaultProgress(),
      sessions: emptyLog(),
      moods: emptyLog(),
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
      updateProgress: (change) => progress.getState().update(change),
      recordSession: (event) => sessions.getState().update((doc) => addToLog(doc, event)),
      recordMood: (entry) => moods.getState().update((doc) => addToLog(doc, entry)),

      async setMoodConsent(enabled) {
        await settings
          .getState()
          .update((doc) => (doc.moodConsent === enabled ? doc : { ...doc, moodConsent: enabled }));
        if (enabled) return;
        // The settings reach the server first (it purges mood data when it stores them), then the
        // explicit delete. A later "on" must not be undone by a late delete, hence the check.
        await settings.getState().flush();
        if (settings.getState().doc.moodConsent) return;
        try {
          await withToken((token) => client.deleteMood(token));
        } catch {
          // Offline: the settings write above (retried) makes the server purge it.
        }
      },

      async exportData() {
        await get().flush();
        const data = await withToken((token) => client.exportData(token));
        return JSON.stringify(data, null, 2);
      },

      async flush() {
        // The documents first: the server checks mood consent against the stored settings.
        await Promise.all(
          [onboarding, settings, progress, sessions].map((d) => d.getState().flush()),
        );
        await moods.getState().flush();
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
