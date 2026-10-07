import type { SyncedDocument } from '@/services/profile/types';

import {
  BADGE_IDS,
  DECORATIONS,
  GROWTH_STAGES,
  SLOT_IDS,
  WEEKLY_TARGET_MAX,
  WEEKLY_TARGET_MIN,
  stageIndex,
  type GrowthStage,
  type LedgerEntry,
  type PointsSummary,
} from './shared/rules';

/**
 * The gamification documents the app syncs (shapes mirror `server/src/documents.ts` and
 * `server/src/gamification.ts`):
 * - `GamificationDoc` (`/me/gamification`): the weekly goal and what was already celebrated;
 * - `HabitatDoc` (`/me/habitat`): which owned decoration sits in which slot (last write wins).
 * The points summary (`/me/points`) is the server's; the app only caches it.
 */
export interface GamificationDoc extends SyncedDocument {
  version: 1;
  weeklyTarget: number;
  /** IANA time zone the weeks are counted in (the device's). */
  timeZone: string | null;
  /** The stage whose growth moment was shown. Only moves forward. */
  seenStage: GrowthStage;
  /** The week (day number of its Monday) whose reached goal was celebrated. Only moves forward. */
  celebratedWeek: number | null;
}

export interface HabitatDoc extends SyncedDocument {
  version: 1;
  slots: Record<string, string | null>;
}

export function defaultGamification(
  weeklyTarget = 4,
  timeZone: string | null = null,
): GamificationDoc {
  return {
    version: 1,
    updatedAt: 0,
    weeklyTarget,
    timeZone,
    seenStage: 'hatchling',
    celebratedWeek: null,
  };
}

export function emptySlots(): Record<string, string | null> {
  return Object.fromEntries(SLOT_IDS.map((id) => [id, null]));
}

export function defaultHabitat(): HabitatDoc {
  return { version: 1, updatedAt: 0, slots: emptySlots() };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v);
const isTime = (v: unknown) => isInt(v) && (v as number) >= 0;

export function isGamificationDoc(value: unknown): value is GamificationDoc {
  if (!isRecord(value) || value.version !== 1) return false;
  return (
    isTime(value.updatedAt) &&
    isInt(value.weeklyTarget) &&
    (value.weeklyTarget as number) >= WEEKLY_TARGET_MIN &&
    (value.weeklyTarget as number) <= WEEKLY_TARGET_MAX &&
    (value.timeZone === null ||
      (typeof value.timeZone === 'string' && value.timeZone.length > 0)) &&
    (GROWTH_STAGES as readonly unknown[]).includes(value.seenStage) &&
    (value.celebratedWeek === null || isInt(value.celebratedWeek))
  );
}

const ITEM_IDS = DECORATIONS.map((d) => d.id);

export function isHabitatDoc(value: unknown): value is HabitatDoc {
  if (!isRecord(value) || value.version !== 1 || !isTime(value.updatedAt)) return false;
  const slots = value.slots;
  if (!isRecord(slots)) return false;
  return Object.entries(slots).every(
    ([slot, item]) => SLOT_IDS.includes(slot) && (item === null || ITEM_IDS.includes(String(item))),
  );
}

/** Mirrors the server: newer choices win, the "seen" marks only move forward. */
export function mergeGamification(a: GamificationDoc, b: GamificationDoc): GamificationDoc {
  const newer = b.updatedAt > a.updatedAt ? b : a;
  const weeks = [a.celebratedWeek, b.celebratedWeek].filter((w): w is number => w !== null);
  return {
    ...newer,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    seenStage: stageIndex(a.seenStage) >= stageIndex(b.seenStage) ? a.seenStage : b.seenStage,
    celebratedWeek: weeks.length > 0 ? Math.max(...weeks) : null,
  };
}

const KINDS = ['onboarding', 'session', 'firstTime', 'game', 'weeklyGoal', 'badge', 'item', 'dev'];

function isEntry(v: unknown): v is LedgerEntry {
  return (
    isRecord(v) &&
    typeof v.key === 'string' &&
    KINDS.includes(String(v.kind)) &&
    isInt(v.points) &&
    isInt(v.seconds) &&
    isTime(v.at) &&
    typeof v.ref === 'string'
  );
}

/** Checks a points summary from the server (or the device cache). */
export function isPointsSummary(value: unknown): value is PointsSummary {
  if (!isRecord(value)) return false;
  return (
    isInt(value.balance) &&
    isInt(value.calmSeconds) &&
    Array.isArray(value.badges) &&
    value.badges.every(
      (b) => isRecord(b) && (BADGE_IDS as readonly unknown[]).includes(b.id) && isTime(b.at),
    ) &&
    Array.isArray(value.owned) &&
    value.owned.every((o) => isRecord(o) && typeof o.itemId === 'string' && isTime(o.at)) &&
    Array.isArray(value.entries) &&
    value.entries.every(isEntry)
  );
}

export const emptySummary = (): PointsSummary => ({
  balance: 0,
  calmSeconds: 0,
  badges: [],
  owned: [],
  entries: [],
});
