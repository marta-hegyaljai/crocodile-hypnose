import { createMutex, type Lock } from './lock';
import type { SessionStore, StoredSession } from './storage';
import { AuthError, isAuthError, type AuthClient, type AuthResult, type AuthUser } from './types';

export type SessionEvent =
  /** The session is over: refused by the server, or signed out in another tab. */
  | { type: 'ended' }
  /** The profile changed (fresh from the server). */
  | { type: 'user'; user: AuthUser }
  /** Another tab signed in (or switched account): this instance now uses that session. */
  | { type: 'signedIn'; user: AuthUser };

export interface SessionManager {
  /** Loads the stored session from the device. No network. */
  restore(): Promise<StoredSession | null>;
  /** Keeps a fresh session from sign-in or sign-up. */
  begin(result: AuthResult): Promise<void>;
  /**
   * Runs `fn` with a valid access token. Refreshes first when there is none (e.g. after a restart)
   * or it is about to expire, and once more when the server answers 401.
   */
  withAccessToken<T>(fn: (accessToken: string) => Promise<T>): Promise<T>;
  /** Exchanges the refresh token. Concurrent callers (and, on web, tabs) share one exchange. */
  refresh(): Promise<AuthResult>;
  /** Forgets the session locally; with `revoke`, also ends it on the server (best effort). */
  end(options?: { revoke?: boolean }): Promise<void>;
  /** Updates the cached profile. */
  rememberUser(user: AuthUser): Promise<void>;
  hasSession(): boolean;
  subscribe(listener: (event: SessionEvent) => void): () => void;
}

export interface SessionManagerOptions {
  client: AuthClient;
  store: SessionStore;
  now?: () => number;
  /** Refresh this long before the access token expires. */
  expirySkewMs?: number;
  /**
   * Held while the refresh token is read and exchanged. On web this is a cross-tab lock, so only
   * one tab rotates the token at a time. Defaults to an in-process lock.
   */
  lock?: Lock;
}

/**
 * Keeps the session: the refresh token (persisted) and the access token (memory only).
 *
 * The refresh token is shared with other instances through the store (other tabs on web, the
 * previous launch on native). Every refresh therefore re-reads the store first and adopts a newer
 * token another instance already rotated, persists the new token before anyone uses it, and only
 * clears the store when the token the server refused is still the stored one.
 */
