import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { MAX_EVENTS_PER_REQUEST } from '../src/events.ts';
import { makeApp, me, signUp, type AuthBody, type ErrorJson, type TestContext } from './helpers.ts';

let ctx: TestContext;
let token: string;
beforeEach(async () => {
  ctx = await makeApp();
  token = (await signUp(ctx)).json<AuthBody>().tokens.accessToken;
});
afterEach(async () => {
  await ctx.close();
});

const auth = () => ({ authorization: `Bearer ${token}` });

function completion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-0000001',
    type: 'sessionCompleted',
    stopId: 'intro-2',
    stopType: 'audio',
    at: ctx.clock.now - 1000,
    firstTime: true,
    ...overrides,
  };
}

const post = (url: string, payload: unknown) =>
  ctx.app.inject({ method: 'POST', url, headers: auth(), payload: payload as object });
const get = (url: string) => ctx.app.inject({ method: 'GET', url, headers: auth() });

type Events = { events: Record<string, unknown>[] };
type Entries = { entries: Record<string, unknown>[] };

describe('session completed events', () => {
  test('an event sent twice is stored once (idempotent retries)', async () => {
    const first = await post('/me/events', { events: [completion()] });
    assert.equal(first.statusCode, 200);
    assert.equal(first.json<Events>().events[0]!.firstTime, true);
    // A retry, even with a changed body, keeps what was stored.
    const again = await post('/me/events', { events: [completion({ firstTime: false })] });
    assert.equal(again.json<Events>().events[0]!.firstTime, true);
    const list = (await get('/me/events')).json<Events>().events;
    assert.equal(list.length, 1);
    assert.equal(list[0]!.id, 'evt-0000001');
  });

  test('the first-time reward is granted once per stop, whatever the clients claim', async () => {
    // Two devices finished the same stop offline; both claim the first completion.
    const res = await post('/me/events', {
      events: [completion(), completion({ id: 'evt-0000002', at: ctx.clock.now - 500 })],
    });
    const [a, b] = res.json<Events>().events;
    assert.equal(a!.firstTime, true);
    assert.equal(b!.firstTime, false);
    const later = await post('/me/events', { events: [completion({ id: 'evt-0000003' })] });
    assert.equal(later.json<Events>().events[0]!.firstTime, false);
    // Another stop has its own first time.
    const other = await post('/me/events', {
      events: [completion({ id: 'evt-0000004', stopId: 'intro-3' })],
    });
    assert.equal(other.json<Events>().events[0]!.firstTime, true);
  });

  test('times in the future are clamped to the server clock', async () => {
    const res = await post('/me/events', { events: [completion({ at: ctx.clock.now + 9e9 })] });
    assert.equal(res.json<Events>().events[0]!.at, ctx.clock.now);
  });

  test('refuses malformed events and oversized batches', async () => {
    for (const bad of [
      completion({ id: 'x' }),
      completion({ stopId: 'Bad Id' }),
      completion({ stopType: 'podcast' }),
      completion({ type: 'other' }),
      completion({ points: 1000 }),
    ]) {
      const res = await post('/me/events', { events: [bad] });
      assert.equal(res.statusCode, 400, JSON.stringify(bad));
    }
    const many = Array.from({ length: MAX_EVENTS_PER_REQUEST + 1 }, (_, i) =>
      completion({ id: `evt-${String(i).padStart(8, '0')}` }),
    );
    assert.equal((await post('/me/events', { events: many })).statusCode, 400);
    assert.equal((await post('/me/events', { events: [] })).statusCode, 400);
  });

  test('needs a signed-in user, and deleting the account removes the events', async () => {
    const anon = await ctx.app.inject({
      method: 'POST',
      url: '/me/events',
      payload: { events: [completion()] },
    });
    assert.equal(anon.statusCode, 401);
    await post('/me/events', { events: [completion()] });
    assert.equal((await me(ctx, token, 'DELETE')).statusCode, 204);
    const rows = await ctx.repo.listEvents('any', 'events', 10);
    assert.equal(rows.length, 0);
  });
});

