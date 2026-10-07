import { createStore, type StoreApi } from 'zustand/vanilla';

import type { AuthStore } from '@/services/auth/authStore';
import type { SessionManager } from '@/services/auth/sessionManager';
import type { KeyValueStorage } from '@/services/auth/storage';
import { isAuthError } from '@/services/auth/types';
import { pendingOf } from '@/services/events/eventLog';
import { createDocumentStore } from '@/services/profile/documentStore';
import type { ProfileStore } from '@/services/profile/profileStore';

import { PurchaseRefused, type GamificationClient } from './client';
import { deviceTimeZone } from './derive';
import {
  clampWeeklyTarget,
  decorationById,
  defaultWeeklyTarget,
  SLOTS,
  stageIndex,
  type GrowthStage,
  type PointsSummary,
} from './shared/rules';
import {
  defaultGamification,
  defaultHabitat,
  emptySummary,
  isGamificationDoc,
  isHabitatDoc,
  isPointsSummary,
  mergeGamification,
  type GamificationDoc,
  type HabitatDoc,
} from './types';

export type PurchaseResult = 'ok' | 'insufficient' | 'locked' | 'offline' | 'error';

export interface GamificationState {
  userId: string | null;
  /** The server's points summary (or the device's copy of the last one). */
  summary: PointsSummary;
  /** `summary` is the user's (from the server or the device cache), not the empty stand-in. */
  summaryKnown: boolean;
  /** The weekly goal and what was celebrated. */
  goal: GamificationDoc;
  /** The goal document's server copy has been seen: growth moments may be decided. */
  goalSettled: boolean;
  habitat: HabitatDoc;
  /** The decoration being bought right now. */
  purchasing: string | null;

  load(userId: string, options?: { fresh?: boolean }): Promise<void>;
  /** Asks the server for the latest points summary. Never throws. */
  refresh(): Promise<void>;
  purchase(itemId: string): Promise<PurchaseResult>;
  /** Puts an owned decoration in the first free slot of its kind (or the first of its kind). */
  place(itemId: string): Promise<void>;
  /** Takes a decoration out of the scene (it stays owned). */
  remove(itemId: string): Promise<void>;
  setWeeklyTarget(target: number): Promise<void>;
  /** Moves the target by `delta` days from the current one (each tap of a stepper counts). */
  stepWeeklyTarget(delta: number): Promise<void>;
  markStageSeen(stage: GrowthStage): Promise<void>;
  markWeekCelebrated(week: number): Promise<void>;
  /** Retries everything pending (back online, app active). */
  flush(): Promise<void>;
  reset(): Promise<void>;
}

export type GamificationStore = StoreApi<GamificationState>;

export interface GamificationStoreOptions {
  client: GamificationClient;
  session: SessionManager;
  storage: KeyValueStorage;
  profile: ProfileStore;
  now?: () => number;
  debounceMs?: number;
  retryMs?: { first: number; max: number };
  timeZone?: () => string | null;
}

export const GAMIFICATION_KEY = 'mhp.hypnose.gamification.v1';
export const HABITAT_KEY = 'mhp.hypnose.habitat.v1';
export const POINTS_KEY = 'mhp.hypnose.points.v1';

/** Places an item in the slots: first free slot of its kind, else the first of its kind. */
export function placeIn(
  slots: Record<string, string | null>,
  itemId: string,
): Record<string, string | null> {
  const item = decorationById(itemId);
  if (!item || Object.values(slots).includes(itemId)) return slots;
  const fitting = SLOTS.filter((s) => s.kind === item.slot);
  const target = fitting.find((s) => !slots[s.id]) ?? fitting[0];
  return target ? { ...slots, [target.id]: itemId } : slots;
}

export function removeFrom(
  slots: Record<string, string | null>,
  itemId: string,
): Record<string, string | null> {
  if (!Object.values(slots).includes(itemId)) return slots;
  return Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, v === itemId ? null : v]));
}

/**
 * Points, growth, the habitat and the weekly goal for the signed-in user. The points come from
 * the server (`/me/points`), cached on the device; the goal and the placement are synced
 * documents (offline-first, like the profile's). Buying needs the server: it decides whether the
 * points are there.
 */
