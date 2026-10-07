/**
 * Per-user app documents the Hypnose app keeps in sync: one JSON document per kind. Each kind has
 * a schema version; the server validates the whole document against the schema for the version
 * the client sends, so a later app version can add fields by adding a schema version here (and
 * keeping the old one accepted until every client has moved on).
 *
 * Documents are written whole and merged last-write-wins on the client's `updatedAt`, so the
 * server never has to understand partial updates.
 */
import { ApiError, type ErrorCode } from './errors.ts';

export const DOCUMENT_KINDS = ['onboarding', 'settings', 'progress'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export function isDocumentKind(value: unknown): value is DocumentKind {
  return typeof value === 'string' && (DOCUMENT_KINDS as readonly string[]).includes(value);
}

/**
 * A client clock may run ahead. `updatedAt` is clamped to the server's time so one device with a
 * wrong clock can never outrank every other device forever (the client keeps its own stamp).
 */
export const MAX_CLOCK_SKEW_MS = 5 * 60_000;

const bool = { type: 'boolean' } as const;
const nullableBool = { type: ['boolean', 'null'] } as const;
const nullableInt = (min: number, max: number) =>
  ({ type: ['integer', 'null'], minimum: min, maximum: max }) as const;
const oneOf = <T extends string>(...values: T[]) => ({ type: 'string', enum: values }) as const;
const nullableOneOf = <T extends string>(...values: T[]) =>
  ({ type: ['string', 'null'], enum: [...values, null] }) as const;

export const GOALS = ['sleep', 'stress', 'confidence', 'focus', 'habits'] as const;
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
const EXPERIENCE = ['new', 'experienced'] as const;
const TIME_OF_DAY = ['morning', 'evening'] as const;
const SESSION_LENGTH = ['short', 'medium', 'long'] as const;
const REMINDER_DECISION = ['enabled', 'skipped', 'unavailable'] as const;

/** 1 to 20 characters once trimmed (counted in code points, so emoji are fine); no control characters. */
export const CROC_NAME_MAX = 20;
const crocName = {
  type: ['string', 'null'],
  minLength: 1,
  // UTF-16 upper bound; the exact code-point rule is checked below.
  maxLength: CROC_NAME_MAX * 2,
} as const;

const goals = {
  type: 'array',
  items: oneOf(...GOALS),
  maxItems: 2,
  uniqueItems: true,
} as const;

const safetyAnswers = {
  type: 'array',
  items: nullableBool,
  minItems: 3,
  maxItems: 3,
} as const;

const base = {
  version: { type: 'integer', const: 1 },
  updatedAt: { type: 'integer', minimum: 0 },
} as const;

/** Onboarding flow state, v1: where the user is, what they answered, what already happened. */
const onboardingV1 = {
  type: 'object',
  additionalProperties: false,
  required: [
    'version',
    'updatedAt',
    'step',
    'completed',
    'completedAt',
    'goals',
    'experience',
    'timeOfDay',
    'sessionLength',
    'safety',
    'moodConsent',
    'crocHatched',
    'crocName',
    'firstSession',
    'reminder',
    'rewardGranted',
  ],
  properties: {
    ...base,
    step: oneOf(...ONBOARDING_STEPS),
    completed: bool,
    completedAt: { type: ['integer', 'null'], minimum: 0 },
    goals,
    experience: nullableOneOf(...EXPERIENCE),
    timeOfDay: nullableOneOf(...TIME_OF_DAY),
    sessionLength: nullableOneOf(...SESSION_LENGTH),
    safety: {
      type: 'object',
      additionalProperties: false,
      required: ['answers', 'acknowledged'],
      properties: { answers: safetyAnswers, acknowledged: bool },
    },
    moodConsent: nullableBool,
    crocHatched: bool,
    crocName,
    firstSession: {
      type: 'object',
      additionalProperties: false,
      required: ['completed', 'moodBefore', 'moodAfter'],
      // Mood values are health data: the app only fills them in with the user's consent.
      properties: { completed: bool, moodBefore: nullableInt(1, 5), moodAfter: nullableInt(1, 5) },
    },
    reminder: nullableOneOf(...REMINDER_DECISION),
    rewardGranted: bool,
  },
} as const;

/** User settings, v1: what onboarding decided and what the settings screen (step 8) will edit. */
const settingsV1 = {
  type: 'object',
  additionalProperties: false,
  required: [
    'version',
    'updatedAt',
    'crocName',
    'goals',
    'experience',
    'sessionLength',
    'reminder',
    'moodConsent',
    'safety',
    'sound',
    'haptics',
  ],
  properties: {
    ...base,
    crocName,
    goals,
    experience: nullableOneOf(...EXPERIENCE),
    sessionLength: oneOf(...SESSION_LENGTH),
    reminder: {
      type: 'object',
      additionalProperties: false,
      required: ['enabled', 'time', 'timeOfDay'],
      properties: {
        enabled: bool,
        time: { type: ['string', 'null'], pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
        timeOfDay: nullableOneOf(...TIME_OF_DAY),
      },
    },
    moodConsent: bool,
    safety: {
      type: 'object',
      additionalProperties: false,
      required: ['answers', 'cautionMode'],
      properties: { answers: safetyAnswers, cautionMode: bool },
    },
    sound: bool,
    haptics: bool,
    /** Reduced-motion override: null follows the device. Optional (added after the first release). */
    reducedMotion: nullableBool,
  },
} as const;

/** Stop ids as the content pack names them. */
export const STOP_ID_PATTERN = '^[a-z0-9-]{1,64}$';
/** Far above any content pack; keeps one document bounded. */
export const MAX_STOP_RECORDS = 2000;
/** Body budget for `PUT /me/progress`: 2000 records at their longest (about 150 B each) fit. */
export const PROGRESS_BODY_LIMIT = 320 * 1024;

/**
 * Progress along the river, v1: one record per stop the user has started or finished. Merged per
 * stop (see `mergeProgress`), so it is not a whole-document last-write-wins like the others.
 */
const progressV1 = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'updatedAt', 'stops'],
  properties: {
    ...base,
    stops: {
      type: 'object',
      maxProperties: MAX_STOP_RECORDS,
      propertyNames: { pattern: STOP_ID_PATTERN },
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        required: ['status', 'updatedAt', 'completedAt'],
        properties: {
          status: oneOf('inProgress', 'done'),
          updatedAt: { type: 'integer', minimum: 0 },
          completedAt: { type: ['integer', 'null'], minimum: 0 },
        },
      },
    },
  },
} as const;

