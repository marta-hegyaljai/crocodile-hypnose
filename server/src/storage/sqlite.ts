import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { isClientId, type ClientId } from '../clients.ts';
import {
  EmailTakenError,
  type AccountRepository,
  type ClientSignIn,
  type DocumentRecord,
  type EventRecord,
  type LedgerRecord,
  type PasswordResetRecord,
  type RefreshTokenRecord,
  type SessionRecord,
  type UserRecord,
} from './repository.ts';
import { MIGRATIONS, SCHEMA_VERSION } from './schema.ts';

type Row = Record<string, unknown>;

const str = (v: unknown) => String(v);
const num = (v: unknown) => Number(v);
const optNum = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const optStr = (v: unknown) => (v === null || v === undefined ? null : String(v));
function client(v: unknown): ClientId {
  if (!isClientId(v)) throw new Error(`unknown client id in storage: ${String(v)}`);
  return v;
}

function toUser(row: Row): UserRecord {
  return {
    id: str(row.id),
    email: str(row.email),
    passwordHash: str(row.password_hash),
    displayName: optStr(row.display_name),
    signupClient: client(row.signup_client),
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
  };
}

function toSession(row: Row): SessionRecord {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    clientId: client(row.client_id),
    createdAt: num(row.created_at),
    revokedAt: optNum(row.revoked_at),
    revokedReason: optStr(row.revoked_reason),
  };
}

function toRefreshToken(row: Row): RefreshTokenRecord {
  return {
    id: str(row.id),
    sessionId: str(row.session_id),
    tokenHash: str(row.token_hash),
    createdAt: num(row.created_at),
    expiresAt: num(row.expires_at),
    usedAt: optNum(row.used_at),
    replacedBy: optStr(row.replaced_by),
  };
}

function toDocument(row: Row): DocumentRecord {
  return {
    userId: str(row.user_id),
    kind: str(row.kind),
    version: num(row.version),
    data: JSON.parse(str(row.data)) as Record<string, unknown>,
    updatedAt: num(row.updated_at),
    storedAt: num(row.stored_at),
  };
}

function toEvent(row: Row): EventRecord {
  return {
    userId: str(row.user_id),
    stream: str(row.stream),
    id: str(row.id),
    data: JSON.parse(str(row.data)) as Record<string, unknown>,
    at: num(row.at),
    storedAt: num(row.stored_at),
  };
}

function toLedger(row: Row): LedgerRecord {
  return {
    key: str(row.key),
    kind: str(row.kind),
    points: num(row.points),
    seconds: num(row.seconds),
    ref: str(row.ref),
    at: num(row.at),
  };
}

/** SQLite (node:sqlite) implementation. `path` may be ":memory:" for tests. */
export class SqliteAccountRepository implements AccountRepository {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    if (path !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;');
    this.migrate();
  }

  private migrate() {
    const row = this.db.prepare('PRAGMA user_version').get() as Row | undefined;
    const version = num(row?.user_version ?? 0);
    if (version > SCHEMA_VERSION) {
      throw new Error(`database schema v${version} is newer than this server (v${SCHEMA_VERSION})`);
    }
    for (let next = version + 1; next <= SCHEMA_VERSION; next++) {
      const sql = MIGRATIONS[next];
      if (!sql) throw new Error(`missing migration to schema v${next}`);
      this.transaction(() => {
        this.db.exec(sql);
        this.db.exec(`PRAGMA user_version = ${next}`);
      });
    }
  }

