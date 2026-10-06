import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { CROC_NAME_MAX } from '../src/documents.ts';
import {
  COACHING,
  makeApp,
  me,
  signIn,
  signUp,
  type AuthBody,
  type ErrorJson,
  type TestContext,
} from './helpers.ts';

let ctx: TestContext;
let token: string;
beforeEach(async () => {
  ctx = await makeApp();
  token = (await signUp(ctx)).json<AuthBody>().tokens.accessToken;
});
afterEach(async () => {
  await ctx.close();
});

function onboarding(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    updatedAt: ctx.clock.now,
    step: 'safety',
    completed: false,
    completedAt: null,
    goals: ['sleep', 'focus'],
    experience: 'new',
    timeOfDay: 'evening',
    sessionLength: 'short',
    safety: { answers: [false, null, null], acknowledged: false },
    moodConsent: null,
    crocHatched: false,
    crocName: null,
    firstSession: { completed: false, moodBefore: null, moodAfter: null },
    reminder: null,
    rewardGranted: false,
    ...overrides,
  };
}

function settings(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    updatedAt: ctx.clock.now,
    crocName: 'Croc 🐊',
    goals: ['sleep'],
    experience: 'experienced',
    sessionLength: 'medium',
    reminder: { enabled: true, time: '20:30', timeOfDay: 'evening' },
    moodConsent: true,
    safety: { answers: [false, false, true], cautionMode: true },
    sound: true,
    haptics: false,
    ...overrides,
  };
}

const get = (kind: string, accessToken = token) =>
  ctx.app.inject({
    method: 'GET',
    url: `/me/${kind}`,
    headers: { authorization: `Bearer ${accessToken}` },
  });

const put = (kind: string, body: Record<string, unknown>, accessToken = token) =>
  ctx.app.inject({
    method: 'PUT',
    url: `/me/${kind}`,
    headers: { authorization: `Bearer ${accessToken}` },
    payload: body,
  });

type DocBody = Record<string, Record<string, unknown> | null>;

