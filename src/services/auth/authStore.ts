import { createStore, type StoreApi } from 'zustand/vanilla';

import type { SessionManager } from './sessionManager';
import {
  isAuthError,
  type AuthClient,
  type AuthUser,
  type SignInInput,
  type SignUpInput,
} from './types';

export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

/** One-off messages for the welcome screen after an involuntary or destructive sign-out. */
export type AuthNotice =
  | 'sessionEnded'
  /** The session ended while the user was doing something; that action did not happen. */
  | 'actionInterrupted'
  | 'accountDeleted'
  /** A new password was set: every session ended, sign in with the new password. */
  | 'passwordChanged';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  notice: AuthNotice | null;
  /** True right after a sign-up, until the home screen has celebrated it. */
  justSignedUp: boolean;

  /** Reads the stored session (no network), then checks it with the server in the background. */
  bootstrap(): Promise<void>;
  /** The actions below throw AuthError for the screen to show. */
  signIn(input: SignInInput): Promise<void>;
  signUp(input: SignUpInput): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  /** Sets a new password from a reset link. Signs out here too (the server ended every session). */
  confirmPasswordReset(token: string, password: string): Promise<void>;
  deleteAccount(): Promise<void>;
  /** Never throws: signing out always works locally, the server is told when reachable. */
  signOut(): Promise<void>;
  /** Fetches the profile. Offline or server trouble is ignored (the cached profile stays). */
  refreshProfile(): Promise<void>;
  dismissNotice(): void;
  acknowledgeSignUp(): void;
}

export type AuthStore = StoreApi<AuthState>;

export function createAuthStore({
  client,
  session,
}: {
  client: AuthClient;
  session: SessionManager;
}): AuthStore {
  const store = createStore<AuthState>()((set, get) => ({
    status: 'restoring',
    user: null,
    notice: null,
    justSignedUp: false,

    async bootstrap() {
      if (get().status !== 'restoring') return;
      const stored = await session.restore().catch(() => null);
      if (!stored) {
        set({ status: 'signedOut', user: null });
        return;
      }
      // Offline-first: the stored session signs you in straight away; the server check follows.
      set({ status: 'signedIn', user: stored.user });
      void get().refreshProfile();
    },

    async signIn(input) {
      const result = await client.signIn(input);
      await session.begin(result);
      set({ status: 'signedIn', user: result.user, notice: null, justSignedUp: false });
    },

    async signUp(input) {
      const result = await client.signUp(input);
      await session.begin(result);
      set({ status: 'signedIn', user: result.user, notice: null, justSignedUp: true });
    },

    async requestPasswordReset(email) {
      await client.requestPasswordReset(email);
    },

    async confirmPasswordReset(token, password) {
      await client.confirmPasswordReset(token, password);
      if (session.hasSession()) await session.end();
      set({ status: 'signedOut', user: null, notice: 'passwordChanged', justSignedUp: false });
    },

    async deleteAccount() {
      try {
        await session.withAccessToken((token) => client.deleteAccount(token));
      } catch (err) {
        // Never drop the user's action silently: say it did not happen.
        if (isAuthError(err) && err.code === 'session_ended' && get().status === 'signedOut') {
          set({ notice: 'actionInterrupted' });
        }
        throw err;
      }
      await session.end();
      set({ status: 'signedOut', user: null, notice: 'accountDeleted', justSignedUp: false });
    },

    async signOut() {
      await session.end({ revoke: true });
      set({ status: 'signedOut', user: null, notice: null, justSignedUp: false });
    },

    async refreshProfile() {
      if (!session.hasSession()) return;
      const askedFor = get().user?.id;
      try {
        const user = await session.withAccessToken((token) => client.getProfile(token));
        // Drop a late answer once the account on screen has changed (sign-out and sign-in as
        // someone else, here or in another tab, while the request was in flight).
        if (get().status !== 'signedIn' || get().user?.id !== askedFor || user.id !== askedFor) {
          return;
        }
        set({ user });
        await session.rememberUser(user);
      } catch (err) {
        // session_ended is handled by the subscription below; connectivity problems are fine offline.
        if (
          __DEV__ &&
          !(isAuthError(err) && (err.isConnectivity || err.code === 'session_ended'))
        ) {
          console.warn('[auth] profile refresh failed', err);
        }
      }
    },

    dismissNotice() {
      set({ notice: null });
    },

    acknowledgeSignUp() {
      set({ justSignedUp: false });
    },
  }));

  session.subscribe((event) => {
    const state = store.getState();
    if (event.type === 'signedIn') {
      // Another tab signed in: follow it.
      store.setState({ status: 'signedIn', user: event.user, notice: null, justSignedUp: false });
    } else if (event.type === 'ended') {
      if (state.status === 'signedIn') {
        store.setState({
          status: 'signedOut',
          user: null,
          notice: 'sessionEnded',
          justSignedUp: false,
        });
      }
    } else if (state.status === 'signedIn' && state.user?.id === event.user.id) {
      store.setState({ user: event.user });
    }
  });

  return store;
}
