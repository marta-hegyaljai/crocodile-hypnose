import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { makeApp, PASSWORD, signIn, signUp, type AuthBody, type TestContext } from './helpers.ts';
import { serverContent } from '../src/content.ts';
import {
  BADGE_POINTS,
  DEFAULT_WEEKLY_TARGET,
  deriveNewEntries,
  type ActivityEvent,
  FIRST_TIME_BONUS,
  GAME_POINTS,
  MAX_BACKDATE_MS,
  MAX_COUNTED_PER_ARRIVAL_DAY,
  MAX_COUNTED_PER_DAY,
  SESSION_POINTS,
  WEEKLY_GOAL_POINTS,
} from '../../src/services/gamification/shared/rules.ts';

let ctx: TestContext;
let token: string;
let seq = 0;

async function start(overrides: Parameters<typeof makeApp>[0] = {}) {
  ctx = await makeApp(overrides);
  token = (await signUp(ctx)).json<AuthBody>().tokens.accessToken;
}
afterEach(async () => {
  await ctx.close();
});

/** Moves the clock a day on (the access token expires meanwhile: sign in again). */
async function nextDay() {
  ctx.clock.advance(86_400);
  token = (await signIn(ctx)).json<AuthBody>().tokens.accessToken;
}

const auth = () => ({ authorization: `Bearer ${token}` });
const req = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
  ctx.app.inject({ method, url, headers: auth(), payload: payload as object });

const nextId = () => `evt-${String(++seq).padStart(8, '0')}`;
const session = (stopId: string, over: Record<string, unknown> = {}) => ({
  id: nextId(),
  type: 'sessionCompleted',
  stopId,
  stopType: 'audio',
  at: ctx.clock.now - 1000,
  firstTime: true,
  ...over,
});
const game = (gameId: string, over: Record<string, unknown> = {}) => ({
  id: nextId(),
  type: 'gameCompleted',
  gameId,
  at: ctx.clock.now - 1000,
  ...over,
});

interface Points {
  balance: number;
  calmSeconds: number;
  badges: { id: string; at: number }[];
  owned: { itemId: string; at: number }[];
  entries: { key: string; kind: string; points: number }[];
}
const points = async () => (await req('GET', '/me/points')).json<{ points: Points }>().points;
const events = async (...items: unknown[]) => {
  const res = await req('POST', '/me/events', { events: items });
  assert.equal(res.statusCode, 200, res.body);
  return res.json<{ events: Record<string, unknown>[] }>().events;
};

/** The stored ledger equals a derivation from scratch over the stored events (deterministic). */
async function replaysTheSame() {
  const userId = (await req('GET', '/me')).json<{ user: { id: string } }>().user.id;
  const user = (await req('GET', '/me')).json<{ user: { createdAt: string } }>().user;
  const stored = await ctx.repo.listLedger(userId);
  const evs = await ctx.repo.listEvents(userId, 'events', 20_000);
  const replay = deriveNewEntries({
    events: evs.map((e) => ({ ...(e.data as object), storedAt: e.storedAt }) as ActivityEvent),
    ledger: [],
    content: serverContent(),
    weeklyTarget: DEFAULT_WEEKLY_TARGET,
    timeZone: null,
    onboardingRewarded: false,
    accountCreatedAt: Date.parse(user.createdAt),
  });
  const norm = (l: { key: string; points: number; at: number }[]) =>
    l.map((e) => `${e.key}:${e.points}:${e.at}`).sort();
  assert.deepEqual(norm(replay), norm(stored));
}

