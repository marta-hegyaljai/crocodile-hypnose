import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, test } from 'node:test';

import { loadConfig } from '../src/config.ts';
import { hashPassword, verifyPassword, DEFAULT_SCRYPT } from '../src/passwords.ts';
import { SqliteAccountRepository } from '../src/storage/sqlite.ts';
import { createAccessTokenSigner, hashOpaqueToken, generateOpaqueToken } from '../src/tokens.ts';
import { normalizeDisplayName, normalizeEmail, isAcceptablePassword } from '../src/validation.ts';

describe('validation', () => {
  test('normalizeEmail trims, lowercases and checks the shape', () => {
    assert.equal(normalizeEmail('  Ann.Lee+croc@Example.CO.uk '), 'ann.lee+croc@example.co.uk');
    for (const bad of ['', ' ', 'a', 'a@', '@b.c', 'a@b', 'a@b.', 'a@.b', 'a b@c.d', 'a@@b.c']) {
      assert.equal(normalizeEmail(bad), null, bad);
    }
  });

  test('passwords: 8 to 128 characters, counted as characters not bytes', () => {
    assert.equal(isAcceptablePassword('1234567'), false);
    assert.equal(isAcceptablePassword('12345678'), true);
    assert.equal(isAcceptablePassword('🐊🐊🐊🐊🐊🐊🐊🐊'), true);
    assert.equal(isAcceptablePassword('x'.repeat(128)), true);
    assert.equal(isAcceptablePassword('x'.repeat(129)), false);
  });

  test('display names are trimmed, collapsed and capped', () => {
    assert.equal(normalizeDisplayName(undefined), null);
    assert.equal(normalizeDisplayName('  '), null);
    assert.equal(normalizeDisplayName(' Ann \n Lee '), 'Ann Lee');
    assert.equal(normalizeDisplayName('x'.repeat(50)), 'x'.repeat(50));
    assert.equal(normalizeDisplayName('x'.repeat(51)), undefined);
    assert.equal(normalizeDisplayName('a\u0000b'), undefined);
  });
});

describe('passwords', () => {
  test('hash and verify with the production parameters', async () => {
    const hash = await hashPassword('correct horse', DEFAULT_SCRYPT);
    assert.match(hash, /^scrypt\$17\$8\$1\$[\w-]{22}\$[\w-]{86}$/);
    assert.equal(await verifyPassword('correct horse', hash), true);
    assert.equal(await verifyPassword('correct horsE', hash), false);
  });

  test('salts are per hash', async () => {
    const params = { logN: 10, r: 8, p: 1 };
    const a = await hashPassword('same', params);
    const b = await hashPassword('same', params);
    assert.notEqual(a, b);
  });

  test('malformed stored hashes never verify', async () => {
    for (const stored of ['', 'plain', 'scrypt$x$8$1$a$b', 'bcrypt$10$8$1$a$b']) {
      assert.equal(await verifyPassword('anything', stored), false);
    }
  });
});

describe('tokens', () => {
  const signer = createAccessTokenSigner({
    secret: new TextEncoder().encode('s'.repeat(32)),
    issuer: 'test',
    ttlSeconds: 60,
  });

  test('round-trips claims and expires on time', async () => {
    const now = Date.UTC(2026, 0, 1);
    const claims = { userId: 'u1', sessionId: 's1', clientId: 'mhp-hypnose' as const };
    const { token, expiresAt } = await signer.sign(claims, now);
    assert.equal(expiresAt, now + 60_000);
    assert.deepEqual(await signer.verify(token, now + 59_000), claims);
    await assert.rejects(signer.verify(token, now + 61_000), { code: 'unauthorized' });
  });

  test('a token from another issuer is refused', async () => {
    const other = createAccessTokenSigner({
      secret: new TextEncoder().encode('s'.repeat(32)),
      issuer: 'other',
      ttlSeconds: 60,
    });
    const { token } = await other.sign(
      { userId: 'u', sessionId: 's', clientId: 'mhp-hypnose' },
      Date.now(),
    );
    await assert.rejects(signer.verify(token, Date.now()), { code: 'unauthorized' });
  });

  test('opaque tokens are random and hashed', () => {
    const a = generateOpaqueToken();
    assert.notEqual(a, generateOpaqueToken());
    assert.match(hashOpaqueToken(a), /^[0-9a-f]{64}$/);
    assert.notEqual(hashOpaqueToken(a), a);
  });
});

