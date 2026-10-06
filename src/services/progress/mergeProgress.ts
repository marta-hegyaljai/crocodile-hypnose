import type { ProgressDoc, StopProgress } from './types';

/**
 * Combines two records of the same stop. Finishing is one way: a done record always beats an
 * unfinished one, whatever the timestamps, and keeps the first completion time. Otherwise the
 * newer record wins (on a tie, `a`).
 */
export function mergeStop(a: StopProgress, b: StopProgress): StopProgress {
  if (a.status === 'done' && b.status === 'done') {
    return {
      status: 'done',
      updatedAt: Math.max(a.updatedAt, b.updatedAt),
      completedAt: Math.min(a.completedAt ?? Infinity, b.completedAt ?? Infinity),
    };
  }
  if (a.status === 'done') return a;
  if (b.status === 'done') return b;
  return b.updatedAt > a.updatedAt ? b : a;
}

/**
 * Merges two copies of the progress document (this device's and another's, or the server's):
 * the union of their stops, each merged with `mergeStop`. Commutative and idempotent, so a stale
 * tab, an offline device or a repeated write can never undo a finished stop.
 */
export function mergeProgress(a: ProgressDoc, b: ProgressDoc): ProgressDoc {
  const stops: Record<string, StopProgress> = { ...a.stops };
  for (const [id, record] of Object.entries(b.stops)) {
    const mine = stops[id];
    stops[id] = mine ? mergeStop(mine, record) : record;
  }
  return { version: 1, updatedAt: Math.max(a.updatedAt, b.updatedAt), stops: sortStops(stops) };
}

/**
 * Stop records in id order, so two copies with the same content serialise the same way (the
 * document store compares copies by their JSON).
 */
function sortStops(stops: Record<string, StopProgress>): Record<string, StopProgress> {
  return Object.fromEntries(
    Object.keys(stops)
      .sort()
      .map((id) => [id, stops[id]!]),
  );
}

/** Marks a stop as started. A finished stop stays finished (replaying it changes nothing). */
export function markStarted(doc: ProgressDoc, stopId: string, now: number): ProgressDoc {
  const current = doc.stops[stopId];
  if (current?.status === 'done' || current?.status === 'inProgress') return doc;
  return {
    ...doc,
    stops: sortStops({
      ...doc.stops,
      [stopId]: { status: 'inProgress', updatedAt: now, completedAt: null },
    }),
  };
}

/** Marks a stop as finished. The first completion time is kept on a replay. */
export function markDone(doc: ProgressDoc, stopId: string, now: number): ProgressDoc {
  const current = doc.stops[stopId];
  if (current?.status === 'done') return doc;
  return {
    ...doc,
    stops: sortStops({
      ...doc.stops,
      [stopId]: { status: 'done', updatedAt: now, completedAt: now },
    }),
  };
}
