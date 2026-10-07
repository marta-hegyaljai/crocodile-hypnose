import { randomUUID } from 'node:crypto';

import type { ClientId } from './clients.ts';
import { ApiError, errors } from './errors.ts';
import { createDummyHash, hashPassword, verifyPassword, type ScryptParams } from './passwords.ts';
import {
  EmailTakenError,
  type AccountRepository,
  type ClientSignIn,
  type UserRecord,
} from './storage/repository.ts';
import { generateOpaqueToken, hashOpaqueToken, type AccessTokenSigner } from './tokens.ts';
import {
  isAcceptablePassword,
  normalizeEmail,
  validateSignUp,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from './validation.ts';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  signupClient: ClientId;
  createdAt: string;
  /** Which MHP apps this account has signed in to, and when. */
  clients: { clientId: ClientId; firstSignInAt: string; lastSignInAt: string }[];
}

export interface TokenPair {
  tokenType: 'Bearer';
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface AuthResult {
  user: PublicUser;
  tokens: TokenPair;
}

export interface AuthServiceOptions {
  repo: AccountRepository;
  signer: AccessTokenSigner;
  refreshTokenTtlSeconds: number;
  /**
   * How long a just-rotated refresh token may be presented again without counting as reuse
   * (a lost response, a reload or app kill during the refresh, two tabs racing). 0 disables it.
   */
  refreshReuseGraceSeconds: number;
  passwordResetTtlSeconds: number;
  /** Base URL of the reset page the (future) email links to. */
  resetLinkBase: string;
  scrypt: ScryptParams;
  now?: () => number;
  /** Where the dev "email" goes. */
  onPasswordResetLink?: (info: { email: string; clientId: ClientId; link: string }) => void;
}

const iso = (ms: number) => new Date(ms).toISOString();

function toPublicUser(user: UserRecord, clients: ClientSignIn[]): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    signupClient: user.signupClient,
    createdAt: iso(user.createdAt),
    clients: clients.map((c) => ({
      clientId: c.clientId,
      firstSignInAt: iso(c.firstSignInAt),
      lastSignInAt: iso(c.lastSignInAt),
    })),
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

/** Account and session logic, independent of HTTP. */
export function createAuthService(options: AuthServiceOptions) {
  const { repo, signer, scrypt } = options;
  const now = options.now ?? Date.now;
  let dummyHash: Promise<string> | null = null;
  const getDummyHash = () => (dummyHash ??= createDummyHash(scrypt));

  async function publicUser(user: UserRecord): Promise<PublicUser> {
    return toPublicUser(user, await repo.listClientSignIns(user.id));
  }

  async function issueTokens(
    userId: string,
    sessionId: string,
    clientId: ClientId,
    refreshToken: string,
    refreshExpiresAt: number,
  ): Promise<TokenPair> {
    const access = await signer.sign({ userId, sessionId, clientId }, now());
    return {
      tokenType: 'Bearer',
      accessToken: access.token,
      accessTokenExpiresAt: iso(access.expiresAt),
      refreshToken,
      refreshTokenExpiresAt: iso(refreshExpiresAt),
    };
  }

  /** New session (one per sign-in on a device/app) with its first refresh token. */
  async function startSession(user: UserRecord, clientId: ClientId): Promise<AuthResult> {
    const at = now();
    const sessionId = randomUUID();
    const refreshToken = generateOpaqueToken();
    const expiresAt = at + options.refreshTokenTtlSeconds * 1000;
    await repo.createSession(
      {
        id: sessionId,
        userId: user.id,
        clientId,
        createdAt: at,
        revokedAt: null,
        revokedReason: null,
      },
      {
        id: randomUUID(),
        sessionId,
        tokenHash: hashOpaqueToken(refreshToken),
        createdAt: at,
        expiresAt,
        usedAt: null,
      },
    );
    await repo.recordClientSignIn(user.id, clientId, at);
    return {
      user: await publicUser(user),
      tokens: await issueTokens(user.id, sessionId, clientId, refreshToken, expiresAt),
    };
  }

  return {
    async signUp(input: {
      email: string;
      password: string;
      displayName?: string | null;
      clientId: ClientId;
    }): Promise<AuthResult> {
      const valid = validateSignUp(input);
      const at = now();
      const user: UserRecord = {
        id: randomUUID(),
        email: valid.email,
        passwordHash: await hashPassword(valid.password, scrypt),
        displayName: valid.displayName,
        signupClient: input.clientId,
        createdAt: at,
        updatedAt: at,
      };
      try {
        await repo.createUser(user);
      } catch (err) {
        if (err instanceof EmailTakenError) throw errors.emailTaken();
        throw err;
      }
      return startSession(user, input.clientId);
    },

    async signIn(input: {
      email: string;
      password: string;
      clientId: ClientId;
    }): Promise<AuthResult> {
      const email = normalizeEmail(input.email);
      const user = email ? await repo.findUserByEmail(email) : null;
      // Unknown email and wrong password take the same time and give the same answer.
      const ok = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyHash()));
      if (!user || !ok) throw errors.invalidCredentials();
      return startSession(user, input.clientId);
    },

