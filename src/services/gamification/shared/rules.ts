/**
 * The gamification rules, as pure functions shared by the server (which decides) and the app
 * (which displays and predicts while offline). No imports: the server loads this file as it is.
 *
 * Points live in a ledger of entries with deterministic keys (`session:<eventId>`,
 * `first:<stopId>`, `week:<weekKey>`, `badge:<badgeId>`, `item:<itemId>`...). The server only
 * ever adds entries whose key is missing and never removes one, so replaying an event, a second
 * device or a recomputation can never pay twice, and nothing earned is ever taken back.
 *
 * All amounts and thresholds are placeholders until MHP decides them.
 */

export type RuleStopType = 'video' | 'audio' | 'visual' | 'game' | 'longTrance';
export const GAME_KINDS = ['stillness', 'firefly', 'breathing'] as const;
export type GameKind = (typeof GAME_KINDS)[number];
export const isGameKind = (v: unknown): v is GameKind =>
  typeof v === 'string' && (GAME_KINDS as readonly string[]).includes(v);

/* ---------- amounts ---------- */

export const SESSION_POINTS: Record<RuleStopType, number> = {
  video: 10,
  audio: 10,
  visual: 10,
  game: 10,
  longTrance: 20,
};
/** Extra points the first time a stop is finished; once per stop. */
export const FIRST_TIME_BONUS = 20;
export const GAME_POINTS = 5;
export const WEEKLY_GOAL_POINTS = 30;
export const BADGE_POINTS = 15;
/** Granted once when onboarding is done. */
export const ONBOARDING_POINTS = 50;
/** Seconds of calm a game adds (its nominal length). */
export const GAME_SECONDS: Record<GameKind, number> = {
  stillness: 90,
  firefly: 100,
  breathing: 80,
};

const DAY_MS = 86_400_000;

/**
 * Activities (sessions and games) that count per UTC day. Far above real use; it bounds what a
 * crafted stream of fresh event ids could earn.
 */
export const MAX_COUNTED_PER_DAY = 12;
/** Events dated this long before the account existed are not counted (a slow device clock). */
export const ACCOUNT_CLOCK_SLACK_MS = 24 * 3600_000;
/**
 * An event claimed to be older than this when the server received it earns nothing (it is still
 * stored). Covers a legitimate offline stretch; stops a crafted client from dating events on
 * every past day of the account.
 */
export const MAX_BACKDATE_MS = 14 * DAY_MS;
/**
 * Activities that count per UTC day of arrival (the server's receive time), whatever dates they
 * claim. Above a legitimate week of offline use synced at once (7 * 12 is the per-day ceiling,
 * real use is far below), far below what a script could post.
 */
export const MAX_COUNTED_PER_ARRIVAL_DAY = 30;

/* ---------- weekly goal ---------- */

export const WEEKLY_TARGET_MIN = 3;
export const WEEKLY_TARGET_MAX = 7;
export const DEFAULT_WEEKLY_TARGET = 4;
export type SessionLengthPref = 'short' | 'medium' | 'long';
/** The starting target from the onboarding timing: shorter sessions, more days. */
export function defaultWeeklyTarget(sessionLength: SessionLengthPref | null | undefined): number {
  if (sessionLength === 'short') return 5;
  if (sessionLength === 'long') return 3;
  return DEFAULT_WEEKLY_TARGET;
}
export function clampWeeklyTarget(n: number): number {
  return Math.min(WEEKLY_TARGET_MAX, Math.max(WEEKLY_TARGET_MIN, Math.round(n)));
}

/* ---------- growth ---------- */

export type GrowthStage = 'hatchling' | 'juvenile' | 'adult' | 'grand';
/**
 * Calm minutes at which each stage starts (the egg is the croc before it hatches in onboarding).
 * Total calm minutes only grow, so the stage never goes down.
 */