describe('points ledger', () => {
  beforeEach(() => start());

  test('sessions earn their type points, a first-time bonus once per stop and a badge', async () => {
    assert.equal((await points()).balance, 0);
    await events(session('intro-1'), session('intro-2'));
    const p = await points();
    const expected =
      SESSION_POINTS.video + SESSION_POINTS.audio + 2 * FIRST_TIME_BONUS + BADGE_POINTS;
    assert.equal(p.balance, expected);
    assert.equal(p.calmSeconds, 240 + 180);
    assert.deepEqual(
      p.badges.map((b) => b.id),
      ['firstSession'],
    );
    // Reading again changes nothing.
    assert.equal((await points()).balance, expected);
  });

  test('replaying an event, or claiming another type or first time, earns nothing extra', async () => {
    const e = session('intro-2', { stopType: 'longTrance' });
    const [stored] = await events(e);
    assert.equal(stored!.stopType, 'audio');
    const before = (await points()).balance;
    await events(e, { ...e, firstTime: true });
    // A second device finishing the same stop: base points again, but no second bonus.
    const [second] = await events(session('intro-2', { firstTime: true }));
    assert.equal(second!.firstTime, false);
    assert.equal((await points()).balance, before + SESSION_POINTS.audio);
  });

  test('the server decides first time alone (a client "not first" claim is ignored)', async () => {
    const [stored] = await events(session('intro-3', { firstTime: false, stopType: 'game' }));
    assert.equal(stored!.firstTime, true);
  });

  test('an unknown stop is stored but earns nothing, and does not hold up the batch', async () => {
    const list = await events(session('nowhere-1'), session('intro-1'));
    assert.equal(list.length, 2);
    assert.equal(list[0]!.firstTime, false);
    const p = await points();
    assert.equal(p.balance, SESSION_POINTS.video + FIRST_TIME_BONUS + BADGE_POINTS);
  });

  test('games earn points and a badge per kind; crafted floods are capped per day', async () => {
    await events(game('stillness'));
    let p = await points();
    assert.equal(p.balance, GAME_POINTS + BADGE_POINTS);
    assert.deepEqual(
      p.badges.map((b) => b.id),
      ['firstStillness'],
    );
    const flood = Array.from({ length: 30 }, () => game('breathing'));
    await events(...flood);
    p = await points();
    const games = p.entries.filter((e) => e.kind === 'game').length;
    assert.ok(games <= MAX_COUNTED_PER_DAY);
    assert.equal(
      p.balance,
      MAX_COUNTED_PER_DAY * GAME_POINTS + 2 * BADGE_POINTS,
      'twelve games and two badges',
    );
  });

  test('events dated long before the account existed do not count', async () => {
    await events(session('intro-1', { at: ctx.clock.now - 3 * 86_400_000 }));
    assert.equal((await points()).balance, 0);
  });

  test('back-dated bursts stay bounded by the arrival-day cap and the back-date window', async () => {
    // An account 100 days old.
    for (let i = 0; i < 100; i++) ctx.clock.advance(86_400);
    token = (await signIn(ctx)).json<AuthBody>().tokens.accessToken;
    const now = ctx.clock.now;
    // A script posts 12 fresh games on each of the 60 past days, all at once.
    const burst = Array.from({ length: 60 * MAX_COUNTED_PER_DAY }, (_, i) =>
      game('breathing', { at: now - (1 + Math.floor(i / MAX_COUNTED_PER_DAY)) * 86_400_000 }),
    );
    for (let i = 0; i < burst.length; i += 50) await events(...burst.slice(i, i + 50));
    const p = await points();
    const paid = p.entries.filter((e) => e.kind === 'game');
    assert.ok(paid.length <= MAX_COUNTED_PER_ARRIVAL_DAY, `${paid.length} games paid`);
    // Nothing older than the window is paid, and the day badges / weekly goals follow paid days only.
    assert.ok(
      p.balance <=
        MAX_COUNTED_PER_ARRIVAL_DAY * GAME_POINTS + 10 * BADGE_POINTS + 3 * WEEKLY_GOAL_POINTS,
      `balance ${p.balance}`,
    );
    assert.ok(!p.badges.some((b) => b.id === 'days30'));
    // The same events a day later (arrival day changes): still nothing for the old ones.
    const old = Array.from({ length: 5 }, () => game('firefly', { at: now - 40 * 86_400_000 }));
    const before = (await points()).balance;
    await events(...old);
    assert.equal((await points()).balance, before, 'older than the window pays nothing');
    assert.ok(40 * 86_400_000 > MAX_BACKDATE_MS);
    await replaysTheSame();
  });

  test('an event done offline three days ago pays on its own, and replaying gives the same ledger', async () => {
    for (let i = 0; i < 10; i++) ctx.clock.advance(86_400);
    token = (await signIn(ctx)).json<AuthBody>().tokens.accessToken;
    await events(session('intro-1', { at: ctx.clock.now - 3 * 86_400_000 }));
    const p = await points();
    assert.equal(p.balance, SESSION_POINTS.video + FIRST_TIME_BONUS + BADGE_POINTS);
    await replaysTheSame();
  });

  test('the onboarding reward is paid once', async () => {
    const now = ctx.clock.now;
    const onboarding = {
      version: 1,
      updatedAt: now,
      step: 'done',
      completed: true,
      completedAt: now,
      goals: [],
      experience: 'new',
      timeOfDay: 'evening',
      sessionLength: 'short',
      safety: { answers: [false, false, false], acknowledged: false },
      moodConsent: false,
      crocHatched: true,
      crocName: 'Zé',
      firstSession: { completed: true, moodBefore: null, moodAfter: null },
      reminder: 'skipped',
      rewardGranted: true,
    };
    assert.equal((await req('PUT', '/me/onboarding', onboarding)).statusCode, 200);
    assert.equal((await points()).balance, 50);
    assert.equal((await points()).balance, 50);
  });

  test('the weekly goal pays once per week, in the user’s time zone', async () => {
    const doc = {
      version: 1,
      updatedAt: ctx.clock.now,
      weeklyTarget: 3,
      timeZone: 'Europe/Berlin',
      seenStage: 'hatchling',
      celebratedWeek: null,
    };
    assert.equal((await req('PUT', '/me/gamification', doc)).statusCode, 200);
    // Thursday, Friday, Saturday of the same week (2026-01-01 is a Thursday).
    await events(game('stillness'));
    await nextDay();
    await events(game('stillness'));
    await nextDay();
    await events(game('stillness'), game('firefly'));
    const p = await points();
    const weeks = p.entries.filter((e) => e.kind === 'weeklyGoal');
    assert.equal(weeks.length, 1);
    assert.equal(weeks[0]!.points, WEEKLY_GOAL_POINTS);
    assert.ok(p.badges.some((b) => b.id === 'days3'));
    // Lowering the target later pays nothing twice.
    await req('PUT', '/me/gamification', { ...doc, weeklyTarget: 3, updatedAt: ctx.clock.now });
    assert.equal((await points()).entries.filter((e) => e.kind === 'weeklyGoal').length, 1);
  });

  test('an invalid time zone is refused', async () => {
    const res = await req('PUT', '/me/gamification', {
      version: 1,
      updatedAt: ctx.clock.now,
      weeklyTarget: 4,
      timeZone: 'Mars/Olympus',
      seenStage: 'hatchling',
      celebratedWeek: null,
    });
    assert.equal(res.statusCode, 400);
  });

  test('the growth marks only move forward', async () => {
    const base = {
      version: 1,
      weeklyTarget: 4,
      timeZone: null,
      celebratedWeek: 5,
    };
    await req('PUT', '/me/gamification', { ...base, updatedAt: 10, seenStage: 'adult' });
    const res = await req('PUT', '/me/gamification', {
      ...base,
      updatedAt: 20,
      seenStage: 'juvenile',
      celebratedWeek: 3,
      weeklyTarget: 6,
    });
    const stored = res.json<{ gamification: Record<string, unknown> }>().gamification;
    assert.equal(stored.seenStage, 'adult');
    assert.equal(stored.celebratedWeek, 5);
    assert.equal(stored.weeklyTarget, 6);
  });
});