    /** Exchanges a refresh token for a new pair. Presenting a used token revokes the whole session. */
    async refresh(input: { refreshToken: string; clientId: ClientId }): Promise<AuthResult> {
      const at = now();
      const current = await repo.findRefreshToken(hashOpaqueToken(input.refreshToken));
      if (!current) throw errors.invalidRefreshToken();
      const session = await repo.findSession(current.sessionId);
      if (!session || session.revokedAt !== null) throw errors.invalidRefreshToken();
      if (session.clientId !== input.clientId) throw errors.invalidRefreshToken();
      if (current.expiresAt <= at) throw errors.invalidRefreshToken();

      const user = await repo.findUserById(session.userId);
      if (!user) throw errors.invalidRefreshToken();

      const nextToken = generateOpaqueToken();
      const expiresAt = at + options.refreshTokenTtlSeconds * 1000;
      const next = {
        id: randomUUID(),
        sessionId: session.id,
        tokenHash: hashOpaqueToken(nextToken),
        createdAt: at,
        expiresAt,
        usedAt: null,
      };

      let issued = current.usedAt === null && (await repo.rotateRefreshToken(current.id, next, at));
      if (!issued) {
        // Presented again (or a concurrent request rotated it a moment ago). Within the grace
        // window, and only while the token it was exchanged for is still unused, this is a lost
        // response or a race between tabs: retire that successor and hand out a new one.
        // Anything else is reuse.
        const latest = await repo.findRefreshTokenById(current.id);
        const withinGrace =
          !!latest?.usedAt && at - latest.usedAt <= options.refreshReuseGraceSeconds * 1000;
        issued =
          withinGrace && !!latest?.replacedBy
            ? await repo.reissueRefreshToken(current.id, latest.replacedBy, next, at)
            : false;
      }
      if (!issued) {
        await repo.revokeSession(session.id, at, 'refresh_token_reused');
        throw errors.refreshTokenReused();
      }
      return {
        user: await publicUser(user),
        tokens: await issueTokens(user.id, session.id, session.clientId, nextToken, expiresAt),
      };
    },

    /** Ends the session the refresh token belongs to. Idempotent; unknown tokens are ignored. */
    async signOut(input: { refreshToken: string }): Promise<void> {
      const token = await repo.findRefreshToken(hashOpaqueToken(input.refreshToken));
      if (token) await repo.revokeSession(token.sessionId, now(), 'signed_out');
    },

    /** Always succeeds from the caller's point of view (no account enumeration). */
    async requestPasswordReset(input: { email: string; clientId: ClientId }): Promise<void> {
      const email = normalizeEmail(input.email);
      const user = email ? await repo.findUserByEmail(email) : null;
      if (!user) return;
      const at = now();
      const token = generateOpaqueToken();
      await repo.createPasswordReset({
        id: randomUUID(),
        userId: user.id,
        tokenHash: hashOpaqueToken(token),
        createdAt: at,
        expiresAt: at + options.passwordResetTtlSeconds * 1000,
      });
      const link = `${options.resetLinkBase}?token=${encodeURIComponent(token)}`;
      options.onPasswordResetLink?.({ email: user.email, clientId: input.clientId, link });
    },

    /**
     * Sets a new password with a single-use, expiring reset token. Every session of the user, in
     * every app, ends; the user signs in again with the new password.
     */
    async confirmPasswordReset(input: { token: string; password: string }): Promise<void> {
      if (!isAcceptablePassword(input.password)) {
        throw new ApiError(
          400,
          'weak_password',
          `Use at least ${PASSWORD_MIN} characters (at most ${PASSWORD_MAX}).`,
          { password: 'weak_password' },
        );
      }
      const at = now();
      const reset = await repo.findPasswordReset(hashOpaqueToken(input.token));
      if (!reset || reset.usedAt || reset.expiresAt <= at) throw errors.invalidResetToken();
      const user = await repo.findUserById(reset.userId);
      if (!user) throw errors.invalidResetToken();
      const hash = await hashPassword(input.password, scrypt);
      const done = await repo.completePasswordReset(reset.id, user.id, hash, at);
      if (!done) throw errors.invalidResetToken();
    },

    /** Resolves a bearer access token to a live session and user. */
    async authenticate(accessToken: string): Promise<{ user: UserRecord; sessionId: string }> {
      const claims = await signer.verify(accessToken, now());
      const session = await repo.findSession(claims.sessionId);
      if (!session || session.revokedAt !== null || session.userId !== claims.userId) {
        throw errors.unauthorized();
      }
      const user = await repo.findUserById(claims.userId);
      if (!user) throw errors.unauthorized();
      return { user, sessionId: session.id };
    },

    profile: publicUser,

    /** Recent-auth for destructive actions: the account's password, checked like a sign-in. */
    async confirmPassword(user: UserRecord, password: string): Promise<void> {
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) throw errors.invalidCredentials();
    },

    /** The storage behind the service, for the app-data routes (same user pool, same deletion). */
    repo,

    async deleteAccount(userId: string): Promise<void> {
      await repo.deleteUser(userId);
    },
  };
}
