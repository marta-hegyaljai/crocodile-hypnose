/**
 * The per-user app documents the app keeps in sync with the server (`GET/PUT /me/<kind>`):
 * onboarding state and settings. Each is a whole JSON document with a schema `version` and the
 * client's `updatedAt` (epoch ms); the newer write wins, locally and on the server.
 *
 * The shapes mirror the server's schemas in `server/src/documents.ts` (v1).
 */

export const GOALS = ['sleep', 'stress', 'confidence', 'focus', 'habits'] as const;
export type Goal = (typeof GOALS)[number];

export const ONBOARDING_STEPS = [
  'goals',
  'experience',
  'safety',
  'consent',
  'hatch',
  'firstSession',
  'reminder',
  'done',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type Experience = 'new' | 'experienced';
export type TimeOfDay = 'morning' | 'evening';
export type SessionLength = 'short' | 'medium' | 'long';
export type ReminderDecision = 'enabled' | 'skipped' | 'unavailable';
export type MoodValue = 1 | 2 | 3 | 4 | 5;

export const SAFETY_QUESTION_COUNT = 3;
export type SafetyAnswers = (boolean | null)[];

/** A document kind as the server names it in its routes. */
export type DocumentKind = 'onboarding' | 'settings' | 'progress';

export interface SyncedDocument {
  version: number;
  /** Client write time, epoch ms. Last write wins. */
  updatedAt: number;
}

export interface OnboardingDoc extends SyncedDocument {
  version: 1;
  /** Where to resume. */
  step: OnboardingStep;
  completed: boolean;
  completedAt: number | null;
  goals: Goal[];
  experience: Experience | null;
  timeOfDay: TimeOfDay | null;
  sessionLength: SessionLength | null;
  safety: { answers: SafetyAnswers; acknowledged: boolean };
  moodConsent: boolean | null;
  crocHatched: boolean;
  crocName: string | null;
  /** Mood values are health data: only filled in with consent, otherwise kept in memory only. */
  firstSession: { completed: boolean; moodBefore: MoodValue | null; moodAfter: MoodValue | null };
  reminder: ReminderDecision | null;
  rewardGranted: boolean;
}

export interface SettingsDoc extends SyncedDocument {
  version: 1;
  crocName: string | null;
  goals: Goal[];
  experience: Experience | null;
  sessionLength: SessionLength;
  reminder: { enabled: boolean; time: string | null; timeOfDay: TimeOfDay | null };
  moodConsent: boolean;
  safety: { answers: SafetyAnswers; cautionMode: boolean };
  sound: boolean;
  haptics: boolean;
  /** Reduced-motion override: true reduces, false forces full motion, null/absent follows the device. */
  reducedMotion?: boolean | null;
}

export function defaultOnboarding(updatedAt = 0): OnboardingDoc {
  return {
    version: 1,
    updatedAt,
    step: 'goals',
    completed: false,
    completedAt: null,
    goals: [],
    experience: null,
    timeOfDay: null,
    sessionLength: null,
    safety: {
      answers: Array<boolean | null>(SAFETY_QUESTION_COUNT).fill(null),
      acknowledged: false,
    },
    moodConsent: null,
    crocHatched: false,
    crocName: null,
    firstSession: { completed: false, moodBefore: null, moodAfter: null },
    reminder: null,
    rewardGranted: false,
  };
}

export function defaultSettings(updatedAt = 0): SettingsDoc {
  return {
    version: 1,
    updatedAt,
    crocName: null,
    goals: [],
    experience: null,
    sessionLength: 'medium',
    reminder: { enabled: false, time: null, timeOfDay: null },
    moodConsent: false,
    safety: {
      answers: Array<boolean | null>(SAFETY_QUESTION_COUNT).fill(null),
      cautionMode: false,
    },
    sound: true,
    haptics: true,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isNullableBool = (v: unknown) => v === null || isBool(v);
const isInt = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isNullableInt = (v: unknown, min: number, max: number) => v === null || isInt(v, min, max);
const oneOf = (values: readonly string[], v: unknown) =>
  typeof v === 'string' && values.includes(v);
const nullableOneOf = (values: readonly string[], v: unknown) => v === null || oneOf(values, v);
const isGoals = (v: unknown): v is Goal[] =>
  Array.isArray(v) &&
  v.length <= 2 &&
  v.every((g) => oneOf(GOALS, g)) &&
  new Set(v).size === v.length;
const isAnswers = (v: unknown): v is SafetyAnswers =>
  Array.isArray(v) && v.length === SAFETY_QUESTION_COUNT && v.every(isNullableBool);
const isNullableName = (v: unknown) => v === null || (typeof v === 'string' && v.length > 0);

/** Structural check of a stored or received onboarding document. Unknown versions are refused. */
export function isOnboardingDoc(value: unknown): value is OnboardingDoc {
  if (!isRecord(value) || value.version !== 1) return false;
  const safety = value.safety;
  const first = value.firstSession;
  return (
    isInt(value.updatedAt, 0, Number.MAX_SAFE_INTEGER) &&
    oneOf(ONBOARDING_STEPS, value.step) &&
    isBool(value.completed) &&
    isNullableInt(value.completedAt, 0, Number.MAX_SAFE_INTEGER) &&
    isGoals(value.goals) &&
    nullableOneOf(['new', 'experienced'], value.experience) &&
    nullableOneOf(['morning', 'evening'], value.timeOfDay) &&
    nullableOneOf(['short', 'medium', 'long'], value.sessionLength) &&
    isRecord(safety) &&
    isAnswers(safety.answers) &&
    isBool(safety.acknowledged) &&
    isNullableBool(value.moodConsent) &&
    isBool(value.crocHatched) &&
    isNullableName(value.crocName) &&
    isRecord(first) &&
    isBool(first.completed) &&
    isNullableInt(first.moodBefore, 1, 5) &&
    isNullableInt(first.moodAfter, 1, 5) &&
    nullableOneOf(['enabled', 'skipped', 'unavailable'], value.reminder) &&
    isBool(value.rewardGranted)
  );
}

export function isSettingsDoc(value: unknown): value is SettingsDoc {
  if (!isRecord(value) || value.version !== 1) return false;
  const reminder = value.reminder;
  const safety = value.safety;
  return (
    isInt(value.updatedAt, 0, Number.MAX_SAFE_INTEGER) &&
    isNullableName(value.crocName) &&
    isGoals(value.goals) &&
    nullableOneOf(['new', 'experienced'], value.experience) &&
    oneOf(['short', 'medium', 'long'], value.sessionLength) &&
    isRecord(reminder) &&
    isBool(reminder.enabled) &&
    (reminder.time === null ||
      (typeof reminder.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(reminder.time))) &&
    nullableOneOf(['morning', 'evening'], reminder.timeOfDay) &&
    isBool(value.moodConsent) &&
    isRecord(safety) &&
    isAnswers(safety.answers) &&
    isBool(safety.cautionMode) &&
    isBool(value.sound) &&
    isBool(value.haptics) &&
    (value.reducedMotion === undefined || isNullableBool(value.reducedMotion))
  );
}

/** Drops server-only fields from a received document so it can be written back as it is. */
export function stripServerFields<T extends SyncedDocument>(doc: T & { storedAt?: unknown }): T {
  const { storedAt: _storedAt, ...rest } = doc;
  return rest as T;
}