export const GROWTH_THRESHOLDS: readonly { stage: GrowthStage; minutes: number }[] = [
  { stage: 'hatchling', minutes: 0 },
  { stage: 'juvenile', minutes: 30 },
  { stage: 'adult', minutes: 120 },
  { stage: 'grand', minutes: 360 },
];
export const GROWTH_STAGES: readonly GrowthStage[] = GROWTH_THRESHOLDS.map((t) => t.stage);
export const stageIndex = (stage: GrowthStage): number => GROWTH_STAGES.indexOf(stage);

export function stageForSeconds(seconds: number): GrowthStage {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  let stage: GrowthStage = 'hatchling';
  for (const t of GROWTH_THRESHOLDS) if (minutes >= t.minutes) stage = t.stage;
  return stage;
}

/** Where the croc is on the way to its next stage. */
export function growthProgress(seconds: number): {
  stage: GrowthStage;
  minutes: number;
  next: GrowthStage | null;
  nextAt: number | null;
  fraction: number;
} {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const stage = stageForSeconds(seconds);
  const i = stageIndex(stage);
  const here = GROWTH_THRESHOLDS[i]!;
  const nextT = GROWTH_THRESHOLDS[i + 1];
  if (!nextT) return { stage, minutes, next: null, nextAt: null, fraction: 1 };
  const fraction = (minutes - here.minutes) / (nextT.minutes - here.minutes);
  return { stage, minutes, next: nextT.stage, nextAt: nextT.minutes, fraction };
}

/* ---------- badges ---------- */

export const BADGE_IDS = [
  'firstSession',
  'firstLongTrance',
  'firstStillness',
  'firstFirefly',
  'firstBreathing',
  'days3',
  'days7',
  'days30',
  'zoneCompleted',
  'firstDecoration',
] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

/* ---------- decorations ---------- */

export type SlotKind = 'water' | 'bank' | 'air' | 'back';
export const SLOTS: readonly { id: string; kind: SlotKind }[] = [
  { id: 'water-left', kind: 'water' },
  { id: 'water-right', kind: 'water' },
  { id: 'water-front', kind: 'water' },
  { id: 'bank-left', kind: 'bank' },
  { id: 'bank-right', kind: 'bank' },
  { id: 'air', kind: 'air' },
  { id: 'back', kind: 'back' },
];
export const SLOT_IDS = SLOTS.map((s) => s.id);

export interface DecorationDef {
  id: string;
  slot: SlotKind;
  /** Points it costs (0 for one a milestone unlocks). */
  cost: number;
  /** The badge that unlocks it (milestone items). */
  requires?: BadgeId;
}

export const DECORATIONS: readonly DecorationDef[] = [
  { id: 'lilyPads', slot: 'water', cost: 40 },
  { id: 'reeds', slot: 'bank', cost: 30 },
  { id: 'stones', slot: 'bank', cost: 30 },
  { id: 'driftwood', slot: 'water', cost: 40 },
  { id: 'dragonflies', slot: 'air', cost: 50 },
  { id: 'lotus', slot: 'water', cost: 60 },
  { id: 'fireflies', slot: 'air', cost: 80 },
  { id: 'mangrove', slot: 'bank', cost: 120 },
  { id: 'heron', slot: 'bank', cost: 150 },
  { id: 'waterfall', slot: 'back', cost: 200 },
  { id: 'glowLotus', slot: 'water', cost: 0, requires: 'firstLongTrance' },
  { id: 'turtle', slot: 'water', cost: 0, requires: 'days7' },
];
export const decorationById = (id: string): DecorationDef | undefined =>
  DECORATIONS.find((d) => d.id === id);

/* ---------- days and weeks in the user's time zone ---------- */

const formatters = new Map<string, Intl.DateTimeFormat | null>();

function formatterFor(timeZone: string): Intl.DateTimeFormat | null {
  if (!formatters.has(timeZone)) {
    try {
      formatters.set(
        timeZone,
        new Intl.DateTimeFormat('en-US', {
          timeZone,
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
        }),
      );
    } catch {
      formatters.set(timeZone, null);
    }
  }
  return formatters.get(timeZone) ?? null;
}