describe('mood check-ins', () => {
  const entry = (overrides: Record<string, unknown> = {}) => ({
    id: 'mood-0000001',
    at: ctx.clock.now,
    phase: 'before',
    value: 3,
    stopId: 'intro-2',
    ...overrides,
  });

  async function putSettings(moodConsent: boolean) {
    const res = await ctx.app.inject({
      method: 'PUT',
      url: '/me/settings',
      headers: auth(),
      payload: {
        version: 1,
        updatedAt: ctx.clock.now,
        crocName: null,
        goals: [],
        experience: null,
        sessionLength: 'medium',
        reminder: { enabled: false, time: null, timeOfDay: null },
        moodConsent,
        safety: { answers: [false, false, false], cautionMode: false },
        sound: true,
        haptics: true,
      },
    });
    assert.equal(res.statusCode, 200);
  }

  test('are refused without consent (health data)', async () => {
    const none = await post('/me/mood', { entries: [entry()] });
    assert.equal(none.statusCode, 403);
    assert.equal(none.json<ErrorJson>().error.code, 'consent_required');
    await putSettings(false);
    assert.equal((await post('/me/mood', { entries: [entry()] })).statusCode, 403);
    assert.equal((await get('/me/mood')).json<Entries>().entries.length, 0);
  });

  test('are stored once with consent, and validated', async () => {
    await putSettings(true);
    const res = await post('/me/mood', { entries: [entry(), entry()] });
    assert.equal(res.statusCode, 200);
    await post('/me/mood', { entries: [entry(), entry({ id: 'mood-0000002', phase: 'after' })] });
    const list = (await get('/me/mood')).json<Entries>().entries;
    assert.deepEqual(
      list.map((e) => [e.id, e.phase, e.value]),
      [
        ['mood-0000001', 'before', 3],
        ['mood-0000002', 'after', 3],
      ],
    );
    for (const bad of [entry({ value: 6 }), entry({ phase: 'during' }), entry({ stopId: 7 })]) {
      assert.equal((await post('/me/mood', { entries: [bad] })).statusCode, 400);
    }
  });

  const onboardingWithMoods = () => ({
    version: 1,
    updatedAt: ctx.clock.now,
    step: 'done',
    completed: true,
    completedAt: ctx.clock.now,
    goals: ['sleep'],
    experience: 'new',
    timeOfDay: 'evening',
    sessionLength: 'short',
    safety: { answers: [false, false, false], acknowledged: false },
    moodConsent: true,
    crocHatched: true,
    crocName: 'Snap',
    firstSession: { completed: true, moodBefore: 2, moodAfter: 4 },
    reminder: 'skipped',
    rewardGranted: true,
  });
  const putOnboarding = (payload: object) =>
    ctx.app.inject({ method: 'PUT', url: '/me/onboarding', headers: auth(), payload });
  const del = (url: string) => ctx.app.inject({ method: 'DELETE', url, headers: auth() });

  test('DELETE /me/mood removes the stream and the onboarding moods, and nothing else', async () => {
    await putSettings(true);
    await putOnboarding(onboardingWithMoods());
    await post('/me/events', { events: [completion()] });
    await post('/me/mood', { entries: [entry(), entry({ id: 'mood-0000002', phase: 'after' })] });

    assert.equal((await del('/me/mood')).statusCode, 204);
    assert.equal((await get('/me/mood')).json<Entries>().entries.length, 0);
    const stored = (await get('/me/onboarding')).json<{ onboarding: Record<string, unknown> }>();
    assert.deepEqual(stored.onboarding.firstSession, {
      completed: true,
      moodBefore: null,
      moodAfter: null,
    });
    assert.equal(stored.onboarding.crocName, 'Snap');
    assert.equal((await get('/me/events')).json<Events>().events.length, 1);
    // Idempotent.
    assert.equal((await del('/me/mood')).statusCode, 204);
    assert.equal((await ctx.app.inject({ method: 'DELETE', url: '/me/mood' })).statusCode, 401);
  });

  test('storing settings with consent withdrawn purges mood data (a delete that never arrived)', async () => {
    await putSettings(true);
    await putOnboarding(onboardingWithMoods());
    await post('/me/mood', { entries: [entry()] });
    ctx.clock.advance(10);
    await putSettings(false);
    assert.equal((await get('/me/mood')).json<Entries>().entries.length, 0);
    const stored = (await get('/me/onboarding')).json<{
      onboarding: { firstSession: Record<string, unknown> };
    }>();
    assert.equal(stored.onboarding.firstSession.moodBefore, null);
  });

  const FIELDS = [
    'crocName',
    'goals',
    'experience',
    'sessionLength',
    'reminder',
    'moodConsent',
    'safety',
    'sound',
    'haptics',
    'reducedMotion',
  ];
  /** A settings copy as the current app writes it: per-field stamps (`base`, some overridden). */
  function stamped(
    updatedAt: number,
    values: Record<string, unknown>,
    base: number,
    changed: Record<string, number>,
  ) {
    return {
      version: 1,
      updatedAt,
      crocName: 'Snap',
      goals: ['sleep'],
      experience: 'new',
      sessionLength: 'medium',
      reminder: { enabled: true, time: '20:00', timeOfDay: 'evening' },
      moodConsent: false,
      safety: { answers: [true, false, false], cautionMode: true },
      sound: true,
      haptics: true,
      reducedMotion: null,
      ...values,
      fieldsAt: { doc: updatedAt, ...Object.fromEntries(FIELDS.map((f) => [f, base])), ...changed },
    };
  }
  const putStamped = async (doc: object) => {
    const res = await ctx.app.inject({
      method: 'PUT',
      url: '/me/settings',
      headers: auth(),
      payload: doc,
    });
    assert.equal(res.statusCode, 200);
    return res.json<{ settings: Record<string, unknown> }>().settings;
  };

  test('a stale copy that says no consent and changes another field purges nothing', async () => {
    const t0 = ctx.clock.now - 1000;
    await putStamped(stamped(t0, {}, t0, {}));
    // The phone turns consent on and records moods.
    const t1 = ctx.clock.now - 500;
    await putStamped(stamped(t1, { moodConsent: true }, t0, { moodConsent: t1 }));
    await putOnboarding(onboardingWithMoods());
    await post('/me/mood', { entries: [entry()] });
    // A stale tab still holding consent off turns the sound off.
    const t2 = ctx.clock.now;
    const stored = await putStamped(stamped(t2, { sound: false }, t0, { sound: t2 }));
    assert.equal(stored.moodConsent, true);
    assert.equal(stored.sound, false);
    assert.equal((await get('/me/mood')).json<Entries>().entries.length, 1);
    const onboarding = (await get('/me/onboarding')).json<{
      onboarding: { firstSession: Record<string, unknown> };
    }>().onboarding;
    assert.equal(onboarding.firstSession.moodBefore, 2);
  });

  test('a stale copy that says consent never grants it again', async () => {
    const t1 = ctx.clock.now - 1000;
    await putStamped(stamped(t1, { moodConsent: true }, t1, {}));
    await post('/me/mood', { entries: [entry()] });
    const t2 = ctx.clock.now - 500;
    await putStamped(stamped(t2, { moodConsent: false }, t1, { moodConsent: t2 }));
    assert.equal((await get('/me/mood')).json<Entries>().entries.length, 0);
    // A stale device (consent on as of t1) changes the haptics.
    const t3 = ctx.clock.now;
    const stored = await putStamped(
      stamped(t3, { moodConsent: true, haptics: false }, t1, { haptics: t3 }),
    );
    assert.equal(stored.moodConsent, false);
    assert.equal(stored.haptics, false);
    assert.equal((await post('/me/mood', { entries: [entry()] })).statusCode, 403);
  });

  test('a settings edit made on top of the defaults keeps the stored values', async () => {
    // What a device sends when it changed the sound before the server's settings arrived.
    const t0 = ctx.clock.now - 1000;
    await putStamped(stamped(t0, { moodConsent: true }, t0, {}));
    await post('/me/mood', { entries: [entry()] });
    const t1 = ctx.clock.now;
    const stored = await putStamped({
      version: 1,
      updatedAt: t1,
      crocName: null,
      goals: [],
      experience: null,
      sessionLength: 'medium',
      reminder: { enabled: false, time: null, timeOfDay: null },
      moodConsent: false,
      safety: { answers: [null, null, null], cautionMode: false },
      sound: false,
      haptics: true,
      fieldsAt: { doc: t1, ...Object.fromEntries(FIELDS.map((f) => [f, 0])), sound: t1 },
    });
    assert.equal(stored.sound, false);
    assert.equal(stored.moodConsent, true);
    assert.deepEqual(stored.safety, { answers: [true, false, false], cautionMode: true });
    assert.deepEqual(stored.reminder, { enabled: true, time: '20:00', timeOfDay: 'evening' });
    assert.equal(stored.crocName, 'Snap');
    assert.equal((await get('/me/mood')).json<Entries>().entries.length, 1);
  });

  test('onboarding moods sent after consent was withdrawn are not stored', async () => {
    await putSettings(true);
    await putOnboarding(onboardingWithMoods());
    ctx.clock.advance(10);
    await putSettings(false);
    // A stale device writes its onboarding copy back (moods and all), even a newer one.
    for (const updatedAt of [ctx.clock.now - 10, ctx.clock.now]) {
      const res = await putOnboarding({ ...onboardingWithMoods(), updatedAt });
      assert.equal(res.statusCode, 200);
      const doc = res.json<{ onboarding: Record<string, unknown> }>().onboarding;
      assert.deepEqual(doc.firstSession, { completed: true, moodBefore: null, moodAfter: null });
      assert.equal(doc.moodConsent, false);
      assert.ok((doc.updatedAt as number) > updatedAt, 'newer than the copy that was sent');
    }
  });

  test('an older app writing whole documents still works, and keeps the motion choice', async () => {
    const t0 = ctx.clock.now - 1000;
    await putStamped(stamped(t0, { reducedMotion: true }, t0, {}));
    // No stamps and no reduced-motion field: written whole at its updatedAt.
    const t1 = ctx.clock.now - 500;
    const { fieldsAt: _f, reducedMotion: _r, ...legacy } = stamped(t1, { sound: false }, t1, {});
    const stored = await putStamped(legacy);
    assert.equal(stored.sound, false);
    assert.equal(stored.reducedMotion, true);
    // Newer than what it sent, so that app takes the stored copy instead of resending its own.
    assert.equal(stored.updatedAt, t1 + 1);
    // Its next write keeps the stamps it was given (now stale): still written whole.
    const t2 = ctx.clock.now;
    const again = await putStamped({
      ...stored,
      storedAt: undefined,
      updatedAt: t2,
      haptics: false,
    });
    assert.equal(again.haptics, false);
    assert.equal(again.sound, false);
  });

  test('GET /me/export returns the account, documents and both streams', async () => {
    await putSettings(true);
    await post('/me/events', { events: [completion()] });
    await post('/me/mood', { entries: [entry()] });
    const res = await get('/me/export');
    assert.equal(res.statusCode, 200);
    const body = res.json<{
      exportedAt: string;
      account: { email: string };
      documents: Record<string, unknown>;
      sessionEvents: unknown[];
      moodEntries: unknown[];
    }>();
    assert.equal(body.account.email, 'river@example.com');
    assert.equal(body.documents.onboarding, null);
    assert.ok(body.documents.settings);
    assert.equal(body.sessionEvents.length, 1);
    assert.equal(body.moodEntries.length, 1);
    assert.ok(!JSON.stringify(body).includes('passwordHash'));
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/me/export' })).statusCode, 401);
  });
});