export function createGamificationStore({
  client,
  session,
  storage,
  profile,
  now = Date.now,
  debounceMs,
  retryMs,
  timeZone = deviceTimeZone,
}: GamificationStoreOptions): GamificationStore {
  const withToken = <T>(fn: (token: string) => Promise<T>) => session.withAccessToken(fn);
  const goal = createDocumentStore<GamificationDoc>({
    key: GAMIFICATION_KEY,
    storage,
    defaults: () => defaultGamification(),
    validate: isGamificationDoc,
    fetch: () => withToken((token) => client.getGoal(token)),
    push: (_user, doc) => withToken((token) => client.putGoal(doc, token)),
    merge: mergeGamification,
    now,
    debounceMs,
    retryMs,
  });
  const habitat = createDocumentStore<HabitatDoc>({
    key: HABITAT_KEY,
    storage,
    defaults: () => defaultHabitat(),
    validate: isHabitatDoc,
    fetch: () => withToken((token) => client.getHabitat(token)),
    push: (_user, doc) => withToken((token) => client.putHabitat(doc, token)),
    now,
    debounceMs,
    retryMs,
  });
  let generation = 0;
  let refreshing: Promise<void> | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  const cacheKey = (userId: string) => `${POINTS_KEY}.${userId}`;

  const store = createStore<GamificationState>()((set, get) => {
    const mirror = () => {
      const g = goal.getState();
      set({
        goal: g.doc,
        goalSettled: g.serverKnown && g.status === 'ready',
        habitat: habitat.getState().doc,
      });
      settleGoal();
    };
    goal.subscribe(mirror);
    habitat.subscribe(mirror);

    /** First goal for a new user (from the onboarding timing), and the device's time zone. */
    function settleGoal() {
      const g = goal.getState();
      const p = profile.getState();
      if (!g.userId || g.status !== 'ready' || !g.serverKnown || p.status !== 'ready') return;
      const zone = timeZone();
      if (g.source === 'none' && !g.dirty) {
        // Only once onboarding is done: its timing answer sets the starting target.
        if (!p.onboarding.completed) return;
        void g.update(() => ({
          ...defaultGamification(defaultWeeklyTarget(p.onboarding.sessionLength), zone),
          updatedAt: 0,
        }));
      } else if (zone && g.doc.timeZone !== zone) {
        void g.update((doc) => ({ ...doc, timeZone: zone }));
      }
    }

    function scheduleRefresh() {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void get().refresh();
      }, debounceMs ?? 300);
    }

    // When the device's events reach the server (or another device's arrive), the points change.
    let lastSessions = profile.getState().sessions;
    let lastReward = profile.getState().onboarding.rewardGranted;
    profile.subscribe((p) => {
      settleGoal();
      if (!get().userId || p.userId !== get().userId) return;
      const changed = p.sessions !== lastSessions || p.onboarding.rewardGranted !== lastReward;
      lastSessions = p.sessions;
      lastReward = p.onboarding.rewardGranted;
      if (changed && pendingOf(p.sessions).length === 0) scheduleRefresh();
    });

    return {
      userId: null,
      summary: emptySummary(),
      summaryKnown: false,
      goal: defaultGamification(),
      goalSettled: false,
      habitat: defaultHabitat(),
      purchasing: null,

      async load(userId, { fresh = false } = {}) {
        generation += 1;
        const startedIn = generation;
        set({ userId, summary: emptySummary(), summaryKnown: false, purchasing: null });
        await Promise.all([
          goal.getState().load(userId, { fresh }),
          habitat.getState().load(userId, { fresh }),
        ]);
        try {
          const raw = await storage.getItem(cacheKey(userId));
          const cached: unknown = raw ? JSON.parse(raw) : null;
          if (startedIn === generation && isPointsSummary(cached)) {
            set({ summary: cached, summaryKnown: true });
          }
        } catch {
          // No usable copy on the device: the server's answer fills it in.
        }
        if (startedIn !== generation) return;
        await get().refresh();
      },

      refresh() {
        const { userId } = get();
        if (!userId) return Promise.resolve();
        if (refreshing) return refreshing;
        const startedIn = generation;
        refreshing = (async () => {
          try {
            const summary = await withToken((token) => client.points(token));
            if (startedIn !== generation) return;
            set({ summary, summaryKnown: true });
            await storage.setItem(cacheKey(userId), JSON.stringify(summary)).catch(() => {});
          } catch (err) {
            if (__DEV__ && !(isAuthError(err) && err.isConnectivity)) {
              console.warn('[gamification] could not read the points', err);
            }
          }
        })().finally(() => {
          refreshing = null;
        });
        return refreshing;
      },

      async purchase(itemId) {
        const { userId, purchasing } = get();
        if (!userId || purchasing) return 'error';
        const startedIn = generation;
        set({ purchasing: itemId });
        try {
          const summary = await withToken((token) => client.purchase(itemId, token));
          if (startedIn !== generation) return 'error';
          set({ summary, summaryKnown: true });
          await storage.setItem(cacheKey(userId), JSON.stringify(summary)).catch(() => {});
          return 'ok';
        } catch (err) {
          if (err instanceof PurchaseRefused) {
            void get().refresh();
            return err.reason;
          }
          if (isAuthError(err) && err.isConnectivity) return 'offline';
          return 'error';
        } finally {
          if (startedIn === generation) set({ purchasing: null });
        }
      },

      async place(itemId) {
        if (!get().summary.owned.some((o) => o.itemId === itemId)) return;
        await habitat.getState().update((doc) => {
          const slots = placeIn(doc.slots, itemId);
          return slots === doc.slots ? doc : { ...doc, slots };
        });
      },

      async remove(itemId) {
        await habitat.getState().update((doc) => {
          const slots = removeFrom(doc.slots, itemId);
          return slots === doc.slots ? doc : { ...doc, slots };
        });
      },

      async setWeeklyTarget(target) {
        const next = clampWeeklyTarget(target);
        await goal
          .getState()
          .update((doc) => (doc.weeklyTarget === next ? doc : { ...doc, weeklyTarget: next }));
        // A lower target may complete this week's goal: the server pays it on the next read.
        scheduleRefresh();
      },

      async stepWeeklyTarget(delta) {
        await goal.getState().update((doc) => {
          const next = clampWeeklyTarget(doc.weeklyTarget + delta);
          return doc.weeklyTarget === next ? doc : { ...doc, weeklyTarget: next };
        });
        scheduleRefresh();
      },

      async markStageSeen(stage) {
        await goal
          .getState()
          .update((doc) =>
            stageIndex(stage) > stageIndex(doc.seenStage) ? { ...doc, seenStage: stage } : doc,
          );
      },

      async markWeekCelebrated(week) {
        await goal
          .getState()
          .update((doc) =>
            doc.celebratedWeek !== null && doc.celebratedWeek >= week
              ? doc
              : { ...doc, celebratedWeek: week },
          );
      },

      async flush() {
        await Promise.all([goal.getState().flush(), habitat.getState().flush(), get().refresh()]);
      },

      async reset() {
        generation += 1;
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = null;
        const { userId } = get();
        await Promise.all([goal.getState().reset(), habitat.getState().reset()]);
        if (userId) await storage.removeItem(cacheKey(userId)).catch(() => {});
        set({ userId: null, summary: emptySummary(), summaryKnown: false, purchasing: null });
      },
    };
  });

  return store;
}

/** Loads the user's gamification on sign-in (fresh after a sign-up) and forgets it on sign-out. */
export function followAuthForGamification(store: GamificationStore, auth: AuthStore): () => void {
  let current: string | null = null;
  const apply = () => {
    const state = auth.getState();
    const userId = state.status === 'signedIn' ? (state.user?.id ?? null) : null;
    if (userId === current) return;
    current = userId;
    if (userId) void store.getState().load(userId, { fresh: state.justSignedUp });
    else void store.getState().reset();
  };
  apply();
  return auth.subscribe(apply);
}
