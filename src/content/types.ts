import type { CopyKey } from '@/copy';

/** The six regions of the river, in map order (top to bottom). */
export const ZONE_IDS = ['intro', 'sleep', 'stress', 'confidence', 'focus', 'habits'] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

export const STOP_TYPES = ['video', 'audio', 'visual', 'game', 'longTrance'] as const;
export type StopType = (typeof STOP_TYPES)[number];

/** When a stop fits the day best. `any` (or no hint) fits all day. */
export type TimeHint = 'morning' | 'evening' | 'any';

/**
 * How a zone opens: `open` from the start, `afterZone` once every stop of that zone is done,
 * `comingSoon` for zones shown on the map without content yet.
 */
export type ZoneEntry =
  { kind: 'open' } | { kind: 'afterZone'; zoneId: ZoneId } | { kind: 'comingSoon' };

/** How a stop unlocks: `previous` once the stop before it in the zone is done (the first stop
 * follows the zone's entry rule), `open` as soon as its zone is open. */
export type StopUnlock = 'previous' | 'open';

export interface Zone {
  id: ZoneId;
  order: number;
  titleKey: CopyKey;
  entry: ZoneEntry;
}

export interface Stop {
  id: string;
  zoneId: ZoneId;
  /** Position inside the zone, from 1. */
  order: number;
  type: StopType;
  titleKey: CopyKey;
  /** Length in seconds. */
  durationSec: number;
  /** Where the media lives (resolved by the player in step 5). */
  mediaRef: string;
  unlock: StopUnlock;
  /**
   * Suitable for users in caution mode (a "yes" in the onboarding safety check). Stops without
   * this flag are treated as not suitable: they are never suggested to those users and do not
   * block the way along the river for them.
   */
  cautionSafe?: boolean;
  timeOfDay?: TimeHint;
}

export interface ContentPack {
  version: 1;
  zones: Zone[];
  stops: Stop[];
}
