import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import {
  COACHING,
  HYPNOSE,
  makeApp,
  me,
  refresh,
  signIn,
  signUp,
  type AuthBody,
  type ErrorJson,
  type TestContext,
} from './helpers.ts';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await makeApp();
});
afterEach(async () => {
  await ctx.close();
});

describe('GET /health', () => {
  test('reports ok', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { status: 'ok' });
  });
});

describe('POST /auth/signup', () => {
  test('creates the account, normalises input and signs in', async () => {
    const res = await signUp(ctx, { email: '  River@Example.COM ', displayName: '  Ann   Lee ' });
    assert.equal(res.statusCode, 201);
    const body = res.json<AuthBody>();
    assert.equal(body.user.email, 'river@example.com');
    assert.equal(body.user.displayName, 'Ann Lee');
    assert.equal(body.user.signupClient, HYPNOSE);
    assert.deepEqual(
      body.user.clients.map((c) => c.clientId),
      [HYPNOSE],
    );
    assert.equal(body.tokens.tokenType, 'Bearer');
    assert.ok(body.tokens.accessToken.split('.').length === 3);
    assert.ok(body.tokens.refreshToken.length >= 43);
    // Access token lives 15 minutes, refresh token 30 days.
    assert.equal(Date.parse(body.tokens.accessTokenExpiresAt) - ctx.clock.now, 15 * 60 * 1000);
    assert.equal(
      Date.parse(body.tokens.refreshTokenExpiresAt) - ctx.clock.now,
      30 * 24 * 3600 * 1000,
    );
    const profile = await me(ctx, body.tokens.accessToken);
    assert.equal(profile.statusCode, 200);
    assert.equal(profile.json<{ user: AuthBody['user'] }>().user.id, body.user.id);
  });

  test('never stores or returns the password', async () => {
    const res = await signUp(ctx);
    assert.ok(!res.body.includes('correct horse'));
    const stored = await ctx.repo.findUserByEmail('river@example.com');
    assert.ok(stored?.passwordHash.startsWith('scrypt$'));
    assert.ok(!stored?.passwordHash.includes('correct horse'));
  });

  test('display name is optional; blank becomes null', async () => {
    const a = await signUp(ctx, { email: 'a@example.com' });
    assert.equal(a.json<AuthBody>().user.displayName, null);
    const b = await signUp(ctx, { email: 'b@example.com', displayName: '   ' });
    assert.equal(b.json<AuthBody>().user.displayName, null);
    const c = await signUp(ctx, { email: 'c@example.com', displayName: null });
    assert.equal(c.json<AuthBody>().user.displayName, null);
  });

  test('rejects an invalid email', async () => {
    for (const email of [
      '',
      'plain',
      'a@b',
      'a b@c.de',
      '@example.com',
      `${'x'.repeat(250)}@e.co`,
    ]) {
      const res = await signUp(ctx, { email });
      assert.equal(res.statusCode, 400, email);
      const body = res.json<ErrorJson>();
      assert.equal(body.error.code, 'invalid_email', email);
      assert.deepEqual(body.error.fields, { email: 'invalid_email' });
    }
  });

  test('rejects a password shorter than 8 or longer than 128 characters', async () => {
    const short = await signUp(ctx, { password: '1234567' });
    assert.equal(short.statusCode, 400);
    assert.equal(short.json<ErrorJson>().error.code, 'weak_password');
    const long = await signUp(ctx, { password: 'x'.repeat(129) });
    assert.equal(long.json<ErrorJson>().error.code, 'weak_password');
    const exact = await signUp(ctx, { password: '12345678' });
    assert.equal(exact.statusCode, 201);
  });

  test('rejects a display name that is too long or has control characters', async () => {
    const long = await signUp(ctx, { displayName: 'x'.repeat(51) });
    assert.equal(long.json<ErrorJson>().error.code, 'invalid_display_name');
    const control = await signUp(ctx, { displayName: 'An\u0007n' });
    assert.equal(control.json<ErrorJson>().error.code, 'invalid_display_name');
  });

  test('reports several field problems at once', async () => {
    const res = await signUp(ctx, { email: 'nope', password: 'short' });
    assert.equal(res.statusCode, 400);
    const body = res.json<ErrorJson>();
    assert.equal(body.error.code, 'invalid_request');
    assert.deepEqual(body.error.fields, { email: 'invalid_email', password: 'weak_password' });
  });

  test('rejects missing or mistyped fields with field names', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 42 },
    });
    assert.equal(res.statusCode, 400);
    const body = res.json<ErrorJson>();
    assert.equal(body.error.code, 'invalid_request');
    assert.deepEqual(Object.keys(body.error.fields ?? {}).sort(), [
      'clientId',
      'email',
      'password',
    ]);
  });

  test('rejects an unknown client', async () => {
    const res = await signUp(ctx, { clientId: 'someone-else' });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json<ErrorJson>().error.code, 'unknown_client');
  });

  test('rejects a taken email regardless of case and spaces', async () => {
    await signUp(ctx);
    const res = await signUp(ctx, { email: ' RIVER@example.com', clientId: COACHING });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json<ErrorJson>().error.code, 'email_taken');
  });
});