describe('GET/PUT /me/onboarding', () => {
  test('starts empty, stores the document and reads it back with storedAt', async () => {
    const empty = await get('onboarding');
    assert.equal(empty.statusCode, 200);
    assert.deepEqual(empty.json(), { onboarding: null });

    const doc = onboarding();
    const res = await put('onboarding', doc);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json<DocBody>().onboarding, { ...doc, storedAt: ctx.clock.now });

    ctx.clock.advance(10);
    const again = await get('onboarding');
    assert.deepEqual(again.json<DocBody>().onboarding, {
      ...doc,
      storedAt: ctx.clock.now - 10_000,
    });
  });

  test('last write wins: an older write is ignored and the newer document comes back', async () => {
    const newer = onboarding({ step: 'hatch', updatedAt: ctx.clock.now + 5000 });
    await put('onboarding', newer);
    const older = onboarding({ step: 'goals', updatedAt: ctx.clock.now });
    const res = await put('onboarding', older);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json<DocBody>().onboarding?.step, 'hatch');
    assert.equal((await get('onboarding')).json<DocBody>().onboarding?.step, 'hatch');

    // The same time overwrites (a retried write is idempotent), a later one replaces; the
    // furthest step is one way, so it stays.
    const same = onboarding({ step: 'consent', goals: ['focus'], updatedAt: ctx.clock.now + 5000 });
    const sameRes = (await put('onboarding', same)).json<DocBody>().onboarding;
    assert.deepEqual(sameRes?.goals, ['focus']);
    assert.equal(sameRes?.step, 'hatch');
    const later = onboarding({ step: 'done', completed: true, updatedAt: ctx.clock.now + 6000 });
    assert.equal((await put('onboarding', later)).json<DocBody>().onboarding?.completed, true);
  });

  test('clamps a timestamp from the future to the server time', async () => {
    const future = await put('onboarding', onboarding({ updatedAt: ctx.clock.now + 3_600_000 }));
    assert.equal(future.statusCode, 200);
    assert.equal(future.json<DocBody>().onboarding?.updatedAt, ctx.clock.now);
    // A later honest write from another device still wins.
    ctx.clock.advance(5);
    const honest = await put(
      'onboarding',
      onboarding({ step: 'consent', updatedAt: ctx.clock.now }),
    );
    assert.equal(honest.json<DocBody>().onboarding?.step, 'consent');
  });

  test('a finished onboarding is never replaced by an unfinished one', async () => {
    const done = onboarding({
      step: 'done',
      completed: true,
      completedAt: ctx.clock.now,
      crocHatched: true,
      crocName: 'Zed',
      firstSession: { completed: true, moodBefore: null, moodAfter: null },
      reminder: 'skipped',
      rewardGranted: true,
      updatedAt: ctx.clock.now,
    });
    assert.equal((await put('onboarding', done)).statusCode, 200);
    // A stale tab or device writes a newer, unfinished copy: the finished one stays and comes back.
    ctx.clock.advance(60);
    const stale = await put(
      'onboarding',
      onboarding({ step: 'experience', updatedAt: ctx.clock.now }),
    );
    assert.equal(stale.statusCode, 200);
    assert.equal(stale.json<DocBody>().onboarding?.completed, true);
    assert.equal(stale.json<DocBody>().onboarding?.crocName, 'Zed');
    assert.equal((await get('onboarding')).json<DocBody>().onboarding?.completed, true);
    // A finished copy replaces an unfinished one even when it is older.
    const other = (await signUp(ctx, { email: 'two@example.com' })).json<AuthBody>();
    const tok = other.tokens.accessToken;
    await put('onboarding', onboarding({ step: 'hatch', updatedAt: ctx.clock.now }), tok);
    const olderDone = await put('onboarding', { ...done, updatedAt: ctx.clock.now - 10_000 }, tok);
    assert.equal(olderDone.json<DocBody>().onboarding?.completed, true);
  });

  test('one-way facts of an unfinished onboarding survive an older copy', async () => {
    await put(
      'onboarding',
      onboarding({
        step: 'firstSession',
        crocHatched: true,
        crocName: 'Zed',
        firstSession: { completed: true, moodBefore: null, moodAfter: null },
        updatedAt: ctx.clock.now,
      }),
    );
    ctx.clock.advance(5);
    const res = await put('onboarding', onboarding({ step: 'safety', updatedAt: ctx.clock.now }));
    assert.deepEqual(
      {
        step: res.json<DocBody>().onboarding?.step,
        crocHatched: res.json<DocBody>().onboarding?.crocHatched,
        crocName: res.json<DocBody>().onboarding?.crocName,
        first: (res.json<DocBody>().onboarding?.firstSession as { completed: boolean }).completed,
      },
      { step: 'firstSession', crocHatched: true, crocName: 'Zed', first: true },
    );
  });

  test('refuses mood values without consent', async () => {
    for (const consent of [false, null]) {
      const res = await put(
        'onboarding',
        onboarding({
          moodConsent: consent,
          firstSession: { completed: true, moodBefore: 3, moodAfter: null },
        }),
      );
      assert.equal(res.statusCode, 400, String(consent));
      assert.equal(res.json<ErrorJson>().error.fields?.firstSession, 'invalid_request');
    }
    const ok = await put(
      'onboarding',
      onboarding({
        moodConsent: true,
        firstSession: { completed: true, moodBefore: 3, moodAfter: 5 },
      }),
    );
    assert.equal(ok.statusCode, 200);
  });

  test('rejects unknown fields and bad values', async () => {
    const cases: [string, Record<string, unknown>][] = [
      ['unknown field', { extra: 1 }],
      ['unknown version', { version: 2 }],
      ['three goals', { goals: ['sleep', 'stress', 'focus'] }],
      ['duplicate goals', { goals: ['sleep', 'sleep'] }],
      ['unknown goal', { goals: ['money'] }],
      ['unknown step', { step: 'nowhere' }],
      ['two safety answers', { safety: { answers: [true, false], acknowledged: false } }],
      ['mood out of range', { firstSession: { completed: true, moodBefore: 6, moodAfter: null } }],
      ['string where boolean', { completed: 'yes' }],
      ['missing field', { reminder: undefined }],
    ];
    for (const [label, overrides] of cases) {
      const res = await put('onboarding', onboarding(overrides));
      assert.equal(res.statusCode, 400, label);
      assert.equal(res.json<ErrorJson>().error.code, 'invalid_request', label);
    }
    // Nothing invalid was stored.
    assert.deepEqual((await get('onboarding')).json(), { onboarding: null });
  });

  test('the croc name: 1 to 20 code points, trimmed, emoji fine, no control characters', async () => {
    const ok = await put('onboarding', onboarding({ crocHatched: true, crocName: 'Zé 🐊🐊' }));
    assert.equal(ok.statusCode, 200);
    const twenty = await put('onboarding', onboarding({ crocName: '🐊'.repeat(CROC_NAME_MAX) }));
    assert.equal(twenty.statusCode, 200, 'twenty emoji');
    for (const name of ['', ' ', ' Croc', '🐊'.repeat(CROC_NAME_MAX + 1), 'Cr\u0007oc']) {
      const res = await put('onboarding', onboarding({ crocName: name }));
      assert.equal(res.statusCode, 400, JSON.stringify(name));
      assert.equal(res.json<ErrorJson>().error.fields?.crocName, 'invalid_request');
    }
  });

  test('requires a valid token', async () => {
    assert.equal((await get('onboarding', 'nope')).statusCode, 401);
    assert.equal((await put('onboarding', onboarding(), 'nope')).statusCode, 401);
    const none = await ctx.app.inject({ method: 'GET', url: '/me/onboarding' });
    assert.equal(none.statusCode, 401);
  });

  test('is per user, shared across the two apps, and gone with the account', async () => {
    await put('onboarding', onboarding({ step: 'done', completed: true }));
    const other = (await signUp(ctx, { email: 'other@example.com' })).json<AuthBody>();
    assert.deepEqual((await get('onboarding', other.tokens.accessToken)).json(), {
      onboarding: null,
    });
    // Signed in from the Coaching app, the same account sees the same document.
    const coach = (await signIn(ctx, { clientId: COACHING })).json<AuthBody>();
    assert.equal(
      (await get('onboarding', coach.tokens.accessToken)).json<DocBody>().onboarding?.completed,
      true,
    );

    await me(ctx, token, 'DELETE');
    const fresh = (await signUp(ctx)).json<AuthBody>();
    assert.deepEqual((await get('onboarding', fresh.tokens.accessToken)).json(), {
      onboarding: null,
    });
  });
});

