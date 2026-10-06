import type { ClientId } from '../clients.ts';

/** Storage boundary for the account service. SQLite in dev; the schema is written to port to Postgres. */

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  signupClient: ClientId;
  createdAt: number;
  updatedAt: number;
}

export interface ClientSignIn {
  clientId: ClientId;
  firstSignInAt: number;
  lastSignInAt: number;
}

/** One signed-in device/app. Refresh tokens rotate within a session; revoking it ends them all. */
export interface SessionRecord {
  id: string;
  userId: string;
  clientId: ClientId;
  createdAt: number;
  revokedAt: number | null;
  revokedReason: string | null;
}

export interface RefreshTokenRecord {
  id: string;
  sessionId: string;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
  /**
   * Set when the token was exchanged for a new one (or retired). Presenting it again is reuse,
   * except within the grace window (see AuthService.refresh).
   */
  usedAt: number | null;
  /** The token this one was exchanged for. */
  replacedBy?: string | null;
}

export interface PasswordResetRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number | null;
}

/** One JSON app document of a user (onboarding state, settings, ...). */
export interface DocumentRecord {
  userId: string;
  kind: string;
  /** Schema version of `data`. */
  version: number;
  /** The document body, already validated for its kind and version. */
  data: Record<string, unknown>;
  /** The client's write time (epoch ms): last write wins. */
  updatedAt: number;
  /** When the server stored this record. */
  storedAt: number;
}

export class EmailTakenError extends Error {
  constructor() {
    super('email taken');
    this.name = 'EmailTakenError';
  }
}

export interface AccountRepository {
  /** Throws EmailTakenError when the (normalised) email already exists. */
  createUser(user: UserRecord): Promise<void>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  /** Deletes the user and everything that belongs to them (sessions, tokens, app data). */
  deleteUser(id: string): Promise<boolean>;

  recordClientSignIn(userId: string, clientId: ClientId, at: number): Promise<void>;
  listClientSignIns(userId: string): Promise<ClientSignIn[]>;

  createSession(session: SessionRecord, firstToken: RefreshTokenRecord): Promise<void>;
  findSession(id: string): Promise<SessionRecord | null>;
  revokeSession(id: string, at: number, reason: string): Promise<void>;

  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  findRefreshTokenById(id: string): Promise<RefreshTokenRecord | null>;
  /**
   * Atomically marks `currentId` as used and stores `next`.
   * Returns false (and stores nothing) when `currentId` was already used: the caller treats that as reuse.
   */
  rotateRefreshToken(currentId: string, next: RefreshTokenRecord, at: number): Promise<boolean>;
  /**
   * Grace re-issue: atomically retires the still-unused `successorId` (the token `previousId` was
   * exchanged for) and stores `next` in its place. The retired token gets no successor (and so no
   * grace window of its own). Returns false when the successor was already used.
   */
  reissueRefreshToken(
    previousId: string,
    successorId: string,
    next: RefreshTokenRecord,
    at: number,
  ): Promise<boolean>;
  revokeAllSessions(userId: string, at: number, reason: string): Promise<void>;

  createPasswordReset(reset: PasswordResetRecord): Promise<void>;
  findPasswordReset(tokenHash: string): Promise<PasswordResetRecord | null>;
  /**
   * Atomically: marks the reset (and every other open reset of the user) used, sets the new
   * password hash and revokes all of the user's sessions. False when the reset was already used.
   */
  completePasswordReset(
    resetId: string,
    userId: string,
    passwordHash: string,
    at: number,
  ): Promise<boolean>;

  getDocument(userId: string, kind: string): Promise<DocumentRecord | null>;
  /**
   * Stores what `resolve` decides, atomically against the stored document: the record to store,
   * or null to keep what is there. Without `resolve`, the later `updatedAt` wins (an equal time
   * overwrites, so a retry is idempotent). Returns what is stored afterwards.
   */
  putDocument(
    record: DocumentRecord,
    resolve?: (stored: DocumentRecord | null) => DocumentRecord | null,
  ): Promise<DocumentRecord>;

  close(): Promise<void>;
}