/** JSON schema per kind and version. Add a version here to extend a document. */
export const DOCUMENT_SCHEMAS: Record<DocumentKind, Record<number, object>> = {
  onboarding: { 1: onboardingV1 },
  settings: { 1: settingsV1 },
  progress: { 1: progressV1 },
};

export const CURRENT_VERSION: Record<DocumentKind, number> = {
  onboarding: 1,
  settings: 1,
  progress: 1,
};

/** Fastify body schema for PUT: any version this server knows for the kind. */
export function bodySchemaFor(kind: DocumentKind): object {
  const versions = Object.values(DOCUMENT_SCHEMAS[kind]);
  return versions.length === 1 ? versions[0]! : { anyOf: versions };
}

/**
 * What a mood withdrawal leaves of an onboarding document: no stored first-session moods and no
 * consent. Identical documents (nothing to scrub) come back as null.
 */
export function withoutMoods(data: Doc): Doc | null {
  const first = record(data.firstSession);
  if (first.moodBefore === null && first.moodAfter === null) return null;
  return { ...data, firstSession: { ...first, moodBefore: null, moodAfter: null } };
}

const CONTROL_RE = /[\u0000-\u001f\u007f]/;

type Doc = Record<string, unknown>;
const record = (v: unknown): Doc => (v && typeof v === 'object' ? (v as Doc) : {});

/**
 * The rules a JSON schema cannot express. Throws an ApiError naming the field. Returns the
 * document to store, with `updatedAt` clamped to the server's time.
 */
export function checkDocumentRules(kind: DocumentKind, data: Doc, now: number): Doc {
  const fields: Record<string, ErrorCode> = {};
  const name = data.crocName;
  if (typeof name === 'string') {
    const trimmed = name.trim();
    const length = [...trimmed].length;
    if (trimmed !== name || length < 1 || length > CROC_NAME_MAX || CONTROL_RE.test(name)) {
      fields.crocName = 'invalid_request';
    }
  }
  if (kind === 'onboarding') {
    // Mood values are health data: they may only be stored with the user's consent.
    const first = record(data.firstSession);
    if ((first.moodBefore !== null || first.moodAfter !== null) && data.moodConsent !== true) {
      fields.firstSession = 'invalid_request';
    }
  }
  if (kind === 'progress') {
    // A finished stop knows when it was finished; an unfinished one does not.
    for (const entry of Object.values(record(data.stops))) {
      const r = record(entry);
      if ((r.status === 'done') !== (r.completedAt !== null)) fields.stops = 'invalid_request';
    }
  }
  if (Object.keys(fields).length > 0) {
    throw new ApiError(400, 'invalid_request', `The ${kind} document is not valid.`, fields);
  }
  const updatedAt = typeof data.updatedAt === 'number' ? Math.min(data.updatedAt, now) : now;
  return { ...data, updatedAt };
}

