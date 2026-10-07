import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

import { DEFAULT_SCRYPT, type ScryptParams } from './passwords.ts';

export interface ServerConfig {
  host: string;
  port: number;
  /** SQLite file, or ":memory:". */
  dbPath: string;
  jwtSecret: Uint8Array;
  /** True when no JWT_SECRET was given and a random one was generated for this process. */
  jwtSecretGenerated: boolean;
  jwtIssuer: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  /** A just-rotated refresh token may be presented again this long without counting as reuse. */
  refreshReuseGraceSeconds: number;
  passwordResetTtlSeconds: number;
  resetLinkBase: string;
  /** Allowed browser origins for CORS. */
  corsOrigins: string[];
  /** Per client address and route, on sign-up, sign-in, sign-out and password reset. */
  authRateLimit: { max: number; windowMs: number };
  /** Token refresh has its own, higher budget: it is silent and every open app does it. */
  refreshRateLimit: { max: number; windowMs: number };
  /**
   * Fastify `trustProxy`: false (default, direct connections), true, a hop count, or a
   * comma-separated list of proxy addresses. Behind a reverse proxy set it, or every user shares
   * the proxy's address and therefore one rate-limit budget.
   */
  trustProxy: boolean | number | string;
  /**
   * scrypt cost as log2 N (default 17, the OWASP recommendation). Each hash needs about
   * 128 * N * r bytes (128 MiB at 17) on a libuv thread, so up to 4x that at peak: lower it
   * (SCRYPT_LOG_N=15 or 16) on a small shared box. Stored with each hash; old hashes keep working.
   */
  scrypt: ScryptParams;
  logLevel: string;
  /** Per client address, on the event streams (`POST /me/events`, `/me/mood`). */
  eventsRateLimit: { max: number; windowMs: number };
  /** Per client address, on the reads that derive the points ledger (`GET /me/points`, `/me/habitat`). */
  readRateLimit: { max: number; windowMs: number };
  /**
   * Dev and e2e only (DEV_HOOKS=1, never with NODE_ENV=production): routes under `/me/dev/` that
   * shortcut slow things, such as adding calm minutes to see the croc grow.
   */
  devHooks: boolean;
}

function parseTrustProxy(raw: string | undefined): boolean | number | string {
  if (raw === undefined || raw === '' || raw === 'false') return false;
  if (raw === 'true') return true;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}

const DEFAULT_CORS = [
  'http://localhost:4173', // npm run serve:web
  'http://localhost:4273', // npm run e2e
  'http://localhost:8081', // expo start --web
  'http://127.0.0.1:4173',
  'http://127.0.0.1:8081',
];

function int(env: NodeJS.ProcessEnv, key: string, fallback: number, min = 1): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${key} must be an integer >= ${min} (got "${raw}")`);
  }
  return value;
}

/**
 * Reads configuration from the environment. Every value has a dev default except JWT_SECRET,
 * which is required when NODE_ENV=production.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const production = env.NODE_ENV === 'production';
  const secret = env.JWT_SECRET;
  if (production && (!secret || secret.length < 32)) {
    throw new Error('JWT_SECRET (at least 32 characters) is required in production');
  }
  const port = int(env, 'PORT', 4000);
  return {
    host: env.HOST ?? 'localhost',
    port,
    dbPath: env.DB_PATH === ':memory:' ? ':memory:' : resolve(env.DB_PATH ?? 'data/dev.sqlite'),
    jwtSecret: secret ? new TextEncoder().encode(secret) : randomBytes(32),
    jwtSecretGenerated: !secret,
    jwtIssuer: env.JWT_ISSUER ?? 'mhp-account-dev',
    accessTokenTtlSeconds: int(env, 'ACCESS_TOKEN_TTL_SECONDS', 15 * 60),
    refreshTokenTtlSeconds: int(env, 'REFRESH_TOKEN_TTL_SECONDS', 30 * 24 * 60 * 60),
    refreshReuseGraceSeconds: int(env, 'REFRESH_REUSE_GRACE_SECONDS', 60, 0),
    passwordResetTtlSeconds: int(env, 'PASSWORD_RESET_TTL_SECONDS', 60 * 60),
    resetLinkBase: env.RESET_LINK_BASE ?? 'http://localhost:4173/reset-password',
    corsOrigins: env.CORS_ORIGINS
      ? env.CORS_ORIGINS.split(',')
          .map((o) => o.trim())
          .filter(Boolean)
      : DEFAULT_CORS,
    authRateLimit: {
      max: int(env, 'AUTH_RATE_LIMIT_MAX', 10),
      windowMs: int(env, 'AUTH_RATE_LIMIT_WINDOW_MS', 60_000),
    },
    refreshRateLimit: {
      max: int(env, 'REFRESH_RATE_LIMIT_MAX', 60),
      windowMs: int(env, 'AUTH_RATE_LIMIT_WINDOW_MS', 60_000),
    },
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    scrypt: { ...DEFAULT_SCRYPT, logN: int(env, 'SCRYPT_LOG_N', DEFAULT_SCRYPT.logN, 10) },
    logLevel: env.LOG_LEVEL ?? 'info',
    eventsRateLimit: {
      max: int(env, 'EVENTS_RATE_LIMIT_MAX', 300),
      windowMs: int(env, 'EVENTS_RATE_LIMIT_WINDOW_MS', 60_000),
    },
    readRateLimit: {
      max: int(env, 'READ_RATE_LIMIT_MAX', 120),
      windowMs: int(env, 'READ_RATE_LIMIT_WINDOW_MS', 60_000),
    },
    devHooks: !production && env.DEV_HOOKS === '1',
  };
}
