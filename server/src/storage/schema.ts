/**
 * Schema, versioned with migrations applied in order. Plain SQL that runs on SQLite and Postgres alike:
 * TEXT ids (UUIDs), BIGINT epoch-millisecond timestamps, ON CONFLICT upserts, ON DELETE CASCADE.
 * Emails are stored normalised (trimmed, lowercased), so a plain UNIQUE constraint is enough.
 * App data tables added later (croc, points, check-ins) reference users(id) ON DELETE CASCADE too,
 * so deleting an account removes everything.
 */
export const SCHEMA_VERSION = 3;

export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  signup_client TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_clients (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  first_sign_in_at BIGINT NOT NULL,
  last_sign_in_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, client_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  revoked_at BIGINT,
  revoked_reason TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  used_at BIGINT
);
CREATE INDEX IF NOT EXISTS refresh_tokens_session_idx ON refresh_tokens (session_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  used_at BIGINT
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id);
`;

/**
 * v2: each refresh token remembers its successor, so a token presented again within the reuse
 * grace window can be traced to the token it was exchanged for.
 */
export const SCHEMA_V2 = `
ALTER TABLE refresh_tokens ADD COLUMN replaced_by TEXT;
`;

/**
 * v3: per-user app documents (onboarding state, settings; later progress and the croc). One JSON
 * document per kind and user, with its schema version and the client's last-write timestamp for
 * last-write-wins sync. Deleting the user removes them.
 */
export const SCHEMA_V3 = `
CREATE TABLE IF NOT EXISTS user_documents (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  version INTEGER NOT NULL,
  data TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  stored_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, kind)
);
`;

/** Migration for each version, applied in order from the database's current version. */
export const MIGRATIONS: Record<number, string> = { 1: SCHEMA_V1, 2: SCHEMA_V2, 3: SCHEMA_V3 };
