import type { KeyValueStorage } from '@/services/auth/storage';

import type { Completion } from './completion';

/**
 * A finished session whose reward moment has not been seen yet. The points are already saved when
 * a session ends, so a reload (or a crash) between "done" and the reward screen would otherwise
 * lose the loudest moment. It is kept on this device per user, brought back when the same stop's
 * screen reopens (a reload), and forgotten when the user continues from the reward, starts
 * another run, or it has gone stale.
 */
export interface PendingReward {
  stopId: string;
  completion: Completion;
  /** Which moment to bring back: the after-mood check or the reward itself. */
  phase: 'moodAfter' | 'reward';
  savedAt: number;
}

export const PENDING_REWARD_KEY = 'mhp.hypnose.pendingReward.v1';
/** A reward not seen within this long is forgotten (the moment has passed). */
export const PENDING_REWARD_MAX_AGE_MS = 15 * 60_000;

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function isPendingReward(value: unknown): value is PendingReward {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.stopId !== 'string' || !isNumber(v.savedAt)) return false;
  if (v.phase !== 'moodAfter' && v.phase !== 'reward') return false;
  const c = v.completion as Partial<Completion> | undefined;
  if (!c || typeof c !== 'object') return false;
  const p = c.points;
  const e = c.event;
  return (
    !!p &&
    isNumber(p.base) &&
    isNumber(p.bonus) &&
    isNumber(p.total) &&
    !!e &&
    typeof e.id === 'string' &&
    e.stopId === v.stopId &&
    Array.isArray(c.unlocked) &&
    c.unlocked.every((id) => typeof id === 'string')
  );
}

export interface PendingRewardStore {
  save(userId: string, reward: PendingReward): Promise<void>;
  /** The reward waiting for this stop, if recent. */
  get(userId: string, stopId: string, now: number): Promise<PendingReward | null>;
  clear(userId: string): Promise<void>;
}

export function createPendingRewardStore(storage: KeyValueStorage): PendingRewardStore {
  const key = (userId: string) => `${PENDING_REWARD_KEY}.${userId}`;
  return {
    async save(userId, reward) {
      try {
        await storage.setItem(key(userId), JSON.stringify(reward));
      } catch {
        // A convenience; the session itself is not affected.
      }
    },
    async get(userId, stopId, now) {
      try {
        const raw = await storage.getItem(key(userId));
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (!isPendingReward(parsed) || parsed.stopId !== stopId) return null;
        if (now - parsed.savedAt >= PENDING_REWARD_MAX_AGE_MS || parsed.savedAt > now + 60_000) {
          return null;
        }
        return parsed;
      } catch {
        return null;
      }
    },
    async clear(userId) {
      try {
        await storage.removeItem(key(userId));
      } catch {
        // Nothing to do.
      }
    },
  };
}
