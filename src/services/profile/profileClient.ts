import { AuthError } from '@/services/auth/types';
import { createJsonRequest, type JsonRequestOptions } from '@/services/http/jsonRequest';

import {
  isMoodEntry,
  isSessionCompletedEvent,
  type MoodEntry,
  type SessionCompletedEvent,
} from '@/services/events/types';
import { isProgressDoc, type ProgressDoc } from '@/services/progress/types';

import {
  isOnboardingDoc,
  isSettingsDoc,
  stripServerFields,
  type DocumentKind,
  type OnboardingDoc,
  type SettingsDoc,
} from './types';

export interface DocumentTypes {
  onboarding: OnboardingDoc;
  settings: SettingsDoc;
  progress: ProgressDoc;
}

/** The append-only streams and their events (`GET/POST /me/events`, `/me/mood`). */
export interface StreamTypes {
  events: SessionCompletedEvent;
  mood: MoodEntry;
}
export type StreamKind = keyof StreamTypes;

/**
 * Transport for the per-user documents and event streams. `get` resolves null when the server has none; `put`
 * resolves what the server stores afterwards (the sent document, or a newer one it already had).
 * Both throw AuthError (offline, unreachable, unauthorized, invalid_request...).
 */
export interface ProfileClient {
  get<K extends DocumentKind>(kind: K, accessToken: string): Promise<DocumentTypes[K] | null>;
  put<K extends DocumentKind>(
    kind: K,
    doc: DocumentTypes[K],
    accessToken: string,
  ): Promise<DocumentTypes[K]>;
  /** The stream's latest events (as the server stored them). */
  listEvents<S extends StreamKind>(stream: S, accessToken: string): Promise<StreamTypes[S][]>;
  /** Appends events; resolves what the server stored for each (a known id keeps its version). */
  appendEvents<S extends StreamKind>(
    stream: S,
    items: StreamTypes[S][],
    accessToken: string,
  ): Promise<StreamTypes[S][]>;
  /** Deletes the user's mood data on the server (`DELETE /me/mood`). */
  deleteMood(accessToken: string): Promise<void>;
  /** Everything the server holds about the user (`GET /me/export`), as parsed JSON. */
  exportData(accessToken: string): Promise<unknown>;
}

const streamField: Record<StreamKind, string> = { events: 'events', mood: 'entries' };
const streamValidators: { [S in StreamKind]: (value: unknown) => value is StreamTypes[S] } = {
  events: isSessionCompletedEvent,
  mood: isMoodEntry,
};

const validators: { [K in DocumentKind]: (value: unknown) => value is DocumentTypes[K] } = {
  onboarding: isOnboardingDoc,
  settings: isSettingsDoc,
  progress: isProgressDoc,
};

/** ProfileClient for the dev server in `server/`. */
export function createHttpProfileClient(options: JsonRequestOptions): ProfileClient {
  const request = createJsonRequest(options);

  function parse<K extends DocumentKind>(kind: K, body: unknown): DocumentTypes[K] | null {
    const raw = (body as Record<string, unknown> | undefined)?.[kind];
    if (raw === null) return null;
    if (!raw || typeof raw !== 'object') {
      throw new AuthError('server_error', { message: `malformed ${kind} document` });
    }
    const doc = stripServerFields(raw as DocumentTypes[K] & { storedAt?: unknown });
    if (!validators[kind](doc)) {
      // A shape this app version does not know (e.g. a newer schema): treat it as absent rather
      // than crash. The server keeps it; a newer app will read it.
      return null;
    }
    return doc;
  }

  function parseStream<S extends StreamKind>(stream: S, body: unknown): StreamTypes[S][] {
    const raw = (body as Record<string, unknown> | undefined)?.[streamField[stream]];
    if (!Array.isArray(raw)) {
      throw new AuthError('server_error', { message: `malformed ${stream} answer` });
    }
    // Events of a shape this app version does not know are left out (the server keeps them).
    return raw
      .map((item): unknown => {
        const { storedAt: _storedAt, ...rest } = (item ?? {}) as Record<string, unknown>;
        return rest;
      })
      .filter((item): item is StreamTypes[S] => streamValidators[stream](item));
  }

  return {
    async deleteMood(accessToken) {
      await request('DELETE', '/me/mood', { accessToken });
    },
    async exportData(accessToken) {
      const body = await request<unknown>('GET', '/me/export', { accessToken });
      if (!body || typeof body !== 'object') throw new AuthError('server_error');
      return body;
    },
    async listEvents(stream, accessToken) {
      return parseStream(stream, await request('GET', `/me/${stream}`, { accessToken }));
    },
    async appendEvents(stream, items, accessToken) {
      const body = await request('POST', `/me/${stream}`, {
        body: { [streamField[stream]]: items },
        accessToken,
      });
      return parseStream(stream, body);
    },
    async get(kind, accessToken) {
      const body = await request('GET', `/me/${kind}`, { accessToken });
      return parse(kind, body);
    },
    async put(kind, doc, accessToken) {
      const body = await request('PUT', `/me/${kind}`, { body: doc, accessToken });
      const stored = parse(kind, body);
      if (!stored) throw new AuthError('server_error', { message: `malformed ${kind} answer` });
      return stored;
    },
  };
}
