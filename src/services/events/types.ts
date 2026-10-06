import { STOP_TYPES, type StopType } from '@/content/types';
import type { MoodValue, SyncedDocument } from '@/services/profile/types';
import { STOP_ID_RE } from '@/services/progress/types';

/**
 * Append-only event streams the app keeps on the device and sends to the server
 * (`GET/POST /me/events`, `GET/POST /me/mood`). Every event has a client-made id, so sending it
 * again (a retry, another tab) stores it once. The shapes mirror `server/src/events.ts`.
 */

/** A finished session: the input of the points ledger (step 7). */
export interface SessionCompletedEvent {
  id: string;
  type: 'sessionCompleted';
  stopId: string;
  stopType: StopType;
  /** Epoch ms. */
  at: number;
  /**
   * The stop's first completion. The app claims it from its progress; the server keeps the claim
   * only if it has no first completion of the stop yet, and its answer replaces the claim.
   */
  firstTime: boolean;
}

/** A mood check-in before or after a session. Health data: only recorded with consent. */
export interface MoodEntry {
  id: string;
  at: number;
  phase: 'before' | 'after';
  value: MoodValue;
  stopId: string | null;
}

/** An event as the device keeps it: `confirmed` once the server has stored it. */
export type Logged<T> = T & { confirmed?: true };

/** The device copy of one stream, synced like a document (see `eventLog.ts`). */
export interface EventLogDoc<T> extends SyncedDocument {
  version: 1;
  items: Record<string, Logged<T>>;
}

export const EVENT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

const isTime = (v: unknown) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;
const keysWithin = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).every((k) => allowed.includes(k) || k === 'confirmed') &&
  (v.confirmed === undefined || v.confirmed === true);

export function isSessionCompletedEvent(value: unknown): value is SessionCompletedEvent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    EVENT_ID_RE.test(v.id) &&
    v.type === 'sessionCompleted' &&
    typeof v.stopId === 'string' &&
    STOP_ID_RE.test(v.stopId) &&
    (STOP_TYPES as readonly unknown[]).includes(v.stopType) &&
    isTime(v.at) &&
    typeof v.firstTime === 'boolean' &&
    keysWithin(v, ['id', 'type', 'stopId', 'stopType', 'at', 'firstTime'])
  );
}

export function isMoodEntry(value: unknown): value is MoodEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    EVENT_ID_RE.test(v.id) &&
    isTime(v.at) &&
    (v.phase === 'before' || v.phase === 'after') &&
    typeof v.value === 'number' &&
    Number.isInteger(v.value) &&
    v.value >= 1 &&
    v.value <= 5 &&
    (v.stopId === null || (typeof v.stopId === 'string' && STOP_ID_RE.test(v.stopId))) &&
    keysWithin(v, ['id', 'at', 'phase', 'value', 'stopId'])
  );
}

/** A new random event id (the server only needs it to be unique per user). */
export function newEventId(random: () => number = Math.random, now: number = Date.now()): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID;
  if (uuid && random === Math.random) return uuid.call(globalThis.crypto);
  let tail = '';
  for (let i = 0; i < 16; i++) tail += Math.floor(random() * 36).toString(36);
  return `${now.toString(36)}-${tail}`;
}
