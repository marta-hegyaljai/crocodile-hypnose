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
  isActivityEvent,
  isMoodEntry,
  type ActivityEvent,
  type EventLogDoc,
  type MoodEntry,
} from '@/services/events/types';
import { mergeProgress } from '@/services/progress/mergeProgress';
import { defaultProgress, isProgressDoc, type ProgressDoc } from '@/services/progress/types';

import { createDocumentStore, type DocumentState } from './documentStore';
import { mergeOnboarding } from './mergeOnboarding';
import { mergeSettings, settingsStamps, stampSettings, upgradeSettings } from './mergeSettings';
import type { ProfileClient, StreamKind, StreamTypes } from './profileClient';
import {
  defaultOnboarding,
  defaultSettings,
  isAnySettingsDoc,
  isOnboardingDoc,
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
  /** "Session completed" and "game completed" events (the input of the points ledger). */
  sessions: EventLogDoc<ActivityEvent>;
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
  /** Records a finished session or game once (an id already recorded changes nothing). */
  recordSession(event: ActivityEvent): Promise<void>;
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
  /**
   * Reads every document again and merges it, for when the user comes back to the app (another
   * device may have moved on). Quiet when the server cannot be reached.
   */
  refetch(): Promise<void>;
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
    // A device copy from before settings v2 is read and upgraded.
    validate: (value): value is SettingsDoc => isAnySettingsDoc(value),
    upgrade: upgradeSettings,
    fetch: () => withToken((token) => client.get('settings', token)),
    push: (_user, doc) => withToken((token) => client.put('settings', doc, token)),
    // Field by field, on the device and on the server: a change touches only its own fields.
    merge: mergeSettings,
    stamp: stampSettings,
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
        pushLog(
          doc,
          (items) => withToken((token) => client.appendEvents(stream, items, token)),
          isRefused,
        ),
      merge: mergeLogs,
      now,
      debounceMs,
      retryMs,
    });
  const sessions = eventLog('events', SESSIONS_KEY, isActivityEvent);
  const moods = eventLog('mood', MOODS_KEY, isMoodEntry);
  const docs = [onboarding, settings, progress, sessions, moods] as const;
  let generation = 0;
  /** The mood consent the settings last showed for this user (null until they are known). */
  let lastConsent: boolean | null = null;

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
        settingsKnown: s.seeded,
        progress: p.doc,
        dirty: o.dirty || s.dirty || p.dirty || e.dirty || m.dirty,
        syncError: o.syncError ?? s.syncError ?? p.syncError ?? e.syncError ?? null,
        loadError: get().status === 'loading' ? (o.syncError ?? null) : null,
      });
    };
    /** Deletes the mood data this device holds: the check-ins and the onboarding moods. */
    const scrubMoods = () => {
      const m = moods.getState();
      if (Object.keys(m.doc.items).length > 0) void m.update(() => emptyLog());
      const o = onboarding.getState().doc;
      if (
        o.firstSession.moodBefore !== null ||
        o.firstSession.moodAfter !== null ||
        o.moodConsent === true
      ) {
        void onboarding.getState().update((doc) => ({
          ...doc,
          moodConsent: false,
          firstSession: { ...doc.firstSession, moodBefore: null, moodAfter: null },
        }));
      }
    };
    /**
     * Mood data exists only while the user agrees (health data). When the settings' consent goes
     * from on to off, whatever mood data this device holds goes: after a withdrawal here, on
     * another device or tab, or in a server copy that arrives late. Only on that change: the
     * settings merge field by field, so an older copy that says off never gets here by itself.
     */
    const enforceMoodConsent = () => {
      const s = settings.getState();
      if (!s.seeded) return;
      const was = lastConsent;
      lastConsent = s.doc.moodConsent;
      if (s.doc.moodConsent) return;
      // From on to off; or the first time the choice is known and it is a withdrawal (not the
      // default): the app was closed between that write and the scrub, and the device still
      // holds the log. Checked on load too, once the mood log itself is in.
      if (was === true || (was === null && withdrawn() && moods.getState().status === 'ready')) {
        scrubMoods();
      }
    };
    /** The settings say the user withdrew mood consent (off, and decided at some point). */
    const withdrawn = () => {
      const s = settings.getState();
      return s.seeded && !s.doc.moodConsent && settingsStamps(s.doc).moodConsent > 0;
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
        lastConsent = null;
        set({ status: 'loading', userId, loadError: null });
        // The device copies first: with one, routing can proceed and the server check follows.
        await Promise.all(docs.map((d) => d.getState().load(userId, { fresh })));
        if (startedIn !== generation) return;
        // The consent on the device says off after a withdrawal: whatever the log still holds
        // goes (the app may have been closed before the scrub finished).
        if (withdrawn()) scrubMoods();
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
        // Shown and changed only once the user's own settings are in (never on the defaults).
        if (!settings.getState().seeded) return;
        await settings
          .getState()
          .update((doc) => (doc.moodConsent === enabled ? doc : { ...doc, moodConsent: enabled }));
        if (enabled) return;
        scrubMoods();
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

      async refetch() {
        if (get().status !== 'ready') return;
        // The mood log only exists with consent (the server holds none otherwise).
        const logs = settings.getState().doc.moodConsent ? [sessions, moods] : [sessions];
        await Promise.all(
          [onboarding, settings, progress, ...logs].map((d) => d.getState().refetch()),
        );
      },

      async reset() {
        generation += 1;
        lastConsent = null;
        await Promise.all(docs.map((d) => d.getState().reset()));
        set({ status: 'idle', userId: null, dirty: false, syncError: null, loadError: null });
      },
    };
  });

  return store;
}

/**
 * The server refused the events themselves: retrying them cannot help. Only an explicit
 * validation refusal counts. A rate limit, an unmapped 4xx (404, 409, 413, a new error code) or
 * a server error says nothing about the events, so they stay pending and are sent again.
 */
export function isRefused(error: unknown): boolean {
  return isAuthError(error) && error.code === 'invalid_request';
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