export function createSessionManager({
  client,
  store,
  now = Date.now,
  expirySkewMs = 30_000,
  lock = createMutex(),
}: SessionManagerOptions): SessionManager {
  let stored: StoredSession | null = null;
  let access: { token: string; expiresAt: number } | null = null;
  let inflight: Promise<AuthResult> | null = null;
  // Bumped whenever the session is replaced or ended, so a late refresh can't resurrect it.
  let generation = 0;
  const listeners = new Set<(event: SessionEvent) => void>();
  const emit = (event: SessionEvent) => listeners.forEach((l) => l(event));

  const validAccess = () =>
    access && access.expiresAt - expirySkewMs > now() ? access.token : null;

  async function persist(next: StoredSession) {
    stored = next;
    try {
      await store.save(next);
    } catch (err) {
      // The in-memory session still works; the next launch may need a fresh sign-in.
      if (__DEV__) console.warn('[auth] could not persist the session', err);
    }
  }

  function keep(result: AuthResult) {
    access = { token: result.tokens.accessToken, expiresAt: result.tokens.accessTokenExpiresAt };
    return persist({
      refreshToken: result.tokens.refreshToken,
      refreshTokenExpiresAt: result.tokens.refreshTokenExpiresAt,
      user: result.user,
    });
  }

  /** Forget the session in memory; clear the store only if it still holds `refusedToken` (or always, without one). */
  async function endLocally(refusedToken?: string) {
    generation += 1;
    const previous = stored;
    stored = null;
    access = null;
    inflight = null;
    try {
      if (refusedToken === undefined) {
        await store.clear();
      } else {
        const latest = await store.load();
        if (!latest || latest.refreshToken === refusedToken) await store.clear();
      }
    } catch {
      // Nothing more to do.
    }
    return previous;
  }

  /** Adopt what another instance stored. Returns false when the store is empty (signed out there). */
  function adopt(latest: StoredSession | null): boolean {
    if (!latest) return false;
    if (stored && latest.user.id !== stored.user.id) access = null;
    stored = latest;
    return true;
  }

  async function readStore(): Promise<StoredSession | null> {
    try {
      return await store.load();
    } catch {
      return stored; // Unreadable: keep using what we have.
    }
  }

  /**
   * The store now holds another account's session (another tab signed out and in as someone
   * else, and this instance missed the event): switch to it, and fail the request that was made
   * for the previous account rather than answering it with the new account's tokens.
   */
  function switchedAccount(latest: StoredSession): never {
    generation += 1;
    stored = latest;
    access = null;
    inflight = null;
    emit({ type: 'signedIn', user: latest.user });
    throw new AuthError('session_ended');
  }

  async function exchange(startedIn: number): Promise<AuthResult> {
    const userId = stored?.user.id;
    // Inside the lock: another tab or an earlier launch may have rotated the token meanwhile.
    const initial = await readStore();
    if (initial && userId && initial.user.id !== userId) switchedAccount(initial);
    if (!adopt(initial)) {
      if (startedIn === generation) {
        generation += 1;
        stored = null;
        access = null;
        emit({ type: 'ended' });
      }
      throw new AuthError('session_ended');
    }
    for (let attempt = 0; ; attempt++) {
      if (startedIn !== generation || !stored) throw new AuthError('session_ended');
      const presented = stored.refreshToken;
      let result: AuthResult;
      try {
        result = await client.refresh(presented);
      } catch (err) {
        if (!isAuthError(err) || err.code !== 'session_ended') throw err;
        if (startedIn !== generation) throw err;
        // Refused. If another instance stored a newer token meanwhile (no shared lock, or it was
        // rotated while we waited on the network), that one is the live session: try it once.
        const latest = await readStore();
        if (attempt === 0 && latest && latest.refreshToken !== presented) {
          if (userId && latest.user.id !== userId) switchedAccount(latest);
          adopt(latest);
          continue;
        }
        await endLocally(presented);
        emit({ type: 'ended' });
        throw err;
      }
      if (startedIn !== generation || (userId && result.user.id !== userId)) {
        throw new AuthError('session_ended');
      }
      // Persist before anything uses the new pair, so a crash or reload never strands it.
      await keep(result);
      emit({ type: 'user', user: result.user });
      return result;
    }
  }

  // Another tab changed the stored session.
  store.subscribe?.((latest) => {
    if (!latest) {
      if (!stored) return;
      generation += 1;
      stored = null;
      access = null;
      inflight = null;
      emit({ type: 'ended' });
      return;
    }
    const wasSignedOut = !stored;
    const switched = !!stored && stored.user.id !== latest.user.id;
    adopt(latest);
    if (wasSignedOut || switched) {
      generation += 1;
      access = null;
      emit({ type: 'signedIn', user: latest.user });
    }
  });

  const manager: SessionManager = {
    async restore() {
      stored = await store.load();
      access = null;
      return stored;
    },

    async begin(result) {
      generation += 1;
      inflight = null;
      await keep(result);
    },

    refresh() {
      if (inflight) return inflight;
      if (!stored) return Promise.reject(new AuthError('session_ended'));
      const startedIn = generation;
      const attempt = lock(() => exchange(startedIn)).finally(() => {
        if (inflight === attempt) inflight = null;
      });
      inflight = attempt;
      return attempt;
    },

    async withAccessToken(fn) {
      const token = validAccess() ?? (await manager.refresh()).tokens.accessToken;
      try {
        return await fn(token);
      } catch (err) {
        if (!isAuthError(err) || err.code !== 'unauthorized') throw err;
      }
      // 401: another call may already have refreshed; otherwise refresh now. Then try once more.
      const current = validAccess();
      const retryToken =
        current && current !== token ? current : (await manager.refresh()).tokens.accessToken;
      try {
        return await fn(retryToken);
      } catch (err) {
        if (isAuthError(err) && err.code === 'unauthorized') {
          // A brand-new token was refused: the account or session is gone.
          await endLocally();
          emit({ type: 'ended' });
          throw new AuthError('session_ended', { status: err.status });
        }
        throw err;
      }
    },

    async end({ revoke = false } = {}) {
      const previous = await endLocally();
      if (revoke && previous) {
        // Fire and forget: signing out never waits on (or fails because of) the network.
        client.signOut(previous.refreshToken).catch(() => undefined);
      }
    },

    rememberUser(user) {
      // Under the lock and against the latest stored token: never write back a stale token.
      return lock(async () => {
        if (!stored) return;
        adopt(await readStore());
        // A profile for another account (a late answer from before an account switch) is dropped.
        if (stored && stored.user.id === user.id) await persist({ ...stored, user });
      });
    },

    hasSession: () => stored !== null,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return manager;
}
