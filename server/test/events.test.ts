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
});
