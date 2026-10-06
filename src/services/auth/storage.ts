import type { AuthUser } from './types';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  /**
   * Changes made by another instance sharing this storage (web: another tab, via the `storage`
   * event). Optional: native has a single instance.
   */
  subscribe?(key: string, listener: (value: string | null) => void): () => void;
}

/** What survives an app restart: the refresh token and the last known profile (for offline start). */
export interface StoredSession {
  refreshToken: string;
  refreshTokenExpiresAt: number;
  user: AuthUser;
}

export interface SessionStore {
  load(): Promise<StoredSession | null>;
  save(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
  /** Another tab saved or cleared the session. */
  subscribe?(listener: (session: StoredSession | null) => void): () => void;
}

export const SESSION_KEY = 'mhp.hypnose.session.v1';

function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const user = v.user as Record<string, unknown> | undefined;
  return (
    typeof v.refreshToken === 'string' &&
    v.refreshToken.length > 0 &&
    typeof v.refreshTokenExpiresAt === 'number' &&
    !!user &&
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    (user.displayName === null || typeof user.displayName === 'string') &&
    typeof user.signupClient === 'string'
  );
}

/** JSON session record on top of a key-value store. Corrupt or expired records are dropped. */
export function createSessionStore(
  storage: KeyValueStorage,
  options: { key?: string; now?: () => number } = {},
): SessionStore {
  const key = options.key ?? SESSION_KEY;
  const now = options.now ?? Date.now;
  const parse = (raw: string | null): StoredSession | null => {
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isStoredSession(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };
  return {
    async load() {
      let raw: string | null;
      try {
        raw = await storage.getItem(key);
      } catch {
        return null;
      }
      if (!raw) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isStoredSession(parsed) && parsed.refreshTokenExpiresAt > now()) return parsed;
      } catch {
        // Corrupt: fall through and clear.
      }
      await storage.removeItem(key).catch(() => undefined);
      return null;
    },
    async save(session) {
      await storage.setItem(key, JSON.stringify(session));
    },
    async clear() {
      await storage.removeItem(key);
    },
    subscribe: storage.subscribe
      ? (listener) => storage.subscribe!(key, (raw) => listener(parse(raw)))
      : undefined,
  };
}
