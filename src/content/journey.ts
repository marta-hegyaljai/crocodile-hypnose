import type { Goal } from '@/services/profile/types';
import type { ProgressDoc } from '@/services/progress/types';

import type { ContentRepository } from './repository';
import type { Stop, Zone, ZoneId } from './types';

/** What a stop looks like to this user right now. */
export type StopStatus =
  | 'locked'
  | 'available'
  | 'inProgress'
  | 'done'
  /** Not suitable in caution mode: never suggested, never blocks the way. */
  | 'caution';

export type ZoneState = 'open' | 'locked' | 'comingSoon';

/** Why a stop cannot be started yet. */
export type LockReason =
  { kind: 'previous'; stop: Stop } | { kind: 'zone'; zone: Zone } | { kind: 'comingSoon' };

export interface StopView {
  stop: Stop;
  status: StopStatus;
  lockReason: LockReason | null;
}

export interface ZoneView {
  zone: Zone;
  state: ZoneState;
  stops: StopView[];
  /** Stops finished (or passed over in caution mode) out of all stops. */
  done: number;
  total: number;
  finished: boolean;
}

export interface Journey {
  zones: ZoneView[];
  byStopId: Map<string, StopView>;
}

export interface JourneyOptions {
  cautionMode: boolean;
}

const cleared = (s: StopStatus) => s === 'done' || s === 'caution';

/**
 * Derives every stop's status from the content and the stored progress. Pure: stored progress
 * only says what was started or finished, everything else (locked, available) follows from the
 * unlock rules here, so a content update can never leave stale "unlocked" flags behind.
 */
export function deriveJourney(
  content: ContentRepository,
  progress: ProgressDoc,
  { cautionMode }: JourneyOptions,
): Journey {
  const views = new Map<ZoneId, ZoneView>();
  const byStopId = new Map<string, StopView>();

  const zoneState = (zone: Zone): ZoneState => {
    if (zone.entry.kind === 'comingSoon') return 'comingSoon';
    if (zone.entry.kind === 'open') return 'open';
    const before = views.get(zone.entry.zoneId);
    return before?.finished ? 'open' : 'locked';
  };

  // A zone that opens after another needs that one's result first: one more pass per such zone
  // settles any chain, whatever the order of the pack.
  const ordered = content.zones();
  const passes = 1 + ordered.filter((z) => z.entry.kind === 'afterZone').length;
  for (let pass = 0; pass < passes; pass++) {
    for (const zone of ordered) {
      const state = zoneState(zone);
      const stops: StopView[] = [];
      let previous: StopView | null = null;
      for (const stop of content.stopsOf(zone.id)) {
        const record = progress.stops[stop.id];
        let status: StopStatus;
        let lockReason: LockReason | null = null;
        if (state === 'comingSoon') {
          status = 'locked';
          lockReason = { kind: 'comingSoon' };
        } else if (record?.status === 'done') {
          // Finished stays finished, whatever changed since (content order, caution mode).
          status = 'done';
        } else if (state === 'locked') {
          status = 'locked';
          lockReason = {
            kind: 'zone',
            zone: content.zone((zone.entry as { zoneId: ZoneId }).zoneId)!,
          };
        } else if (cautionMode && !stop.cautionSafe) {
          status = 'caution';
        } else {
          const reached =
            stop.unlock === 'open' || previous === null || cleared(previous.status) || !!record;
          if (reached) status = record?.status === 'inProgress' ? 'inProgress' : 'available';
          else {
            status = 'locked';
            lockReason = { kind: 'previous', stop: previous!.stop };
          }
        }
        const view: StopView = { stop, status, lockReason };
        stops.push(view);
        byStopId.set(stop.id, view);
        previous = view;
      }
      const done = stops.filter((s) => cleared(s.status)).length;
      views.set(zone.id, {
        zone,
        state,
        stops,
        done,
        total: stops.length,
        finished: stops.length > 0 && done === stops.length,
      });
    }
  }
  return { zones: content.zones().map((z) => views.get(z.id)!), byStopId };
}

export type DayPart = 'morning' | 'day' | 'evening';

/** Morning 05:00–11:59, evening 17:00–04:59, day in between (local time). */
export function dayPartOf(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 17 || hour < 5) return 'evening';
  return 'day';
}

function fitsTime(stop: Stop, part: DayPart): boolean {
  const hint = stop.timeOfDay ?? 'any';
  return hint === 'any' || hint === part;
}

export interface TodaysSession {
  /** `next`: the next new stop; `resume`: one already started; `replay`: everything is done. */
  kind: 'next' | 'resume' | 'replay';
  stop: Stop;
  zone: Zone;
}

export interface TodayOptions {
  /** The user's goals from onboarding, most important first. */
  goals: readonly Goal[];
  /** Local hour, 0–23. */
  hour: number;
  cautionMode: boolean;
}

/** Zones in the order today's session looks at them: goal zones, then Intro, then the rest. */
export function zonePriority(journey: Journey, goals: readonly Goal[]): ZoneView[] {
  const open = journey.zones.filter((z) => z.state === 'open' && z.total > 0);
  const picked: ZoneView[] = [];
  const add = (z: ZoneView | undefined) => {
    if (z && !picked.includes(z)) picked.push(z);
  };
  for (const goal of goals) add(open.find((z) => z.zone.id === goal));
  add(open.find((z) => z.zone.id === 'intro'));
  open.forEach(add);
  return picked;
}

/**
 * Picks today's session: the next stop to play in the user's goal zone, resuming a started one
 * first. A stop that does not fit the time of day (sleep content in the morning) gives way to
 * the next zone's stop that does; if nothing fits, the first candidate is still offered. When
 * every open zone is finished, a finished stop is suggested again (the goal zone's long trance
 * first). In caution mode, unsuitable stops are never suggested. Null only without content.
 */
export function pickTodaysSession(journey: Journey, options: TodayOptions): TodaysSession | null {
  const part = dayPartOf(options.hour);
  const zones = zonePriority(journey, options.goals);
  const candidates: { view: StopView; zone: ZoneView }[] = [];
  for (const zone of zones) {
    const started = zone.stops.find((s) => s.status === 'inProgress');
    const next = started ?? zone.stops.find((s) => s.status === 'available');
    if (next) candidates.push({ view: next, zone });
  }
  const chosen = candidates.find((c) => fitsTime(c.view.stop, part)) ?? candidates[0];
  if (chosen) {
    return {
      kind: chosen.view.status === 'inProgress' ? 'resume' : 'next',
      stop: chosen.view.stop,
      zone: chosen.zone.zone,
    };
  }

  // Everything open is finished: suggest a favourite again.
  const replayable: { view: StopView; zone: ZoneView }[] = [];
  for (const zone of zones) {
    const done = zone.stops
      .filter((s) => s.status === 'done' && (!options.cautionMode || s.stop.cautionSafe))
      .reverse(); // the zone's finale (long trance) first
    for (const view of done) replayable.push({ view, zone });
  }
  const replay = replayable.find((c) => fitsTime(c.view.stop, part)) ?? replayable[0];
  return replay ? { kind: 'replay', stop: replay.view.stop, zone: replay.zone.zone } : null;
}
