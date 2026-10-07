import { createJsonRequest, webIsOffline } from '@/services/http/jsonRequest';

import { AuthError, type AuthClient, type AuthResult, type AuthUser } from './types';

export interface HttpAuthClientOptions {
  baseUrl: string;
  /** This app's client id on the shared MHP user pool. */
  clientId: string;
  fetch?: typeof fetch;
  /** Abort a request after this long and report the server as unreachable. */
  timeoutMs?: number;
  /** True when the device knows it has no connection (web: navigator.onLine). */
  isOffline?: () => boolean;
}

interface WireUser {
  id: string;
  email: string;
  displayName: string | null;
  signupClient: string;
}

interface WireAuthResult {
  user: WireUser;
  tokens: {
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    refreshTokenExpiresAt: string;
  };
}

function toUser(user: WireUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? null,
    signupClient: user.signupClient,
  };
}

function toResult(body: WireAuthResult): AuthResult {
  const { tokens } = body;
  const result: AuthResult = {
    user: toUser(body.user),
    tokens: {
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: Date.parse(tokens.accessTokenExpiresAt),
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: Date.parse(tokens.refreshTokenExpiresAt),
    },
  };
  if (
    !result.user.id ||
    !result.tokens.accessToken ||
    !result.tokens.refreshToken ||
    Number.isNaN(result.tokens.accessTokenExpiresAt) ||
    Number.isNaN(result.tokens.refreshTokenExpiresAt)
  ) {
    throw new AuthError('server_error', { message: 'malformed auth response' });
  }
  return result;
}

export { webIsOffline };

/** AuthClient for the dev account service in `server/` (JSON over HTTP). */
export function createHttpAuthClient(options: HttpAuthClientOptions): AuthClient {
  const { clientId } = options;
  const request = createJsonRequest(options);

  async function authResult(path: string, body: unknown): Promise<AuthResult> {
    const res = await request<WireAuthResult>('POST', path, { body });
    if (!res) throw new AuthError('server_error');
    try {
      return toResult(res);
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('server_error', { message: 'malformed auth response' });
    }
  }

  return {
    signUp: (input) =>
      authResult('/auth/signup', {
        email: input.email,
        password: input.password,
        displayName: input.displayName ?? null,
        clientId,
      }),
    signIn: (input) =>
      authResult('/auth/signin', { email: input.email, password: input.password, clientId }),
    refresh: (refreshToken) => authResult('/auth/refresh', { refreshToken, clientId }),
    async signOut(refreshToken) {
      await request('POST', '/auth/signout', { body: { refreshToken, clientId } });
    },
    async requestPasswordReset(email) {
      await request('POST', '/auth/password-reset/request', { body: { email, clientId } });
    },
    async confirmPasswordReset(token, password) {
      await request('POST', '/auth/password-reset/confirm', {
        body: { token, password, clientId },
      });
    },
    async getProfile(accessToken) {
      const res = await request<{ user: WireUser }>('GET', '/me', { accessToken });
      if (!res?.user) throw new AuthError('server_error');
      return toUser(res.user);
    },
    async deleteAccount(accessToken, password) {
      await request('DELETE', '/me', { accessToken, body: { password } });
    },
  };
}
