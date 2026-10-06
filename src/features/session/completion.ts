import { deriveJourney } from '@/content/journey';
import type { ContentRepository } from '@/content/repository';
import type { Stop } from '@/content/types';
import type { SessionCompletedEvent } from '@/services/events/types';
import { sessionPoints, type PointsBreakdown } from '@/services/points/points';
import { markDone } from '@/services/progress/mergeProgress';
import type { ProgressDoc } from '@/services/progress/types';

import { newlyUnlocked } from './unlock';

export interface Completion {
  event: SessionCompletedEvent;
  points: PointsBreakdown;
  /** Stops this completion opened on the map. */
  unlocked: string[];
}

/**
 * What finishing a session means, from the progress before it: the "session completed" event
 * (with the run's id, so finishing the same run twice is one event), the points it is worth
 * (the first-time bonus only if the stop was not finished before), and the stops it unlocks.
 */
export function completeSession(
  content: ContentRepository,
  progress: ProgressDoc,
  stop: Stop,
  runId: string,
  now: number,
  cautionMode: boolean,
): Completion {
  const firstTime = progress.stops[stop.id]?.status !== 'done';
  const event: SessionCompletedEvent = {
    id: runId,
    type: 'sessionCompleted',
    stopId: stop.id,
    stopType: stop.type,
    at: now,
    firstTime,
  };
  const before = deriveJourney(content, progress, { cautionMode });
  const after = deriveJourney(content, markDone(progress, stop.id, now), { cautionMode });
  return { event, points: sessionPoints(event), unlocked: newlyUnlocked(before, after) };
}