export function isTimeZone(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && formatterFor(value) !== null;
}

/** Days since 1970-01-01 of the calendar day `at` falls on in `timeZone` (UTC if unknown). */
export function localDay(at: number, timeZone: string | null): number {
  const f = timeZone ? formatterFor(timeZone) : null;
  if (!f) return Math.floor(at / DAY_MS);
  const parts = f.formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Math.floor(Date.UTC(get('year'), get('month') - 1, get('day')) / DAY_MS);
}

/** The week a local day belongs to: the day number of its Monday. */
export function weekOfDay(day: number): number {
  // 1970-01-01 was a Thursday: (day + 3) % 7 is 0 on Mondays.
  return day - ((((day + 3) % 7) + 7) % 7);
}

/* ---------- the ledger ---------- */

export type EntryKind =
  'onboarding' | 'session' | 'firstTime' | 'game' | 'weeklyGoal' | 'badge' | 'item' | 'dev';

export interface LedgerEntry {
  key: string;
  kind: EntryKind;
  /** Positive when earned, negative when spent. */
  points: number;
  /** Calm seconds it adds (sessions, games). */
  seconds: number;
  /** When it was earned (epoch ms). */
  at: number;
  /** What it is about: a stop, a game, a week, a badge or an item id. */
  ref: string;
}

/** The events the ledger reads (as the server stores them in the `events` stream). */
export type ActivityEvent =
  | { id: string; type: 'sessionCompleted'; stopId: string; at: number; storedAt?: number }
  | { id: string; type: 'gameCompleted'; gameId: string; at: number; storedAt?: number };

export interface StopMeta {
  id: string;
  zoneId: string;
  type: RuleStopType;
  durationSec: number;
}

/** What the rules need to know about the content: every stop and the stops of each zone. */
export interface ContentMeta {
  stops: Record<string, StopMeta>;
  zones: Record<string, string[]>;
}

export function contentMetaOf(stops: readonly StopMeta[]): ContentMeta {
  const meta: ContentMeta = { stops: {}, zones: {} };
  for (const s of stops) {
    meta.stops[s.id] = { id: s.id, zoneId: s.zoneId, type: s.type, durationSec: s.durationSec };
    (meta.zones[s.zoneId] ??= []).push(s.id);
  }
  return meta;
}

export interface LedgerInput {
  events: readonly ActivityEvent[];
  ledger: readonly LedgerEntry[];
  content: ContentMeta;
  weeklyTarget: number;
  timeZone: string | null;
  onboardingRewarded: boolean;
  /** Account creation time: events dated well before it do not count. */
  accountCreatedAt: number;
}

const isActivity = (e: LedgerEntry) => e.kind === 'session' || e.kind === 'game';
const byTime = (a: LedgerEntry, b: LedgerEntry) => a.at - b.at || (a.key < b.key ? -1 : 1);

/**
 * The entries the ledger is missing, given the events. Already-present keys are never returned,
 * so applying the result twice changes nothing; the caller inserts them as they are.
 */