describe('GET/PUT /me/settings', () => {
  test('stores and reads settings', async () => {
    assert.deepEqual((await get('settings')).json(), { settings: null });
    const doc = settings();
    const res = await put('settings', doc);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json<DocBody>().settings, { ...doc, storedAt: ctx.clock.now });
    assert.equal((await get('settings')).json<DocBody>().settings?.crocName, 'Croc 🐊');
  });

  test('validates the reminder time and the enums', async () => {
    const cases: [string, Record<string, unknown>][] = [
      ['bad time', { reminder: { enabled: true, time: '25:00', timeOfDay: 'morning' } }],
      ['time format', { reminder: { enabled: true, time: '8:00', timeOfDay: 'morning' } }],
      ['unknown length', { sessionLength: 'forever' }],
      ['safety flag missing', { safety: { answers: [null, null, null] } }],
      ['null consent', { moodConsent: null }],
      ['extra field', { theme: 'night' }],
    ];
    for (const [label, overrides] of cases) {
      const res = await put('settings', settings(overrides));
      assert.equal(res.statusCode, 400, label);
    }
    const off = await put(
      'settings',
      settings({ reminder: { enabled: false, time: null, timeOfDay: null }, crocName: null }),
    );
    assert.equal(off.statusCode, 200);
  });

  test('the two documents are independent', async () => {
    await put('settings', settings());
    assert.deepEqual((await get('onboarding')).json(), { onboarding: null });
    await put('onboarding', onboarding());
    assert.equal((await get('settings')).json<DocBody>().settings?.sessionLength, 'medium');
  });

  test('an unknown document kind is not found', async () => {
    const res = await get('croc-diary');
    assert.equal(res.statusCode, 404);
  });

  test('CORS allows PUT from the web app', async () => {
    const res = await ctx.app.inject({
      method: 'OPTIONS',
      url: '/me/settings',
      headers: { origin: 'http://localhost:4173', 'access-control-request-method': 'PUT' },
    });
    assert.match(String(res.headers['access-control-allow-methods']), /PUT/);
  });
});

