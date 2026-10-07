/**
 * Append-only per-user event streams. Unlike the documents, events are never rewritten: each has
 * a client-made id, so the app can send an event again (a retry, another tab) and it is stored
 * once.
 *
 * - `events`: "session completed" and "game completed" events, the input of the points ledger.
 *   A completion's stop type and whether it is the stop's first one are decided here, from the
 *   server's content and what is stored, never from the client's claim. The ledger itself pays
 *   once per key (see `gamification.ts`), so this flag is only what the app shows.
 * - `mood`: mood check-ins before and after a session. Health data: stored only while the user
 *   has agreed to it in their settings (or, before settings exist, in onboarding).
 */
import { ApiError } from './errors.ts';
import { serverContent } from './content.ts';
import { STOP_ID_PATTERN } from './documents.ts';
import type { EventRecord } from './storage/repository.ts';
import { GAME_KINDS } from '../../src/services/gamification/shared/rules.ts';

export const EVENT_STREAMS = ['events', 'mood'] as const;
export type EventStream = (typeof EVENT_STREAMS)[number];

/** Events per request. */
export const MAX_EVENTS_PER_REQUEST = 50;
/** Events kept per user and stream; far above years of daily use. */
export const MAX_EVENTS_PER_STREAM = 20_000;
/** How many of the latest events a read returns. */
export const EVENTS_READ_LIMIT = 1000;

export const EVENT_ID_PATTERN = '^[A-Za-z0-9_-]{8,64}$';
export const STOP_TYPES = ['video', 'audio', 'visual', 'game', 'longTrance'] as const;

const time = { type: 'integer', minimum: 0 } as const;

const sessionCompleted = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'type', 'stopId', 'stopType', 'at', 'firstTime'],
  properties: {
    id: { type: 'string', pattern: EVENT_ID_PATTERN },
    type: { type: 'string', const: 'sessionCompleted' },
    stopId: { type: 'string', pattern: STOP_ID_PATTERN },
    stopType: { type: 'string', enum: STOP_TYPES },
    at: time,
    /** The app's guess; the server decides it from what is stored. */
    firstTime: { type: 'boolean' },
  },
} as const;

/** A mini-game played through (from the clearing or a map stop). */
const gameCompleted = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'type', 'gameId', 'at'],
  properties: {
    id: { type: 'string', pattern: EVENT_ID_PATTERN },
    type: { type: 'string', const: 'gameCompleted' },
    gameId: { type: 'string', enum: GAME_KINDS },
    at: time,
  },
} as const;

const moodEntry = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'at', 'phase', 'value', 'stopId'],
  properties: {
    id: { type: 'string', pattern: EVENT_ID_PATTERN },
    at: time,
    phase: { type: 'string', enum: ['before', 'after'] },
    value: { type: 'integer', minimum: 1, maximum: 5 },
    stopId: { type: ['string', 'null'], pattern: STOP_ID_PATTERN },
  },
} as const;

/** The request body per stream: `{ <field>: [...] }`. */
export const STREAM_FIELD: Record<EventStream, string> = { events: 'events', mood: 'entries' };

export function bodySchemaForStream(stream: EventStream): object {
  const field = STREAM_FIELD[stream];
  return {
    type: 'object',
    additionalProperties: false,
    required: [field],
    properties: {
      [field]: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_EVENTS_PER_REQUEST,
        items: stream === 'events' ? { anyOf: [sessionCompleted, gameCompleted] } : moodEntry,
      },
    },
  };
}

type Data = Record<string, unknown>;

/**
 * What the server stores for a new event: the time clamped like documents' `updatedAt` (a fast
 * clock cannot date events in the future), and for a session completion, the first-time flag as
 * the stored stream allows it.
 */
export function decideEvent(
  stream: EventStream,
  event: EventRecord,
  stored: EventRecord[],
): EventRecord {
  if (stored.length >= MAX_EVENTS_PER_STREAM) {
    throw new ApiError(400, 'invalid_request', 'Too many events stored.', {
      [STREAM_FIELD[stream]]: 'invalid_request',
    });
  }
  if (stream !== 'events' || event.data.type !== 'sessionCompleted') return event;
  // The stop's type and the first-time flag come from the server's content and stored events.
  // A stop the content does not know is stored (so the app's stream keeps syncing) but earns
  // nothing: the ledger skips it.
  const stopId = event.data.stopId;
  const stop = serverContent().stops[String(stopId)];
  const firstTime =
    !!stop && !stored.some((e) => e.data.type === 'sessionCompleted' && e.data.stopId === stopId);
  return {
    ...event,
    data: { ...event.data, stopType: stop?.type ?? event.data.stopType, firstTime },
  };
}

/** The incoming items as records to append, their times clamped to the server's clock. */
export function toRecords(
  userId: string,
  stream: EventStream,
  items: Data[],
  now: number,
): EventRecord[] {
  const seen = new Set<string>();
  const records: EventRecord[] = [];
  for (const item of items) {
    const id = String(item.id);
    // The same id twice in one call is one event.
    if (seen.has(id)) continue;
    seen.add(id);
    const at = Math.min(Number(item.at), now);
    records.push({ userId, stream, id, data: { ...item, at }, at, storedAt: now });
  }
  return records;
}

/** What the app sees of a stored event: its body plus when the server stored it. */
export function wireEvent(record: EventRecord): Data {
  return { ...record.data, storedAt: record.storedAt };
}