export function deriveNewEntries(input: LedgerInput): LedgerEntry[] {
  const have = new Map(input.ledger.map((e) => [e.key, e]));
  const added: LedgerEntry[] = [];
  const add = (entry: LedgerEntry) => {
    if (have.has(entry.key)) return;
    have.set(entry.key, entry);
    added.push(entry);
  };

  if (input.onboardingRewarded) {
    add({
      key: 'onboarding',
      kind: 'onboarding',
      points: ONBOARDING_POINTS,
      seconds: 0,
      at: input.accountCreatedAt,
      ref: 'onboarding',
    });
  }

  // Activities, oldest first, at most MAX_COUNTED_PER_DAY per UTC day (counting what is stored).
  const perDay = new Map<number, number>();
  for (const e of input.ledger) {
    if (!isActivity(e)) continue;
    const d = Math.floor(e.at / DAY_MS);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  const notBefore = input.accountCreatedAt - ACCOUNT_CLOCK_SLACK_MS;
  // Arrival order (the server's stored receive time, fixed at insert, so a replay gives the same
  // result); events without one (the app's own predictions) arrive when they say they happened.
  const arrival = (e: ActivityEvent) => e.storedAt ?? e.at;
  const arrivalDay = (e: ActivityEvent) => Math.floor(arrival(e) / DAY_MS);
  const events = [...input.events].sort(
    (a, b) => arrival(a) - arrival(b) || a.at - b.at || (a.id < b.id ? -1 : 1),
  );
  // What each arrival day has already been paid for, counting what is stored.
  const perArrivalDay = new Map<number, number>();
  for (const event of events) {
    const k = event.type === 'sessionCompleted' ? `session:${event.id}` : `game:${event.id}`;
    if (!have.has(k)) continue;
    perArrivalDay.set(arrivalDay(event), (perArrivalDay.get(arrivalDay(event)) ?? 0) + 1);
  }
  for (const event of events) {
    const key = event.type === 'sessionCompleted' ? `session:${event.id}` : `game:${event.id}`;
    if (have.has(key) || event.at < notBefore) continue;
    if (event.storedAt !== undefined && event.at < event.storedAt - MAX_BACKDATE_MS) continue;
    let entry: LedgerEntry;
    if (event.type === 'sessionCompleted') {
      const stop = input.content.stops[event.stopId];
      if (!stop) continue;
      entry = {
        key,
        kind: 'session',
        points: SESSION_POINTS[stop.type],
        // A game stop's calm time comes with its "game completed" event.
        seconds: stop.type === 'game' ? 0 : stop.durationSec,
        at: event.at,
        ref: stop.id,
      };
    } else {
      if (!isGameKind(event.gameId)) continue;
      entry = {
        key,
        kind: 'game',
        points: GAME_POINTS,
        seconds: GAME_SECONDS[event.gameId],
        at: event.at,
        ref: event.gameId,
      };
    }
    const d = Math.floor(event.at / DAY_MS);
    const count = perDay.get(d) ?? 0;
    const arrived = perArrivalDay.get(arrivalDay(event)) ?? 0;
    if (count >= MAX_COUNTED_PER_DAY || arrived >= MAX_COUNTED_PER_ARRIVAL_DAY) continue;
    perDay.set(d, count + 1);
    perArrivalDay.set(arrivalDay(event), arrived + 1);
    add(entry);
  }

  const activities = [...have.values()].filter(isActivity).sort(byTime);
  const sessions = activities.filter((e) => e.kind === 'session');

  // First-time bonus: once per stop, at its first counted completion.
  for (const s of sessions) {
    add({
      key: `first:${s.ref}`,
      kind: 'firstTime',
      points: FIRST_TIME_BONUS,
      seconds: 0,
      at: s.at,
      ref: s.ref,
    });
  }

  // Weekly goal: once per week in which the active days reached the target.
  const target = clampWeeklyTarget(input.weeklyTarget);
  const daysByWeek = new Map<number, Set<number>>();
  const allDays = new Set<number>();
  const badgeAt = new Map<BadgeId, number>();
  const earn = (id: BadgeId, at: number) => {
    if (!badgeAt.has(id)) badgeAt.set(id, at);
  };
  const doneStops = new Set<string>();
  for (const a of activities) {
    const day = localDay(a.at, input.timeZone);
    const week = weekOfDay(day);
    const days = daysByWeek.get(week) ?? new Set<number>();
    daysByWeek.set(week, days);
    days.add(day);
    if (days.size >= target) {
      add({
        key: `week:${week}`,
        kind: 'weeklyGoal',
        points: WEEKLY_GOAL_POINTS,
        seconds: 0,
        at: a.at,
        ref: String(week),
      });
    }
    allDays.add(day);
    if (allDays.size >= 3) earn('days3', a.at);
    if (allDays.size >= 7) earn('days7', a.at);
    if (allDays.size >= 30) earn('days30', a.at);
    if (a.kind === 'session') {
      earn('firstSession', a.at);
      if (input.content.stops[a.ref]?.type === 'longTrance') earn('firstLongTrance', a.at);
      doneStops.add(a.ref);
      const zone = input.content.stops[a.ref]?.zoneId;
      const zoneStops = zone ? input.content.zones[zone] : undefined;
      if (zoneStops && zoneStops.every((id) => doneStops.has(id))) earn('zoneCompleted', a.at);
    } else {
      if (a.ref === 'stillness') earn('firstStillness', a.at);
      if (a.ref === 'firefly') earn('firstFirefly', a.at);
      if (a.ref === 'breathing') earn('firstBreathing', a.at);
    }
  }
  const firstItem = [...have.values()].filter((e) => e.kind === 'item').sort(byTime)[0];
  if (firstItem) earn('firstDecoration', firstItem.at);

  for (const id of BADGE_IDS) {
    const at = badgeAt.get(id);
    if (at === undefined) continue;
    add({ key: `badge:${id}`, kind: 'badge', points: BADGE_POINTS, seconds: 0, at, ref: id });
  }
  return added;
}

export type SpendRefusal = 'unknown' | 'locked' | 'insufficient';

/**
 * Buying a decoration: the entry to add, null when it is already owned (buying again is free and
 * changes nothing), or why it is refused. Never lets the balance go below zero.
 */
export function purchaseEntry(
  ledger: readonly LedgerEntry[],
  itemId: string,
  at: number,
): LedgerEntry | null | { refused: SpendRefusal } {
  const item = decorationById(itemId);
  if (!item) return { refused: 'unknown' };
  if (ledger.some((e) => e.key === `item:${itemId}`)) return null;
  if (item.requires && !ledger.some((e) => e.key === `badge:${item.requires}`)) {
    return { refused: 'locked' };
  }
  if (balanceOf(ledger) < item.cost) return { refused: 'insufficient' };
  return { key: `item:${itemId}`, kind: 'item', points: -item.cost, seconds: 0, at, ref: itemId };
}

export function balanceOf(ledger: readonly LedgerEntry[]): number {
  return ledger.reduce((sum, e) => sum + e.points, 0);
}

export function calmSecondsOf(ledger: readonly LedgerEntry[]): number {
  return ledger.reduce((sum, e) => sum + e.seconds, 0);
}

/** What the app shows: balance, calm time, badges and owned decorations, latest entries. */
export interface PointsSummary {
  balance: number;
  calmSeconds: number;
  badges: { id: BadgeId; at: number }[];
  owned: { itemId: string; at: number }[];
  /** Latest entries first. */
  entries: LedgerEntry[];
}

export const SUMMARY_ENTRIES = 30;

export function summarize(ledger: readonly LedgerEntry[]): PointsSummary {
  const sorted = [...ledger].sort((a, b) => b.at - a.at || (a.key < b.key ? -1 : 1));
  return {
    balance: balanceOf(ledger),
    calmSeconds: calmSecondsOf(ledger),
    badges: sorted
      .filter((e) => e.kind === 'badge')
      .map((e) => ({ id: e.ref as BadgeId, at: e.at }))
      .reverse(),
    owned: sorted
      .filter((e) => e.kind === 'item')
      .map((e) => ({ itemId: e.ref, at: e.at }))
      .reverse(),
    entries: sorted.slice(0, SUMMARY_ENTRIES),
  };
}

/** Distinct local days with an activity in the week containing `now`. */
export function activeDaysThisWeek(
  ats: readonly number[],
  now: number,
  timeZone: string | null,
): number {
  const week = weekOfDay(localDay(now, timeZone));
  const days = new Set<number>();
  for (const at of ats) {
    const day = localDay(at, timeZone);
    if (weekOfDay(day) === week) days.add(day);
  }
  return Math.min(days.size, 7);
}