describe('POST /auth/signin', () => {
  beforeEach(async () => {
    await signUp(ctx, { clientId: COACHING, displayName: 'Ann' });
  });

  test('signs in with the right password', async () => {
    const res = await signIn(ctx, { email: ' River@Example.com ' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json<AuthBody>().user.displayName, 'Ann');
  });

  test('a wrong password and an unknown email give the same answer', async () => {
    const wrong = await signIn(ctx, { password: 'not the one' });
    const unknown = await signIn(ctx, { email: 'nobody@example.com' });
    const malformed = await signIn(ctx, { email: 'not-an-email' });
    for (const res of [wrong, unknown, malformed]) {
      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.json(), {
        error: { code: 'invalid_credentials', message: 'Email or password is incorrect.' },
      });
    }
  });

  test('an account made in the Coaching app signs in to Hypnose', async () => {
    ctx.clock.advance(60);
    const res = await signIn(ctx, { clientId: HYPNOSE });
    assert.equal(res.statusCode, 200);
    const { user } = res.json<AuthBody>();
    assert.equal(user.signupClient, COACHING);
    const byClient = Object.fromEntries(user.clients.map((c) => [c.clientId, c]));
    assert.ok(byClient[COACHING] && byClient[HYPNOSE]);
    assert.equal(Date.parse(byClient[HYPNOSE].lastSignInAt), ctx.clock.now);
    assert.equal(Date.parse(byClient[COACHING].lastSignInAt), ctx.clock.now - 60_000);
  });

  test('records the last sign-in per client', async () => {
    await signIn(ctx, { clientId: HYPNOSE });
    ctx.clock.advance(3600);
    const res = await signIn(ctx, { clientId: HYPNOSE });
    const hyp = res.json<AuthBody>().user.clients.find((c) => c.clientId === HYPNOSE);
    assert.equal(Date.parse(hyp!.lastSignInAt), ctx.clock.now);
    assert.equal(Date.parse(hyp!.firstSignInAt), ctx.clock.now - 3_600_000);
  });

  test('rejects an unknown client', async () => {
    const res = await signIn(ctx, { clientId: 'x' });
    assert.equal(res.json<ErrorJson>().error.code, 'unknown_client');
  });
});