describe('decorations', () => {
  beforeEach(() => start());

  const buy = (itemId: string) => req('POST', '/me/habitat/purchases', { itemId });

  test('buying needs enough points, is idempotent and never goes below zero', async () => {
    const poor = await buy('lilyPads');
    assert.equal(poor.statusCode, 409);
    assert.equal(poor.json<{ error: { code: string } }>().error.code, 'insufficient_points');
    await events(session('intro-1'), session('intro-2')); // 75 points
    const ok = await buy('lilyPads');
    assert.equal(ok.statusCode, 200);
    const after = ok.json<{ points: Points }>().points;
    // 75 - 40 + the first-decoration badge.
    assert.equal(after.balance, 75 - 40 + BADGE_POINTS);
    assert.deepEqual(
      after.owned.map((o) => o.itemId),
      ['lilyPads'],
    );
    const again = await buy('lilyPads');
    assert.equal(again.json<{ points: Points }>().points.balance, after.balance);
    // 50 left: the 120-point mangrove is refused, the balance unchanged.
    assert.equal((await buy('mangrove')).statusCode, 409);
    assert.equal((await points()).balance, after.balance);
    assert.ok((await points()).balance >= 0);
  });

  test('milestone items stay locked until their badge; unknown items are refused', async () => {
    const locked = await buy('glowLotus');
    assert.equal(locked.statusCode, 409);
    assert.equal(locked.json<{ error: { code: string } }>().error.code, 'locked');
    assert.equal((await buy('unicorn')).statusCode, 400);
  });

  test('placement keeps only owned items in slots of their kind (last write wins)', async () => {
    await events(session('intro-1'), session('intro-2'));
    await buy('reeds');
    const put = (updatedAt: number, slots: Record<string, string | null>) =>
      req('PUT', '/me/habitat', { version: 1, updatedAt, slots });
    const res = await put(ctx.clock.now - 100, {
      'bank-left': 'reeds',
      'bank-right': 'reeds',
      'water-left': 'lotus',
      air: 'reeds',
    });
    assert.equal(res.statusCode, 200);
    const slots = res.json<{ habitat: { slots: Record<string, string | null> } }>().habitat.slots;
    assert.equal(slots['bank-left'], 'reeds');
    assert.equal(slots['bank-right'], null);
    assert.equal(slots['water-left'], null);
    assert.equal(slots.air, null);
    // An older write from another device does not win.
    await put(ctx.clock.now - 5000, { 'bank-right': 'reeds' });
    const got = (await req('GET', '/me/habitat')).json<{
      habitat: { slots: Record<string, string | null> };
      owned: { itemId: string }[];
    }>();
    assert.equal(got.habitat.slots['bank-left'], 'reeds');
    assert.deepEqual(
      got.owned.map((o) => o.itemId),
      ['reeds'],
    );
  });
});