describe('SQLite repository', () => {
  test('migrates once, keeps data across restarts, enforces cascades', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mhp-repo-'));
    const path = join(dir, 'nested', 'db.sqlite');
    try {
      const repo = new SqliteAccountRepository(path);
      const at = Date.now();
      await repo.createUser({
        id: 'u1',
        email: 'a@b.co',
        passwordHash: 'h',
        displayName: null,
        signupClient: 'mhp-coaching',
        createdAt: at,
        updatedAt: at,
      });
      await repo.createSession(
        {
          id: 's1',
          userId: 'u1',
          clientId: 'mhp-hypnose',
          createdAt: at,
          revokedAt: null,
          revokedReason: null,
        },
        {
          id: 't1',
          sessionId: 's1',
          tokenHash: 'h1',
          createdAt: at,
          expiresAt: at + 1000,
          usedAt: null,
        },
      );
      await repo.close();

      const reopened = new SqliteAccountRepository(path);
      assert.equal((await reopened.findUserByEmail('a@b.co'))?.signupClient, 'mhp-coaching');
      // Rotation is single-use.
      const next = {
        id: 't2',
        sessionId: 's1',
        tokenHash: 'h2',
        createdAt: at,
        expiresAt: at + 1000,
        usedAt: null,
      };
      assert.equal(await reopened.rotateRefreshToken('t1', next, at), true);
      assert.equal(
        await reopened.rotateRefreshToken('t1', { ...next, id: 't3', tokenHash: 'h3' }, at),
        false,
      );
      assert.equal(await reopened.findRefreshToken('h3'), null);
      // Deleting the user removes sessions and tokens.
      assert.equal(await reopened.deleteUser('u1'), true);
      assert.equal(await reopened.findSession('s1'), null);
      assert.equal(await reopened.findRefreshToken('h2'), null);
      assert.equal(await reopened.deleteUser('u1'), false);
      await reopened.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('SQLite migrations', () => {
  test('upgrades a v1 database in place', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mhp-migrate-'));
    const path = join(dir, 'db.sqlite');
    try {
      const { SCHEMA_V1, SCHEMA_VERSION } = await import('../src/storage/schema.ts');
      const raw = new DatabaseSync(path);
      raw.exec(SCHEMA_V1);
      raw.exec('PRAGMA user_version = 1');
      raw.close();
      const repo = new SqliteAccountRepository(path);
      await repo.close();
      const check = new DatabaseSync(path);
      const version = check.prepare('PRAGMA user_version').get() as { user_version: number };
      const columns = check.prepare('PRAGMA table_info(refresh_tokens)').all() as {
        name: string;
      }[];
      const tables = check.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
        name: string;
      }[];
      check.close();
      assert.equal(version.user_version, SCHEMA_VERSION);
      assert.ok(columns.some((c) => c.name === 'replaced_by'));
      assert.ok(tables.some((t) => t.name === 'user_documents'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('config', () => {
  test('dev defaults', () => {
    const config = loadConfig({});
    assert.equal(config.port, 4000);
    assert.equal(config.accessTokenTtlSeconds, 900);
    assert.equal(config.jwtSecretGenerated, true);
    assert.ok(config.corsOrigins.includes('http://localhost:4173'));
  });

  test('production requires a strong JWT secret', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /JWT_SECRET/);
    assert.throws(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'short' }), /JWT_SECRET/);
    const config = loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) });
    assert.equal(config.jwtSecretGenerated, false);
  });

  test('trust proxy, refresh limit and grace window', () => {
    const defaults = loadConfig({});
    assert.equal(defaults.trustProxy, false);
    assert.equal(defaults.refreshReuseGraceSeconds, 60);
    assert.equal(defaults.refreshRateLimit.max, 60);
    assert.equal(loadConfig({ TRUST_PROXY: 'true' }).trustProxy, true);
    assert.equal(loadConfig({ TRUST_PROXY: '2' }).trustProxy, 2);
    assert.equal(loadConfig({ TRUST_PROXY: '10.0.0.1,10.0.0.2' }).trustProxy, '10.0.0.1,10.0.0.2');
    assert.equal(loadConfig({ REFRESH_REUSE_GRACE_SECONDS: '0' }).refreshReuseGraceSeconds, 0);
  });

  test('rejects nonsense numbers', () => {
    assert.throws(() => loadConfig({ PORT: 'abc' }), /PORT/);
    assert.throws(() => loadConfig({ ACCESS_TOKEN_TTL_SECONDS: '0' }), /ACCESS_TOKEN_TTL_SECONDS/);
    assert.equal(
      loadConfig({ CORS_ORIGINS: ' http://a.test , http://b.test ' }).corsOrigins.length,
      2,
    );
  });
});