describe('POST /auth/refresh', () => {
  let first: AuthBody;
  beforeEach(async () => {
    first = (await signUp(ctx)).json<AuthBody>();
  });

  test('rotates the refresh token and issues a new access token', async () => {
    ctx.clock.advance(5);
    const res = await refresh(ctx, first.tokens.refreshToken);
    assert.equal(res.statusCode, 200);
    const next = res.json<AuthBody>();
    assert.notEqual(next.tokens.refreshToken, first.tokens.refreshToken);
    assert.notEqual(next.tokens.accessToken, first.tokens.accessToken);
    assert.equal(next.user.id, first.user.id);
    assert.equal((await me(ctx, next.tokens.accessToken)).statusCode, 200);
    // The new refresh token works again.
    assert.equal((await refresh(ctx, next.tokens.refreshToken)).statusCode, 200);
  });

  test('an expired access token is refused, and refreshing restores access', async () => {
    ctx.clock.advance(15 * 60 + 1);
    const expired = await me(ctx, first.tokens.accessToken);
    assert.equal(expired.statusCode, 401);
    assert.equal(expired.json<ErrorJson>().error.code, 'unauthorized');
    const res = await refresh(ctx, first.tokens.refreshToken);
    assert.equal(res.statusCode, 200);
    assert.equal((await me(ctx, res.json<AuthBody>().tokens.accessToken)).statusCode, 200);
  });

  test('reusing a rotated token after the grace window revokes the whole session', async () => {
    const second = (await refresh(ctx, first.tokens.refreshToken)).json<AuthBody>();
    ctx.clock.advance(61);
    const reuse = await refresh(ctx, first.tokens.refreshToken);
    assert.equal(reuse.statusCode, 401);
    assert.equal(reuse.json<ErrorJson>().error.code, 'refresh_token_reused');
    // The legitimate newest token and its access token are dead too.
    const after = await refresh(ctx, second.tokens.refreshToken);
    assert.equal(after.statusCode, 401);
    assert.equal(after.json<ErrorJson>().error.code, 'invalid_refresh_token');
    assert.equal((await me(ctx, second.tokens.accessToken)).statusCode, 401);
    assert.equal((await me(ctx, first.tokens.accessToken)).statusCode, 401);
  });

  test('within the grace window, a lost response is recovered without ending the session', async () => {
    // The client never received `lost` (reload, app kill, dropped connection) and tries again.
    const lost = (await refresh(ctx, first.tokens.refreshToken)).json<AuthBody>();
    ctx.clock.advance(20);
    const retry = await refresh(ctx, first.tokens.refreshToken);
    assert.equal(retry.statusCode, 200);
    const recovered = retry.json<AuthBody>();
    assert.notEqual(recovered.tokens.refreshToken, lost.tokens.refreshToken);
    assert.equal((await me(ctx, recovered.tokens.accessToken)).statusCode, 200);
    // The successor that never arrived is retired; the recovered token carries on.
    ctx.clock.advance(61);
    assert.equal((await refresh(ctx, lost.tokens.refreshToken)).statusCode, 401);
  });

  test('within the grace window, the later of two racing refreshes wins; the displaced token is reuse', async () => {
    const [a, b] = await Promise.all([
      refresh(ctx, first.tokens.refreshToken),
      refresh(ctx, first.tokens.refreshToken),
    ]);
    assert.equal(a.statusCode, 200);
    assert.equal(b.statusCode, 200);
    // The app's cross-tab lock prevents this race; if it happens, only the later pair lives on.
    const displaced = await refresh(ctx, a.json<AuthBody>().tokens.refreshToken);
    assert.equal(displaced.statusCode, 401);
    assert.equal(displaced.json<ErrorJson>().error.code, 'refresh_token_reused');
    assert.equal((await refresh(ctx, b.json<AuthBody>().tokens.refreshToken)).statusCode, 401);
  });

  test('a replayed token cannot keep taking the session back: the next hop revokes it', async () => {
    // The legitimate app rotates T1 -> T2; a thief replays T1 within the grace window and gets T3.
    const legit = (await refresh(ctx, first.tokens.refreshToken)).json<AuthBody>();
    ctx.clock.advance(30);
    const thief = await refresh(ctx, first.tokens.refreshToken);
    assert.equal(thief.statusCode, 200);
    // The legitimate holder refreshes T2 (retired by the replay): reuse, the session ends for both.
    ctx.clock.advance(25);
    const back = await refresh(ctx, legit.tokens.refreshToken);
    assert.equal(back.statusCode, 401);
    assert.equal(back.json<ErrorJson>().error.code, 'refresh_token_reused');
    const thiefNext = await refresh(ctx, thief.json<AuthBody>().tokens.refreshToken);
    assert.equal(thiefNext.statusCode, 401);
    assert.equal((await me(ctx, thief.json<AuthBody>().tokens.accessToken)).statusCode, 401);
  });

  test('within the grace window, a token whose successor was already used is still reuse', async () => {
    const second = (await refresh(ctx, first.tokens.refreshToken)).json<AuthBody>();
    const third = await refresh(ctx, second.tokens.refreshToken);
    assert.equal(third.statusCode, 200);
    ctx.clock.advance(5);
    const replay = await refresh(ctx, first.tokens.refreshToken);
    assert.equal(replay.statusCode, 401);
    assert.equal(replay.json<ErrorJson>().error.code, 'refresh_token_reused');
    assert.equal((await refresh(ctx, third.json<AuthBody>().tokens.refreshToken)).statusCode, 401);
  });

  test('a grace window of 0 makes every reuse fatal', async () => {
    const strict = await makeApp({ refreshReuseGraceSeconds: 0 });
    try {
      const { tokens } = (await signUp(strict)).json<AuthBody>();
      await refresh(strict, tokens.refreshToken);
      strict.clock.advance(1);
      const reuse = await refresh(strict, tokens.refreshToken);
      assert.equal(reuse.json<ErrorJson>().error.code, 'refresh_token_reused');
    } finally {
      await strict.close();
    }
  });

  test('reuse in one session leaves other sessions alone', async () => {
    const other = (await signIn(ctx, { clientId: COACHING })).json<AuthBody>();
    await refresh(ctx, first.tokens.refreshToken);
    ctx.clock.advance(61);
    await refresh(ctx, first.tokens.refreshToken);
    assert.equal((await me(ctx, other.tokens.accessToken)).statusCode, 200);
    assert.equal((await refresh(ctx, other.tokens.refreshToken, COACHING)).statusCode, 200);
  });

  test('refuses an unknown token', async () => {
    const res = await refresh(ctx, 'not-a-real-token');
    assert.equal(res.statusCode, 401);
    assert.equal(res.json<ErrorJson>().error.code, 'invalid_refresh_token');
  });

  test('refuses a token presented by a different client', async () => {
    const res = await refresh(ctx, first.tokens.refreshToken, COACHING);
    assert.equal(res.statusCode, 401);
    assert.equal(res.json<ErrorJson>().error.code, 'invalid_refresh_token');
    // A mismatched client is not counted as a use: the right client can still refresh.
    assert.equal((await refresh(ctx, first.tokens.refreshToken)).statusCode, 200);
  });

  test('refuses an expired refresh token', async () => {
    ctx.clock.advance(30 * 24 * 3600 + 1);
    const res = await refresh(ctx, first.tokens.refreshToken);
    assert.equal(res.statusCode, 401);
    assert.equal(res.json<ErrorJson>().error.code, 'invalid_refresh_token');
  });

  test('rejects a missing token', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { clientId: HYPNOSE },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json<ErrorJson>().error.code, 'invalid_request');
  });
});

