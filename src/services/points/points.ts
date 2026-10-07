import type { SessionCompletedEvent } from '@/services/events/types';
import { FIRST_TIME_BONUS, SESSION_POINTS } from '@/services/gamification/shared/rules';

/**
 * What one session is worth on its own, for the reward moment. The amounts are the shared rules'
 * (`src/services/gamification/shared/rules.ts`); the server's ledger decides what is really paid.
 */
export { FIRST_TIME_BONUS, SESSION_POINTS };

export interface PointsBreakdown {
  base: number;
  bonus: number;
  total: number;
}

export function sessionPoints(event: Pick<SessionCompletedEvent, 'stopType' | 'firstTime'>) {
  const base = SESSION_POINTS[event.stopType];
  const bonus = event.firstTime ? FIRST_TIME_BONUS : 0;
  return { base, bonus, total: base + bonus } satisfies PointsBreakdown;
}
