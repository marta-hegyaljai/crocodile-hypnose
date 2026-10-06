import type { StopType } from '@/content/types';
import type { SessionCompletedEvent } from '@/services/events/types';

/**
 * Points for sessions, as pure functions of the "session completed" events. Placeholder amounts
 * until MHP decides them; the points ledger (step 7) takes these rules to the server.
 */
export const SESSION_POINTS: Record<StopType, number> = {
  video: 10,
  audio: 10,
  visual: 10,
  game: 10,
  longTrance: 20,
};
/** Extra points the first time a stop is finished; granted once per stop. */
export const FIRST_TIME_BONUS = 20;

export interface PointsBreakdown {
  base: number;
  bonus: number;
  total: number;
}

/** What one completion is worth on its own (the reward moment shows this). */
export function sessionPoints(event: Pick<SessionCompletedEvent, 'stopType' | 'firstTime'>) {
  const base = SESSION_POINTS[event.stopType];
  const bonus = event.firstTime ? FIRST_TIME_BONUS : 0;
  return { base, bonus, total: base + bonus } satisfies PointsBreakdown;
}

/**
 * All session points of a user. A first-time bonus counts once per stop, even if two events
 * claim it (two devices offline before the server decided): the earliest claim wins.
 */
export function totalSessionPoints(events: readonly SessionCompletedEvent[]): number {
  const bonusGiven = new Set<string>();
  let total = 0;
  const ordered = [...events].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  const seen = new Set<string>();
  for (const event of ordered) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const firstTime = event.firstTime && !bonusGiven.has(event.stopId);
    if (firstTime) bonusGiven.add(event.stopId);
    total += sessionPoints({ stopType: event.stopType, firstTime }).total;
  }
  return total;
}
