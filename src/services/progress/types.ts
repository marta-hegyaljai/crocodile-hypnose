import type { SyncedDocument } from '@/services/profile/types';

/** What is stored for a stop the user has touched. Untouched stops have no record. */
export interface StopProgress {
  status: 'inProgress' | 'done';
  /** Client write time of this record, epoch ms. Last write wins per stop (done never regresses). */
  updatedAt: number;
  /** When the stop was first finished; null until then. */
  completedAt: number | null;
}

/** The user's progress along the river, synced as `GET/PUT /me/progress`. */
export interface ProgressDoc extends SyncedDocument {
  version: 1;
  stops: Record<string, StopProgress>;
}

export const STOP_ID_RE = /^[a-z0-9-]{1,64}$/;
/** Upper bound the server enforces; far above any content pack. */
export const MAX_STOP_RECORDS = 2000;

export function defaultProgress(updatedAt = 0): ProgressDoc {
  return { version: 1, updatedAt, stops: {} };
}

const isTime = (v: unknown) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;

export function isStopProgress(value: unknown): value is StopProgress {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    (v.status === 'inProgress' || v.status === 'done') &&
    isTime(v.updatedAt) &&
    (v.completedAt === null || isTime(v.completedAt)) &&
    // A finished stop knows when; an unfinished one does not.
    (v.status === 'done') === (v.completedAt !== null) &&
    Object.keys(v).length === 3
  );
}

export function isProgressDoc(value: unknown): value is ProgressDoc {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || !isTime(v.updatedAt)) return false;
  const stops = v.stops;
  if (!stops || typeof stops !== 'object' || Array.isArray(stops)) return false;
  const entries = Object.entries(stops as Record<string, unknown>);
  return (
    entries.length <= MAX_STOP_RECORDS &&
    entries.every(([id, record]) => STOP_ID_RE.test(id) && isStopProgress(record))
  );
}
