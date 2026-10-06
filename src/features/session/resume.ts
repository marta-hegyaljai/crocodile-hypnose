import type { KeyValueStorage } from '@/services/auth/storage';

import { isCoverage, type Coverage } from './listening';

/**
 * Where an interrupted session stopped (the app was closed, a call came in, the user navigated
 * away), kept on this device per user and stop, so the next start can offer "resume or restart".
 * The completion id travels with it, so a resumed run finishes as the same completion.
 */
export interface ResumePoint {
  stopId: string;
  /** Seconds into the session. */
  position: number;
  /** What was listened to so far (see `listening.ts`). */
  coverage: Coverage;
  /** The id the completion event will carry. */
  runId: string;
  updatedAt: number;
}

export const RESUME_KEY = 'mhp.hypnose.playback.v1';
/** A place older than this is forgotten. */
export const RESUME_MAX_AGE_MS = 14 * 24 * 3600_000;
/** Too close to either end to be worth resuming. */
export const RESUME_MIN_SEC = 5;

export function isResumePoint(value: unknown): value is ResumePoint {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.stopId === 'string' &&
    typeof v.position === 'number' &&
    Number.isFinite(v.position) &&
    v.position >= 0 &&
    isCoverage(v.coverage) &&
    typeof v.runId === 'string' &&
    typeof v.updatedAt === 'number'
  );
}

/** Whether to offer resuming: far enough in, not at the end, and recent. */
export function canResume(point: ResumePoint | null, duration: number, now: number): boolean {
  return (
    !!point &&
    point.position >= RESUME_MIN_SEC &&
    point.position < duration - RESUME_MIN_SEC &&
    now - point.updatedAt < RESUME_MAX_AGE_MS
  );
}

type Points = Record<string, ResumePoint>;

export interface ResumeStore {
  get(userId: string, stopId: string): Promise<ResumePoint | null>;
  save(userId: string, point: ResumePoint): Promise<void>;
  clear(userId: string, stopId: string): Promise<void>;
}

export function createResumeStore(storage: KeyValueStorage): ResumeStore {
  const key = (userId: string) => `${RESUME_KEY}.${userId}`;
  async function read(userId: string): Promise<Points> {
    try {
      const raw = await storage.getItem(key(userId));
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== 'object') return {};
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(([, p]) => isResumePoint(p)),
      ) as Points;
    } catch {
      return {};
    }
  }
  async function write(userId: string, points: Points) {
    try {
      await storage.setItem(key(userId), JSON.stringify(points));
    } catch {
      // Resuming is a convenience; the session itself is not affected.
    }
  }
  return {
    async get(userId, stopId) {
      return (await read(userId))[stopId] ?? null;
    },
    async save(userId, point) {
      const points = await read(userId);
      await write(userId, { ...points, [point.stopId]: point });
    },
    async clear(userId, stopId) {
      const points = await read(userId);
      if (!points[stopId]) return;
      const { [stopId]: _gone, ...rest } = points;
      await write(userId, rest);
    },
  };
}