describe('dev hooks and limits', () => {
  test('the calm-time hook exists only with DEV_HOOKS', async () => {
    await start();
    assert.equal((await req('POST', '/me/dev/calm', { seconds: 60 })).statusCode, 404);
    await ctx.close();
    await start({ devHooks: true });
    const res = await req('POST', '/me/dev/calm', { seconds: 1800 });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json<{ points: Points }>().points.calmSeconds, 1800);
    assert.equal(res.json<{ points: Points }>().points.balance, 0);
  });

  test('posting events is rate limited', async () => {
    await start({ eventsRateLimit: { max: 2, windowMs: 60_000 } });
    assert.equal((await req('POST', '/me/events', { events: [game('firefly')] })).statusCode, 200);
    assert.equal((await req('POST', '/me/events', { events: [game('firefly')] })).statusCode, 200);
    assert.equal((await req('POST', '/me/events', { events: [game('firefly')] })).statusCode, 429);
  });

  test('deleting the account removes the ledger', async () => {
    await start();
    await events(session('intro-1'));
    await points();
    const userId = (await req('GET', '/me')).json<{ user: { id: string } }>().user.id;
    assert.ok((await ctx.repo.listLedger(userId)).length > 0);
    await ctx.app.inject({
      method: 'DELETE',
      url: '/me',
      headers: auth(),
      payload: { password: PASSWORD },
    });
    assert.equal((await ctx.repo.listLedger(userId)).length, 0);
  });
});