describe('GET/PUT /me/progress', () => {
  const at = () => ctx.clock.now;
  const done = (t: number, completedAt = t) => ({ status: 'done', updatedAt: t, completedAt });
  const started = (t: number) => ({ status: 'inProgress', updatedAt: t, completedAt: null });
  const progress = (stops: Record<string, unknown>, updatedAt = at()) => ({
    version: 1,
    updatedAt,
    stops,
  });
  const stopsOf = async () =>
    (await get('progress')).json<{ progress: { stops: Record<string, unknown> } }>().progress.stops;

  test('starts empty, stores and reads back', async () => {
    assert.deepEqual((await get('progress')).json(), { progress: null });
    const doc = progress({ 'intro-1': done(at()), 'intro-2': started(at()) });
    const res = await put('progress', doc);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json<DocBody>().progress, { ...doc, storedAt: at() });
  });

  test('merges per stop: a stale copy never undoes a finished stop', async () => {
    await put('progress', progress({ 'intro-1': done(at() - 1000), 'intro-2': done(at()) }));
    // A stale device, newer document timestamp, knows intro-2 only as started.
    const stale = progress({ 'intro-2': started(at() + 10), 'intro-3': started(at()) }, at() + 50);
    const res = await put('progress', stale);
    assert.deepEqual(res.json<DocBody>().progress?.stops, {
      'intro-1': done(at() - 1000),
      'intro-2': done(at()),
      'intro-3': started(at()),
    });
  });

  test('keeps the first completion time; newer unfinished records win', async () => {
    await put('progress', progress({ 'sleep-1': done(at(), at() - 500), 'sleep-2': started(1) }));
    await put('progress', progress({ 'sleep-1': done(at() + 5, at()), 'sleep-2': started(2) }));
    assert.deepEqual(await stopsOf(), {
      'sleep-1': done(at() + 5, at() - 500),
      'sleep-2': started(2),
    });
  });

  test('is idempotent: the same write twice stores the same thing', async () => {
    const doc = progress({ 'intro-1': done(at()) });
    const first = (await put('progress', doc)).json<DocBody>().progress;
    const second = (await put('progress', doc)).json<DocBody>().progress;
    assert.deepEqual(first?.stops, second?.stops);
    assert.equal(first?.updatedAt, second?.updatedAt);
  });

  test('rejects bad stop ids, statuses and inconsistent records', async () => {
    for (const stops of [
      { 'Intro 1': done(at()) },
      { 'intro-1': { status: 'skipped', updatedAt: 1, completedAt: null } },
      { 'intro-1': { status: 'done', updatedAt: 1, completedAt: null } },
      { 'intro-1': { status: 'inProgress', updatedAt: 1, completedAt: 1 } },
      { 'intro-1': { ...done(at()), extra: true } },
    ]) {
      const res = await put('progress', progress(stops));
      assert.equal(res.statusCode, 400, JSON.stringify(stops));
    }
    assert.deepEqual((await get('progress')).json(), { progress: null });
  });

  test('is per user', async () => {
    await put('progress', progress({ 'intro-1': done(at()) }));
    const other = (await signUp(ctx, { email: 'other@example.com' })).json<AuthBody>().tokens
      .accessToken;
    assert.deepEqual((await get('progress', other)).json(), { progress: null });
  });
});
