import { ONBOARDING_POINTS } from '@/features/onboarding/flow';
import { eventsOf } from '@/services/events/eventLog';
import type { EventLogDoc, SessionCompletedEvent } from '@/services/events/types';
import { totalSessionPoints } from '@/services/points/points';
import type { OnboardingDoc } from '@/services/profile/types';
import type { ProgressDoc } from '@/services/progress/types';

/**
 * Numbers for the home header until the points ledger and the weekly goal arrive in step 7:
 * points are the onboarding reward plus the session points (from the "session completed" events),
 * the weekly goal counts the days this week with a finished stop against a fixed target.
 */
export const WEEKLY_GOAL_DAYS = 5;

export function placeholderPoints(
  onboarding: Pick<OnboardingDoc, 'rewardGranted'>,
  sessions?: EventLogDoc<SessionCompletedEvent>,
): number {
  const fromSessions = sessions ? totalSessionPoints(eventsOf(sessions)) : 0;
  return (onboarding.rewardGranted ? ONBOARDING_POINTS : 0) + fromSessions;
}

/** Start of the local week (Monday 00:00) containing `now`. */
export function weekStart(now: number): number {
  const d = new Date(now);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysSinceMonday);
  return d.getTime();
}

/** Distinct local days this week on which a stop was finished (first completions). */
export function daysActiveThisWeek(progress: ProgressDoc, now: number): number {
  const start = weekStart(now);
  const days = new Set<string>();
  for (const record of Object.values(progress.stops)) {
    if (record.completedAt === null || record.completedAt < start || record.completedAt > now)
      continue;
    const d = new Date(record.completedAt);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  return Math.min(days.size, 7);
}