  private transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async createUser(user: UserRecord): Promise<void> {
    try {
      this.db
        .prepare(
          `INSERT INTO users (id, email, password_hash, display_name, signup_client, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          user.id,
          user.email,
          user.passwordHash,
          user.displayName,
          user.signupClient,
          user.createdAt,
          user.updatedAt,
        );
    } catch (err) {
      if (err instanceof Error && /UNIQUE constraint failed: users\.email/.test(err.message)) {
        throw new EmailTakenError();
      }
      throw err;
    }
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
      Row | undefined;
    return row ? toUser(row) : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined;
    return row ? toUser(row) : null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return Number(result.changes) > 0;
  }

  async recordClientSignIn(userId: string, clientId: ClientId, at: number): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO user_clients (user_id, client_id, first_sign_in_at, last_sign_in_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, client_id) DO UPDATE SET last_sign_in_at = excluded.last_sign_in_at`,
      )
      .run(userId, clientId, at, at);
  }

  async listClientSignIns(userId: string): Promise<ClientSignIn[]> {
    const rows = this.db
      .prepare('SELECT * FROM user_clients WHERE user_id = ? ORDER BY client_id')
      .all(userId) as Row[];
    return rows.map((row) => ({
      clientId: client(row.client_id),
      firstSignInAt: num(row.first_sign_in_at),
      lastSignInAt: num(row.last_sign_in_at),
    }));
  }

  async createSession(session: SessionRecord, firstToken: RefreshTokenRecord): Promise<void> {
    this.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO sessions (id, user_id, client_id, created_at, revoked_at, revoked_reason)
           VALUES (?, ?, ?, ?, NULL, NULL)`,
        )
        .run(session.id, session.userId, session.clientId, session.createdAt);
      this.insertRefreshToken(firstToken);
    });
  }

  private insertRefreshToken(token: RefreshTokenRecord) {
    this.db
      .prepare(
        `INSERT INTO refresh_tokens (id, session_id, token_hash, created_at, expires_at, used_at)
         VALUES (?, ?, ?, ?, ?, NULL)`,
      )
      .run(token.id, token.sessionId, token.tokenHash, token.createdAt, token.expiresAt);
  }

  async findSession(id: string): Promise<SessionRecord | null> {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Row | undefined;
    return row ? toSession(row) : null;
  }

  async revokeSession(id: string, at: number, reason: string): Promise<void> {
    this.db
      .prepare(
        'UPDATE sessions SET revoked_at = ?, revoked_reason = ? WHERE id = ? AND revoked_at IS NULL',
      )
      .run(at, reason, id);
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = this.db
      .prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?')
      .get(tokenHash) as Row | undefined;
    return row ? toRefreshToken(row) : null;
  }

  async findRefreshTokenById(id: string): Promise<RefreshTokenRecord | null> {
    const row = this.db.prepare('SELECT * FROM refresh_tokens WHERE id = ?').get(id) as
      Row | undefined;
    return row ? toRefreshToken(row) : null;
  }

  async rotateRefreshToken(
    currentId: string,
    next: RefreshTokenRecord,
    at: number,
  ): Promise<boolean> {
    return this.transaction(() => {
      const result = this.db
        .prepare(
          'UPDATE refresh_tokens SET used_at = ?, replaced_by = ? WHERE id = ? AND used_at IS NULL',
        )
        .run(at, next.id, currentId);
      if (Number(result.changes) !== 1) return false;
      this.insertRefreshToken(next);
      return true;
    });
  }

  async reissueRefreshToken(
    previousId: string,
    successorId: string,
    next: RefreshTokenRecord,
    at: number,
  ): Promise<boolean> {
    return this.transaction(() => {
      // The successor must still be unused. It is retired in favour of `next` with no successor of
      // its own, so it never gets a grace window: presenting it again is reuse. Otherwise two
      // holders of one session could keep taking it back from each other.
      const retired = this.db
        .prepare('UPDATE refresh_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL')
        .run(at, successorId);
      if (Number(retired.changes) !== 1) return false;
      this.insertRefreshToken(next);
      this.db
        .prepare('UPDATE refresh_tokens SET replaced_by = ? WHERE id = ?')
        .run(next.id, previousId);
      return true;
    });
  }

  async revokeAllSessions(userId: string, at: number, reason: string): Promise<void> {
    this.db
      .prepare(
        'UPDATE sessions SET revoked_at = ?, revoked_reason = ? WHERE user_id = ? AND revoked_at IS NULL',
      )
      .run(at, reason, userId);
  }

  async findPasswordReset(tokenHash: string): Promise<PasswordResetRecord | null> {
    const row = this.db
      .prepare('SELECT * FROM password_resets WHERE token_hash = ?')
      .get(tokenHash) as Row | undefined;
    if (!row) return null;
    return {
      id: str(row.id),
      userId: str(row.user_id),
      tokenHash: str(row.token_hash),
      createdAt: num(row.created_at),
      expiresAt: num(row.expires_at),
      usedAt: optNum(row.used_at),
    };
  }

  async completePasswordReset(
    resetId: string,
    userId: string,
    passwordHash: string,
    at: number,
  ): Promise<boolean> {
    return this.transaction(() => {
      const used = this.db
        .prepare('UPDATE password_resets SET used_at = ? WHERE id = ? AND used_at IS NULL')
        .run(at, resetId);
      if (Number(used.changes) !== 1) return false;
      // Every other outstanding link for this user stops working too.
      this.db
        .prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
        .run(at, userId);
      this.db
        .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
        .run(passwordHash, at, userId);
      this.db
        .prepare(
          `UPDATE sessions SET revoked_at = ?, revoked_reason = 'password_reset'
           WHERE user_id = ? AND revoked_at IS NULL`,
        )
        .run(at, userId);
      return true;
    });
  }

  async createPasswordReset(reset: PasswordResetRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO password_resets (id, user_id, token_hash, created_at, expires_at, used_at)
         VALUES (?, ?, ?, ?, ?, NULL)`,
      )
      .run(reset.id, reset.userId, reset.tokenHash, reset.createdAt, reset.expiresAt);
  }

