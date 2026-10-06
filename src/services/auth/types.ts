/**
 * The app's view of the shared MHP account service. The UI and the auth store only depend on
 * these types and the `AuthClient` interface, so the dev HTTP client can later be swapped for an
 * OIDC (Authorization Code + PKCE) adapter without touching screens.
 */

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  /** The MHP app the account was created in ("mhp-coaching" or "mhp-hypnose"). */
  signupClient: string;
}

export interface AuthTokens {
  accessToken: string;
  /** Epoch milliseconds. */
  accessTokenExpiresAt: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName?: string | null;
}

export interface SignInInput {
  email: string;
  password: string;
}

/** Stateless transport to the account service. Token bookkeeping lives in the session manager. */
export interface AuthClient {
  signUp(input: SignUpInput): Promise<AuthResult>;
  signIn(input: SignInInput): Promise<AuthResult>;
  /** Exchanges the refresh token for a new pair (the old one stops working). */
  refresh(refreshToken: string): Promise<AuthResult>;
  /** Ends the server-side session. */
  signOut(refreshToken: string): Promise<void>;
  /** Always resolves for any well-formed request (no account enumeration). */
  requestPasswordReset(email: string): Promise<void>;
  /** Sets a new password with the token from a reset link. Ends every session of the account. */
  confirmPasswordReset(token: string, password: string): Promise<void>;
  getProfile(accessToken: string): Promise<AuthUser>;
  /** Deletes the MHP account and all MHP Hypnose data. */
  deleteAccount(accessToken: string): Promise<void>;
}

export type AuthErrorCode =
  /** Wrong password or unknown email (deliberately the same). */
  | 'invalid_credentials'
  | 'email_taken'
  | 'invalid_email'
  | 'weak_password'
  | 'invalid_display_name'
  | 'invalid_request'
  /** The reset link is unknown, used or expired. */
  | 'invalid_reset_token'
  /** The access token was refused (expired, revoked, account gone). */
  | 'unauthorized'
  /** The refresh token was refused: the session is over and the user must sign in again. */
  | 'session_ended'
  | 'rate_limited'
  /** The device has no network connection. */
  | 'offline'
  /** The server could not be reached or did not answer in time. */
  | 'unreachable'
  /** The server answered with a 5xx or something that is not our JSON. */
  | 'server_error'
  | 'unknown';

/** Transient failures: nothing is wrong with the user's input or session, try again later. */
export const CONNECTIVITY_CODES: readonly AuthErrorCode[] = [
  'offline',
  'unreachable',
  'server_error',
];

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number | undefined;
  /** Per-field codes from the server, e.g. `{ email: 'email_taken' }`. */
  readonly fields: Record<string, AuthErrorCode>;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    code: AuthErrorCode,
    options: {
      message?: string;
      status?: number;
      fields?: Record<string, AuthErrorCode>;
      retryAfterSeconds?: number;
    } = {},
  ) {
    super(options.message ?? code);
    this.name = 'AuthError';
    this.code = code;
    this.status = options.status;
    this.fields = options.fields ?? {};
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  get isConnectivity(): boolean {
    return CONNECTIVITY_CODES.includes(this.code);
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