describe('POST /auth/signout', () => {
  test('ends the session: refresh and access tokens stop working', async () => {
    const { tokens } = (await signUp(ctx)).json<AuthBody>();
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/signout',
      payload: { refreshToken: tokens.refreshToken },
    });
    assert.equal(res.statusCode, 204);
    assert.equal((await refresh(ctx, tokens.refreshToken)).statusCode, 401);
    assert.equal((await me(ctx, tokens.accessToken)).statusCode, 401);
  });

  test('is idempotent and accepts unknown tokens', async () => {
    for (const refreshToken of ['unknown', 'unknown']) {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/signout',
        payload: { refreshToken },
      });
      assert.equal(res.statusCode, 204);
    }
  });

  test('only ends its own session', async () => {
    const a = (await signUp(ctx)).json<AuthBody>();
    const b = (await signIn(ctx, { clientId: COACHING })).json<AuthBody>();
    await ctx.app.inject({
      method: 'POST',
      url: '/auth/signout',
      payload: { refreshToken: a.tokens.refreshToken },
    });
    assert.equal((await me(ctx, b.tokens.accessToken)).statusCode, 200);
  });
});

describe('POST /auth/password-reset/request', () => {
  const request = (email: string) =>
    ctx.app.inject({
      method: 'POST',
      url: '/auth/password-reset/request',
      payload: { email, clientId: HYPNOSE },
    });

  test('answers 202 the same way for known and unknown emails', async () => {
    await signUp(ctx);
    const known = await request(' River@example.com ');
    const unknown = await request('nobody@example.com');
    const malformed = await request('not-an-email');
    for (const res of [known, unknown, malformed]) {
      assert.equal(res.statusCode, 202);
      assert.deepEqual(res.json(), { status: 'accepted' });
    }
    const links = ctx.logs.filter((l) => typeof l.resetLink === 'string');
    assert.equal(links.length, 1);
    assert.equal(links[0]?.email, 'river@example.com');
    assert.match(
      String(links[0]?.resetLink),
      /^http:\/\/localhost:4173\/reset-password\?token=[\w-]{43}$/,
    );
  });

  test('rejects an unknown client', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/password-reset/request',
      payload: { email: 'a@b.co', clientId: 'x' },
    });
    assert.equal(res.json<ErrorJson>().error.code, 'unknown_client');
  });
});

