import { Writable } from 'node:stream';

import { buildApp } from '../src/app.ts';
import { loadConfig, type ServerConfig } from '../src/config.ts';
import { SqliteAccountRepository } from '../src/storage/sqlite.ts';

export interface TestContext {
  app: Awaited<ReturnType<typeof buildApp>>;
  repo: SqliteAccountRepository;
  config: ServerConfig;
  clock: { now: number; advance(seconds: number): void };
  logs: Record<string, unknown>[];
  close(): Promise<void>;
}

/** A fresh app on an in-memory database, with a controllable clock and captured logs. */
export async function makeApp(overrides: Partial<ServerConfig> = {}): Promise<TestContext> {
  const config: ServerConfig = {
    ...loadConfig({ JWT_SECRET: 'test-secret-test-secret-test-secret!', DB_PATH: ':memory:' }),
    // Cheap hashing keeps the suite fast; production parameters are covered in passwords.test.ts.
    scrypt: { logN: 10, r: 8, p: 1 },
    authRateLimit: { max: 1000, windowMs: 60_000 },
    refreshRateLimit: { max: 1000, windowMs: 60_000 },
    ...overrides,
  };
  const repo = new SqliteAccountRepository(':memory:');
  const clock = {
    now: Date.UTC(2026, 0, 1, 12, 0, 0),
    advance(seconds: number) {
      this.now += seconds * 1000;
    },
  };
  const logs: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _enc, done) {
      for (const line of String(chunk).split('\n')) if (line) logs.push(JSON.parse(line));
      done();
    },
  });
  const app = await buildApp({
    config,
    repo,
    now: () => clock.now,
    logger: { level: 'info', stream },
  });
  await app.ready();
  return {
    app,
    repo,
    config,
    clock,
    logs,
    async close() {
      await app.close();
      await repo.close();
    },
  };
}

export const HYPNOSE = 'mhp-hypnose';
/** The password the helpers sign up and sign in with. */
export const PASSWORD = 'correct horse';
export const COACHING = 'mhp-coaching';

export async function signUp(
  ctx: TestContext,
  body: { email?: string; password?: string; displayName?: string | null; clientId?: string } = {},
) {
  return ctx.app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: {
      email: 'river@example.com',
      password: 'correct horse',
      clientId: HYPNOSE,
      ...body,
    },
  });
}

export async function signIn(
  ctx: TestContext,
  body: { email?: string; password?: string; clientId?: string } = {},
) {
  return ctx.app.inject({
    method: 'POST',
    url: '/auth/signin',
    payload: { email: 'river@example.com', password: 'correct horse', clientId: HYPNOSE, ...body },
  });
}

export async function refresh(ctx: TestContext, refreshToken: string, clientId = HYPNOSE) {
  return ctx.app.inject({
    method: 'POST',
    url: '/auth/refresh',
    payload: { refreshToken, clientId },
  });
}

export async function me(
  ctx: TestContext,
  accessToken: string,
  method: 'GET' | 'DELETE' = 'GET',
  password: string | null = method === 'DELETE' ? PASSWORD : null,
) {
  return ctx.app.inject({
    method,
    url: '/me',
    headers: { authorization: `Bearer ${accessToken}` },
    ...(password === null ? {} : { payload: { password } }),
  });
}

export interface AuthBody {
  user: {
    id: string;
    email: string;
    displayName: string | null;
    signupClient: string;
    clients: { clientId: string; firstSignInAt: string; lastSignInAt: string }[];
  };
  tokens: {
    tokenType: string;
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    refreshTokenExpiresAt: string;
  };
}

export interface ErrorJson {
  error: { code: string; message: string; fields?: Record<string, string> };
}