/** Steps in order, to compare how far two onboarding documents got. */
const stepIndex = (step: unknown) =>
  ONBOARDING_STEPS.indexOf(step as (typeof ONBOARDING_STEPS)[number]);

/**
 * Decides what the server keeps when a document arrives: the newer one by `updatedAt`, except
 * that onboarding completion is one way. A finished onboarding is never replaced by an unfinished
 * one (a stale tab or device), and the one-way facts of an unfinished one (hatched, named, first
 * session done, reward granted, the furthest step) are never lost to an older copy either.
 * Returns null to keep what is stored.
 */
export function resolveDocument(kind: DocumentKind, stored: Doc | null, incoming: Doc): Doc | null {
  if (kind === 'progress') {
    const merged = stored ? mergeProgress(stored, incoming) : incoming;
    // The limit holds for what is stored, not only for one request: refuse, keep what is stored.
    if (Object.keys(record(merged.stops)).length > MAX_STOP_RECORDS) {
      throw new ApiError(400, 'invalid_request', 'The progress document has too many stops.', {
        stops: 'invalid_request',
      });
    }
    return merged;
  }
  if (!stored) return incoming;
  const storedAt = Number(stored.updatedAt);
  const incomingAt = Number(incoming.updatedAt);
  if (kind !== 'onboarding') return incomingAt >= storedAt ? incoming : null;
  if (stored.completed === true && incoming.completed !== true) return null;
  if (incoming.completed === true && stored.completed !== true) return incoming;
  if (incomingAt < storedAt) return null;
  const storedFirst = record(stored.firstSession);
  const incomingFirst = record(incoming.firstSession);
  return {
    ...incoming,
    step:
      stepIndex(stored.step) > stepIndex(incoming.step) && incoming.completed !== true
        ? stored.step
        : incoming.step,
    crocHatched: incoming.crocHatched === true || stored.crocHatched === true,
    crocName: incoming.crocName ?? stored.crocName ?? null,
    firstSession: {
      ...incomingFirst,
      completed: incomingFirst.completed === true || storedFirst.completed === true,
    },
    rewardGranted: incoming.rewardGranted === true || stored.rewardGranted === true,
  };
}

type StopRecord = { status: 'inProgress' | 'done'; updatedAt: number; completedAt: number | null };

/** One stop's two records: finished beats unfinished (first completion kept), else the newer. */
function mergeStop(a: StopRecord, b: StopRecord): StopRecord {
  if (a.status === 'done' && b.status === 'done') {
    return {
      status: 'done',
      updatedAt: Math.max(a.updatedAt, b.updatedAt),
      completedAt: Math.min(a.completedAt ?? Infinity, b.completedAt ?? Infinity),
    };
  }
  if (a.status === 'done') return a;
  if (b.status === 'done') return b;
  return b.updatedAt > a.updatedAt ? b : a;
}

/**
 * Progress merges per stop, whatever the documents' timestamps: the union of both copies' stops,
 * a finished stop is never undone, and otherwise the newer record wins. Commutative and
 * idempotent, so a repeated or stale PUT changes nothing. Mirrors the app's `mergeProgress`.
 */
export function mergeProgress(stored: Doc, incoming: Doc): Doc {
  const stops: Record<string, StopRecord> = {
    ...(record(stored.stops) as Record<string, StopRecord>),
  };
  for (const [id, rec] of Object.entries(record(incoming.stops) as Record<string, StopRecord>)) {
    const mine = stops[id];
    stops[id] = mine ? mergeStop(mine, rec) : rec;
  }
  const sorted = Object.fromEntries(
    Object.keys(stops)
      .sort()
      .map((id) => [id, stops[id]!]),
  );
  return {
    version: 1,
    updatedAt: Math.max(Number(stored.updatedAt) || 0, Number(incoming.updatedAt) || 0),
    stops: sorted,
  };
}