describe('POST /auth/password-reset/confirm', () => {
  const resetLink = () => {
    const link = [...ctx.logs].reverse().find((l) => typeof l.resetLink === 'string')?.resetLink;
    return new URL(String(link)).searchParams.get('token') ?? '';
  };
  const requestReset = () =>
    ctx.app.inject({
      method: 'POST',
      url: '/auth/password-reset/request',
      payload: { email: 'river@example.com', clientId: HYPNOSE },
    });
  const confirm = (token: string, password = 'brand new pass') =>
    ctx.app.inject({
      method: 'POST',
      url: '/auth/password-reset/confirm',
      payload: { token, password },
    });

  test('sets the new password once and ends every session', async () => {
    const before = (await signUp(ctx)).json<AuthBody>();
    const coach = (await signIn(ctx, { clientId: COACHING })).json<AuthBody>();
    await requestReset();
    const token = resetLink();
    const res = await confirm(token);
    assert.equal(res.statusCode, 204);

    assert.equal((await signIn(ctx)).statusCode, 401);
    assert.equal((await signIn(ctx, { password: 'brand new pass' })).statusCode, 200);
    for (const session of [before, coach]) {
      assert.equal((await me(ctx, session.tokens.accessToken)).statusCode, 401);
    }
    assert.equal((await refresh(ctx, before.tokens.refreshToken)).statusCode, 401);

    // Single use.
    const again = await confirm(token, 'yet another one');
    assert.equal(again.statusCode, 400);
    assert.equal(again.json<ErrorJson>().error.code, 'invalid_reset_token');
  });

  test('a newer reset makes older links stop working too', async () => {
    await signUp(ctx);
    await requestReset();
    const older = resetLink();
    await requestReset();
    const newer = resetLink();
    assert.equal((await confirm(newer)).statusCode, 204);
    assert.equal((await confirm(older)).json<ErrorJson>().error.code, 'invalid_reset_token');
  });

  test('refuses expired, unknown and weak', async () => {
    await signUp(ctx);
    await requestReset();
    const token = resetLink();
    const weak = await confirm(token, 'short');
    assert.equal(weak.json<ErrorJson>().error.code, 'weak_password');
    assert.equal(
      (await confirm('not-a-token')).json<ErrorJson>().error.code,
      'invalid_reset_token',
    );
    ctx.clock.advance(3601);
    assert.equal((await confirm(token)).json<ErrorJson>().error.code, 'invalid_reset_token');
    // The old password still works: nothing changed.
    assert.equal((await signIn(ctx)).statusCode, 200);
  });

  test('a deleted account cannot be reset', async () => {
    const { tokens } = (await signUp(ctx)).json<AuthBody>();
    await requestReset();
    const token = resetLink();
    await me(ctx, tokens.accessToken, 'DELETE');
    assert.equal((await confirm(token)).json<ErrorJson>().error.code, 'invalid_reset_token');
  });
});

