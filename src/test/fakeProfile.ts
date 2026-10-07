/**
 * Test double for the profile transport: an in-memory ProfileClient with the dev server's
 * last-write-wins behaviour, per user (the access token stands for the user, as the fake auth
 * client issues `access-N` tokens; pass a `userOf` mapping when that matters).
 */
import { AuthError } from '@/services/auth/types';
import type {
  DocumentTypes,
  ProfileClient,
  StreamKind,
  StreamTypes,
} from '@/services/profile/profileClient';
import type { DocumentKind } from '@/services/profile/types';
import { mergeProgress } from '@/services/progress/mergeProgress';
import type { ProgressDoc } from '@/services/progress/types';

export interface FakeProfileClient extends ProfileClient {
  /** Stored documents by `${user}:${kind}`. */
  documents: Map<string, DocumentTypes[DocumentKind]>;
  calls: { get: number; put: number; append: number; deleteMood: number };
  /** Stored events by `${user}:${stream}`, in arrival order. */
  streams: Map<string, StreamTypes[StreamKind][]>;
  /** Make every call fail until cleared. */
  failAll(error: AuthError | null): void;
  /** Hold every call until `release()` is called (to test waiting on the server). */
  hold(): { release(): void };
  /** Seeds a document for a user. */
  seed<K extends DocumentKind>(user: string, kind: K, doc: DocumentTypes[K]): void;
}

export function createFakeProfileClient(
  options: { userOf?: (accessToken: string) => string } = {},
): FakeProfileClient {
  const userOf = options.userOf ?? (() => 'user-1');
  const documents = new Map<string, DocumentTypes[DocumentKind]>();
  const calls = { get: 0, put: 0, append: 0, deleteMood: 0 };
  const streams = new Map<string, StreamTypes[StreamKind][]>();
  let allError: AuthError | null = null;
  let gate: Promise<void> | null = null;
  let open: (() => void) | null = null;

  async function pass() {
    if (gate) await gate;
    if (allError) throw allError;
  }

  return {
    documents,
    calls,
    streams,
    async deleteMood(accessToken) {
      calls.deleteMood += 1;
      await pass();
      streams.delete(`${userOf(accessToken)}:mood`);
    },
    async exportData(accessToken) {
      await pass();
      const user = userOf(accessToken);
      return {
        documents: Object.fromEntries(
          [...documents]
            .filter(([k]) => k.startsWith(`${user}:`))
            .map(([k, v]) => [k.slice(user.length + 1), v]),
        ),
        sessionEvents: streams.get(`${user}:events`) ?? [],
        moodEntries: streams.get(`${user}:mood`) ?? [],
      };
    },
    async listEvents(stream, accessToken) {
      await pass();
      return [...(streams.get(`${userOf(accessToken)}:${stream}`) ?? [])] as never;
    },
    async appendEvents(stream, items, accessToken) {
      calls.append += 1;
      await pass();
      const key = `${userOf(accessToken)}:${stream}`;
      const list = streams.get(key) ?? [];
      streams.set(key, list);
      // Like the server: a known id keeps its version; a first-time claim holds once per stop.
      return items.map((item) => {
        const known = list.find((e) => e.id === item.id);
        if (known) return known;
        let stored = item as StreamTypes[StreamKind];
        if ('firstTime' in item && item.firstTime) {
          const taken = list.some(
            (e) => 'firstTime' in e && e.firstTime && e.stopId === item.stopId,
          );
          stored = { ...item, firstTime: !taken };
        }
        list.push(stored);
        return stored;
      }) as never;
    },
    failAll(error) {
      allError = error;
    },
    hold() {
      gate = new Promise((r) => {
        open = r;
      });
      return {
        release: () => {
          open?.();
          gate = null;
          open = null;
        },
      };
    },
    seed(user, kind, doc) {
      documents.set(`${user}:${kind}`, doc);
    },
    async get(kind, accessToken) {
      calls.get += 1;
      await pass();
      const doc = documents.get(`${userOf(accessToken)}:${kind}`);
      return (doc as DocumentTypes[typeof kind] | undefined) ?? null;
    },
    async put(kind, doc, accessToken) {
      calls.put += 1;
      await pass();
      const key = `${userOf(accessToken)}:${kind}`;
      const current = documents.get(key);
      if (kind === 'progress') {
        // The server merges progress per stop.
        const merged = current
          ? mergeProgress(current as ProgressDoc, doc as ProgressDoc)
          : (doc as ProgressDoc);
        documents.set(key, merged);
        return { ...merged } as DocumentTypes[typeof kind];
      }
      if (current && current.updatedAt > doc.updatedAt) {
        return current as DocumentTypes[typeof kind];
      }
      documents.set(key, { ...doc });
      return { ...doc };
    },
  };
}
