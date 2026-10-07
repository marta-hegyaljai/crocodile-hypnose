import { localContent } from '@/content/repository';
import type { ContentRepository } from '@/content/repository';
import { eventsOf, pendingOf } from '@/services/events/eventLog';
import type { ActivityEvent, EventLogDoc } from '@/services/events/types';

import {
  activeDaysThisWeek,
  contentMetaOf,
  FIRST_TIME_BONUS,
  GAME_POINTS,
  GAME_SECONDS,
  localDay,
  SESSION_POINTS,
  stageIndex,
  weekOfDay,
  type ContentMeta,
  type GrowthStage,
} from './shared/rules';

/** The app's content as the rules see it (the server reads the same pack). */
export function contentMetaFrom(content: ContentRepository): ContentMeta {
  return contentMetaOf(content.zones().flatMap((z) => content.stopsOf(z.id)));
}
export const appContentMeta = contentMetaFrom(localContent);

/**
 * What the events the server has not stored yet will probably be worth: shown on top of the
 * server's balance while offline. The server decides the real amount when they arrive.
 */
export function pendingGains(
  log: EventLogDoc<ActivityEvent>,
  content: ContentMeta = appContentMeta,
): { points: number; seconds: number; count: number } {
  let points = 0;
  let seconds = 0;
  const pending = pendingOf(log);
  for (const e of pending) {
    if (e.type === 'sessionCompleted') {
      const stop = content.stops[e.stopId];
      if (!stop) continue;
      points += SESSION_POINTS[stop.type] + (e.firstTime ? FIRST_TIME_BONUS : 0);
      if (stop.type !== 'game') seconds += stop.durationSec;
    } else {
      points += GAME_POINTS;
      seconds += GAME_SECONDS[e.gameId];
    }
  }
  return { points, seconds, count: pending.length };
}

/** The device's IANA time zone (null when the platform cannot tell). */
export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Days this week with a finished session or game, from every event on the device. */
export function weeklyDays(
  log: EventLogDoc<ActivityEvent>,
  now: number,
  timeZone: string | null,
): number {
  return activeDaysThisWeek(
    eventsOf(log).map((e) => e.at),
    now,
    timeZone,
  );
}

export function currentWeek(now: number, timeZone: string | null): number {
  return weekOfDay(localDay(now, timeZone));
}

/** A growth moment to show: the croc is past the stage whose moment was last shown. */
export function growthToShow(stage: GrowthStage, seen: GrowthStage): GrowthStage | null {
  return stageIndex(stage) > stageIndex(seen) ? stage : null;
}