  async getDocument(userId: string, kind: string): Promise<DocumentRecord | null> {
    const row = this.db
      .prepare('SELECT * FROM user_documents WHERE user_id = ? AND kind = ?')
      .get(userId, kind) as Row | undefined;
    return row ? toDocument(row) : null;
  }

  async putDocument(
    record: DocumentRecord,
    resolve: (stored: DocumentRecord | null) => DocumentRecord | null = (stored) =>
      stored && stored.updatedAt > record.updatedAt ? null : record,
  ): Promise<DocumentRecord> {
    return this.transaction(() => {
      const row = this.db
        .prepare('SELECT * FROM user_documents WHERE user_id = ? AND kind = ?')
        .get(record.userId, record.kind) as Row | undefined;
      const current = row ? toDocument(row) : null;
      const next = resolve(current);
      if (!next) return current ?? record;
      this.db
        .prepare(
          `INSERT INTO user_documents (user_id, kind, version, data, updated_at, stored_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (user_id, kind) DO UPDATE SET
             version = excluded.version, data = excluded.data,
             updated_at = excluded.updated_at, stored_at = excluded.stored_at`,
        )
        .run(
          next.userId,
          next.kind,
          next.version,
          JSON.stringify(next.data),
          next.updatedAt,
          next.storedAt,
        );
      return next;
    });
  }

  async appendEvents(
    userId: string,
    stream: string,
    events: EventRecord[],
    decide: (event: EventRecord, stored: EventRecord[]) => EventRecord,
  ): Promise<EventRecord[]> {
    return this.transaction(() => {
      const stored = (
        this.db
          .prepare('SELECT * FROM user_events WHERE user_id = ? AND stream = ? ORDER BY at, id')
          .all(userId, stream) as Row[]
      ).map(toEvent);
      const byId = new Map(stored.map((e) => [e.id, e]));
      const insert = this.db.prepare(
        `INSERT INTO user_events (user_id, stream, id, data, at, stored_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      return events.map((event) => {
        const existing = byId.get(event.id);
        if (existing) return existing;
        const next = decide(event, stored);
        insert.run(userId, stream, next.id, JSON.stringify(next.data), next.at, next.storedAt);
        stored.push(next);
        byId.set(next.id, next);
        return next;
      });
    });
  }

  async listEvents(userId: string, stream: string, limit: number): Promise<EventRecord[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM (
           SELECT * FROM user_events WHERE user_id = ? AND stream = ? ORDER BY at DESC, id DESC LIMIT ?
         ) ORDER BY at, id`,
      )
      .all(userId, stream, limit) as Row[];
    return rows.map(toEvent);
  }

  private readLedger(userId: string): LedgerRecord[] {
    return (
      this.db
        .prepare('SELECT * FROM user_ledger WHERE user_id = ? ORDER BY at, key')
        .all(userId) as Row[]
    ).map(toLedger);
  }

  async listLedger(userId: string): Promise<LedgerRecord[]> {
    return this.readLedger(userId);
  }

  async updateLedger(
    userId: string,
    decide: (state: { events: EventRecord[]; ledger: LedgerRecord[] }) => LedgerRecord[],
    at: number,
  ): Promise<LedgerRecord[]> {
    return this.transaction(() => {
      const events = (
        this.db
          .prepare('SELECT * FROM user_events WHERE user_id = ? AND stream = ? ORDER BY at, id')
          .all(userId, 'events') as Row[]
      ).map(toEvent);
      const ledger = this.readLedger(userId);
      const added = decide({ events, ledger });
      if (added.length === 0) return ledger;
      const insert = this.db.prepare(
        `INSERT INTO user_ledger (user_id, key, kind, points, seconds, ref, at, stored_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, key) DO NOTHING`,
      );
      for (const e of added) {
        insert.run(userId, e.key, e.kind, e.points, e.seconds, e.ref, e.at, at);
      }
      return this.readLedger(userId);
    });
  }

  async close(): Promise<void> {
    if (this.db.isOpen) this.db.close();
  }
}