describe('GET /me', () => {
  test('requires a bearer token', async () => {
    const none = await ctx.app.inject({ method: 'GET', url: '/me' });
    assert.equal(none.statusCode, 401);
    assert.equal(none.json<ErrorJson>().error.code, 'unauthorized');
    const basic = await ctx.app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: 'Basic abc' },
    });
    assert.equal(basic.statusCode, 401);
  });

  test('refuses garbage, tampered and foreign tokens', async () => {
    const { tokens } = (await signUp(ctx)).json<AuthBody>();
    const [header, payload, signature] = tokens.accessToken.split('.');
    const tampered = `${header}.${payload}.${signature?.slice(0, -2)}xx`;
    const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${payload}.`;
    const foreign = await makeApp({
      jwtSecret: new TextEncoder().encode('another-secret-another-secret!!'),
    });
    try {
      await signUp(foreign);
      const foreignToken = (await signIn(foreign)).json<AuthBody>().tokens.accessToken;
      for (const token of ['garbage', tampered, unsigned, foreignToken]) {
        const res = await me(ctx, token);
        assert.equal(res.statusCode, 401, token);
        assert.equal(res.json<ErrorJson>().error.code, 'unauthorized');
      }
    } finally {
      await foreign.close();
    }
  });
});

describe('DELETE /me', () => {
  test('deletes the account and ends every session in every app', async () => {
    const hyp = (await signUp(ctx)).json<AuthBody>();
    const coach = (await signIn(ctx, { clientId: COACHING })).json<AuthBody>();
    const res = await me(ctx, hyp.tokens.accessToken, 'DELETE');
    assert.equal(res.statusCode, 204);

    assert.equal(await ctx.repo.findUserById(hyp.user.id), null);
    assert.equal((await me(ctx, hyp.tokens.accessToken)).statusCode, 401);
    assert.equal((await me(ctx, coach.tokens.accessToken)).statusCode, 401);
    assert.equal((await refresh(ctx, hyp.tokens.refreshToken)).statusCode, 401);
    assert.equal((await refresh(ctx, coach.tokens.refreshToken, COACHING)).statusCode, 401);
    assert.deepEqual(await ctx.repo.listClientSignIns(hyp.user.id), []);

    const again = await signIn(ctx);
    assert.equal(again.statusCode, 401);
    assert.equal(again.json<ErrorJson>().error.code, 'invalid_credentials');
    // The email is free again.
    assert.equal((await signUp(ctx)).statusCode, 201);
  });

  test('requires a valid token', async () => {
    const res = await ctx.app.inject({ method: 'DELETE', url: '/me', payload: { password: 'x' } });
    assert.equal(res.statusCode, 401);
  });

  test('needs the password again: wrong or missing changes nothing', async () => {
    const hyp = (await signUp(ctx)).json<AuthBody>();
    const wrong = await me(ctx, hyp.tokens.accessToken, 'DELETE', 'not the password');
    assert.equal(wrong.statusCode, 401);
    assert.equal(wrong.json<ErrorJson>().error.code, 'invalid_credentials');
    const missing = await me(ctx, hyp.tokens.accessToken, 'DELETE', null);
    assert.equal(missing.statusCode, 400);
    // The account and the session are untouched.
    assert.equal((await me(ctx, hyp.tokens.accessToken)).statusCode, 200);
    assert.equal((await me(ctx, hyp.tokens.accessToken, 'DELETE')).statusCode, 204);
  });
});

describe('errors and CORS', () => {
  test('unknown routes return the error shape', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/nope' });
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.json(), { error: { code: 'not_found', message: 'Not found.' } });
  });

  test('malformed JSON returns invalid_request', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/signin',
      headers: { 'content-type': 'application/json' },
      payload: '{nope',
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json<ErrorJson>().error.code, 'invalid_request');
  });

  test('oversized bodies are refused', async () => {
    const res = await signUp(ctx, { displayName: 'x'.repeat(20_000) });
    assert.equal(res.statusCode, 413);
    assert.equal(res.json<ErrorJson>().error.code, 'invalid_request');
  });

  test('allows the web app origin and not others', async () => {
    const preflight = (origin: string) =>
      ctx.app.inject({
        method: 'OPTIONS',
        url: '/auth/signin',
        headers: { origin, 'access-control-request-method': 'POST' },
      });
    const ok = await preflight('http://localhost:4173');
    assert.equal(ok.headers['access-control-allow-origin'], 'http://localhost:4173');
    const bad = await preflight('https://evil.example');
    assert.equal(bad.headers['access-control-allow-origin'], undefined);
  });
});

describe('rate limiting', () => {
  test('limits auth attempts per client address and route', async () => {
    const limited = await makeApp({
      authRateLimit: { max: 3, windowMs: 60_000 },
      refreshRateLimit: { max: 100, windowMs: 60_000 },
    });
    let lastToken = '';
    try {
      for (let i = 0; i < 3; i++) {
        assert.equal((await signIn(limited, { password: 'wrong pass' })).statusCode, 401);
      }
      const blocked = await signIn(limited);
      assert.equal(blocked.statusCode, 429);
      assert.equal(blocked.json<ErrorJson>().error.code, 'rate_limited');
      assert.ok(Number(blocked.headers['retry-after']) > 0);
      // Other routes have their own budget, and non-auth routes are not limited.
      const { tokens } = (await signUp(limited, { email: 'other@example.com' })).json<AuthBody>();
      // Refresh has a separate, larger budget (silent, and every open app does it).
      for (let i = 0; i < 5; i++) {
        const res = await refresh(limited, i === 0 ? tokens.refreshToken : lastToken);
        assert.equal(res.statusCode, 200);
        lastToken = res.json<AuthBody>().tokens.refreshToken;
      }
      assert.equal((await signUp(limited)).statusCode, 201);
      for (let i = 0; i < 5; i++) {
        assert.equal((await limited.app.inject({ method: 'GET', url: '/health' })).statusCode, 200);
      }
    } finally {
      await limited.close();
    }
  });

  test('behind a trusted proxy, each forwarded client address has its own budget', async () => {
    const proxied = await makeApp({
      trustProxy: true,
      authRateLimit: { max: 1, windowMs: 60_000 },
    });
    try {
      const from = (ip: string) =>
        proxied.app.inject({
          method: 'POST',
          url: '/auth/signin',
          headers: { 'x-forwarded-for': ip },
          payload: { email: 'a@b.co', password: 'whatever1', clientId: HYPNOSE },
        });
      assert.equal((await from('203.0.113.1')).statusCode, 401);
      assert.equal((await from('203.0.113.2')).statusCode, 401);
      assert.equal((await from('203.0.113.1')).statusCode, 429);
    } finally {
      await proxied.close();
    }
  });
});
