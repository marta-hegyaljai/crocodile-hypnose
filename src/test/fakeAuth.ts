/**
 * Test doubles for the auth layer: an in-memory AuthClient that behaves like the dev server
 * (rotation, reuse, expiry, deletion) and an in-memory key-value store.
 */
import type { KeyValueStorage } from '@/services/auth/storage';
import { AuthError, type AuthClient, type AuthResult, type AuthUser } from '@/services/auth/types';

export function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
  };
}

/**
 * One storage shared by several instances (like localStorage across tabs). Each `view()` is one
 * tab: writes through a view notify the other views' subscribers, as the `storage` event does.
 */
export function sharedStorage() {
  const data = new Map<string, string>();
  const views: { listeners: Set<(key: string, value: string | null) => void> }[] = [];
  function notifyOthers(from: (typeof views)[number], key: string, value: string | null) {
    for (const v of views) if (v !== from) v.listeners.forEach((l) => l(key, value));
  }
  return {
    data,
    view(): KeyValueStorage {
      const self = { listeners: new Set<(key: string, value: string | null) => void>() };
      views.push(self);
      return {
        getItem: async (key) => data.get(key) ?? null,
        setItem: async (key, value) => {
          data.set(key, value);
          notifyOthers(self, key, value);
        },
        removeItem: async (key) => {
          data.delete(key);
          notifyOthers(self, key, null);
        },
        subscribe(key, listener) {
          const l = (k: string, v: string | null) => {
            if (k === key) listener(v);
          };
          self.listeners.add(l);
          return () => self.listeners.delete(l);
        },
      };
    },
  };
}

interface FakeAccount {
  user: AuthUser;
  password: string;
}

export interface FakeAuthClient extends AuthClient {
  accounts: Map<string, FakeAccount>;
  /** Make the next call (of any method) fail with this error. */
  failNext(error: AuthError): void;
  /** Make every call fail until cleared (null). */
  failAll(error: AuthError | null): void;
  /** Revoke every refresh token (as if the session was ended elsewhere). */
  revokeAll(): void;
  /** Expire every access token. */
  expireAccessTokens(): void;
  /** A password reset token for the account, as the emailed link would carry. */
  issueResetToken(email: string): string;
  calls: Record<keyof AuthClient, number>;
  clock: { now: number };
}

export function createFakeAuthClient(
  options: {
    accessTtlMs?: number;
    delayMs?: number;
    /** Presenting a used refresh token revokes all of the user's tokens (default), or only fails. */
    reuseRevokes?: boolean;
  } = {},
): FakeAuthClient {
  const accessTtlMs = options.accessTtlMs ?? 15 * 60_000;
  const accounts = new Map<string, FakeAccount>();
  const access = new Map<string, { userId: string; expiresAt: number }>();
  const refresh = new Map<string, { userId: string; used: boolean; revoked: boolean }>();
  const clock = { now: Date.now() };
  const resets = new Map<string, string>();
  let counter = 0;
  let nextError: AuthError | null = null;
  let allError: AuthError | null = null;
  const calls = {
    signUp: 0,
    signIn: 0,
    refresh: 0,
    signOut: 0,
    requestPasswordReset: 0,
    confirmPasswordReset: 0,
    getProfile: 0,
    deleteAccount: 0,
  };

  async function gate(method: keyof AuthClient) {
    calls[method] += 1;
    if (options.delayMs) await new Promise((r) => setTimeout(r, options.delayMs));
    if (allError) throw allError;
    if (nextError) {
      const err = nextError;
      nextError = null;
      throw err;
    }
  }

  function issue(user: AuthUser): AuthResult {
    counter += 1;
    const accessToken = `access-${counter}`;
    const refreshToken = `refresh-${counter}`;
    access.set(accessToken, { userId: user.id, expiresAt: clock.now + accessTtlMs });
    refresh.set(refreshToken, { userId: user.id, used: false, revoked: false });
    return {
      user: { ...user },
      tokens: {
        accessToken,
        accessTokenExpiresAt: clock.now + accessTtlMs,
        refreshToken,
        refreshTokenExpiresAt: clock.now + 30 * 24 * 3600_000,
      },
    };
  }

  function userById(id: string) {
    for (const a of accounts.values()) if (a.user.id === id) return a;
    return null;
  }

  function checkAccess(token: string) {
    const entry = access.get(token);
    if (!entry || entry.expiresAt <= clock.now || !userById(entry.userId)) {
      throw new AuthError('unauthorized', { status: 401 });
    }
    return userById(entry.userId)!;
  }

  return {
    accounts,
    calls,
    clock,
    failNext(error) {
      nextError = error;
    },
    failAll(error) {
      allError = error;
    },
    revokeAll() {
      for (const r of refresh.values()) r.revoked = true;
      access.clear();
    },
    expireAccessTokens() {
      for (const a of access.values()) a.expiresAt = 0;
    },
    issueResetToken(email) {
      const token = `reset-${resets.size + 1}`;
      resets.set(token, email);
      return token;
    },

    async signUp(input) {
      await gate('signUp');
      const email = input.email.trim().toLowerCase();
      if (accounts.has(email)) {
        throw new AuthError('email_taken', { status: 409, fields: { email: 'email_taken' } });
      }
      const user: AuthUser = {
        id: `user-${accounts.size + 1}`,
        email,
        displayName: input.displayName?.trim() || null,
        signupClient: 'mhp-hypnose',
      };
      accounts.set(email, { user, password: input.password });
      return issue(user);
    },
    async signIn(input) {
      await gate('signIn');
      const account = accounts.get(input.email.trim().toLowerCase());
      if (!account || account.password !== input.password) {
        throw new AuthError('invalid_credentials', { status: 401 });
      }
      return issue(account.user);
    },
    async refresh(token) {
      await gate('refresh');
      const entry = refresh.get(token);
      if (!entry || entry.revoked || !userById(entry.userId)) {
        throw new AuthError('session_ended', { status: 401 });
      }
      if (entry.used) {
        if (options.reuseRevokes !== false) {
          for (const r of refresh.values()) if (r.userId === entry.userId) r.revoked = true;
        }
        throw new AuthError('session_ended', { status: 401 });
      }
      entry.used = true;
      return issue(userById(entry.userId)!.user);
    },
    async signOut(token) {
      await gate('signOut');
      const entry = refresh.get(token);
      if (entry) entry.revoked = true;
    },
    async requestPasswordReset() {
      await gate('requestPasswordReset');
    },
    async confirmPasswordReset(token, password) {
      await gate('confirmPasswordReset');
      const email = resets.get(token);
      const account = email ? accounts.get(email) : undefined;
      if (!account) throw new AuthError('invalid_reset_token', { status: 400 });
      if (password.length < 8) {
        throw new AuthError('weak_password', {
          status: 400,
          fields: { password: 'weak_password' },
        });
      }
      resets.delete(token);
      account.password = password;
      for (const r of refresh.values()) if (r.userId === account.user.id) r.revoked = true;
      access.clear();
    },
    async getProfile(token) {
      await gate('getProfile');
      return { ...checkAccess(token).user };
    },
    async deleteAccount(token, password) {
      await gate('deleteAccount');
      const account = checkAccess(token);
      if (account.password !== password) {
        throw new AuthError('invalid_credentials', { status: 401 });
      }
      accounts.delete(account.user.email);
    },
  };
}
