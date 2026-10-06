import { AuthError } from '@/services/auth/types';
import { createJsonRequest, type JsonRequestOptions } from '@/services/http/jsonRequest';

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
}

/**
 * Transport for the per-user documents. `get` resolves null when the server has none; `put`
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
}

const validators: { [K in DocumentKind]: (value: unknown) => value is DocumentTypes[K] } = {
  onboarding: isOnboardingDoc,
  settings: isSettingsDoc,
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

  return {
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
