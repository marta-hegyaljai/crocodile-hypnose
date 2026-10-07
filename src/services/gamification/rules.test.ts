import { localContent } from '@/content/repository';

import { appContentMeta, contentMetaFrom, pendingGains } from './derive';
import {
  BADGE_POINTS,
  FIRST_TIME_BONUS,
  GAME_POINTS,
  MAX_COUNTED_PER_DAY,
  SESSION_POINTS,
  WEEKLY_GOAL_POINTS,
  activeDaysThisWeek,
  balanceOf,
  defaultWeeklyTarget,
  deriveNewEntries,
  growthProgress,
  localDay,
  purchaseEntry,
  stageForSeconds,
  summarize,
  weekOfDay,
  type ActivityEvent,
  type LedgerEntry,
  type LedgerInput,
} from './shared/rules';
import { addToLog, confirmedLog } from '@/services/events/eventLog';
import type { ActivityEvent as GameOrSession } from '@/services/events/types';

const DAY = 86_400_000;
// Thursday 2026-10-01, noon UTC.
const T0 = Date.UTC(2026, 9, 1, 12);

const s = (id: string, stopId: string, at = T0): ActivityEvent => ({
  id,
  type: 'sessionCompleted',
  stopId,
  at,
});
const g = (id: string, gameId: string, at = T0): ActivityEvent => ({
  id,
  type: 'gameCompleted',
  gameId,
  at,
});

function run(events: ActivityEvent[], over: Partial<LedgerInput> = {}): LedgerEntry[] {
  const input: LedgerInput = {
    events,
    ledger: [],
    content: appContentMeta,
    weeklyTarget: 4,
    timeZone: 'UTC',
    onboardingRewarded: false,
    accountCreatedAt: T0 - DAY,
    ...over,
  };
  const added = deriveNewEntries(input);
  return [...input.ledger, ...added];
}

describe('points ledger rules', () => {
  it('pays sessions by the content type, the first-time bonus once per stop and a badge', () => {
    const ledger = run([s('a1', 'intro-1'), s('a2', 'intro-1', T0 + 1), s('a3', 'intro-9')]);
    expect(balanceOf(ledger)).toBe(
      2 * SESSION_POINTS.video +
        SESSION_POINTS.longTrance +
        2 * FIRST_TIME_BONUS +
        2 * BADGE_POINTS, // first session, first long trance
    );
    expect(ledger.filter((e) => e.kind === 'firstTime')).toHaveLength(2);
  });

  it('is idempotent: deriving again from its own output adds nothing', () => {
    const events = [s('a1', 'intro-1'), g('b1', 'firefly'), s('a2', 'intro-2', T0 + DAY)];
    const once = run(events);
    expect(run(events, { ledger: once })).toEqual(once);
    // Events arriving in two parts end in the same ledger as all at once.
    const split = run(events.slice(1), { ledger: run(events.slice(0, 1)) });
    expect(balanceOf(split)).toBe(balanceOf(once));
  });

  it('ignores unknown stops and games, and events from before the account', () => {
    const ledger = run([s('a1', 'nowhere-1'), g('b1', 'chess'), s('a2', 'intro-1', T0 - 5 * DAY)]);
    expect(ledger).toEqual([]);
  });

  it('counts at most MAX_COUNTED_PER_DAY activities a day, also across calls', () => {
    const many = Array.from({ length: 20 }, (_, i) => g(`b${i}`, 'breathing', T0 + i));
    const first = run(many.slice(0, 10));
    const all = run(many, { ledger: first });
    expect(all.filter((e) => e.kind === 'game')).toHaveLength(MAX_COUNTED_PER_DAY);
    expect(balanceOf(all)).toBe(MAX_COUNTED_PER_DAY * GAME_POINTS + BADGE_POINTS);
  });

  it('pays the weekly goal once per week and the day badges, in the user’s time zone', () => {
    const days = [0, 1, 2, 3].map((d) => g(`b${d}`, 'stillness', T0 + d * DAY));
    const ledger = run(days, { weeklyTarget: 3 });
    // Thu, Fri, Sat reach 3 days in the first week; Sunday adds nothing more that week.
    const weeks = ledger.filter((e) => e.kind === 'weeklyGoal');
    expect(weeks).toHaveLength(1);
    expect(weeks[0]!.points).toBe(WEEKLY_GOAL_POINTS);
    expect(ledger.some((e) => e.key === 'badge:days3')).toBe(true);
    expect(ledger.some((e) => e.key === 'badge:days7')).toBe(false);
  });

  it('a zone counts as completed once all its stops are done', () => {
    const intro = localContent.stopsOf('intro');
    const events = intro.map((stop, i) => s(`z${i}`, stop.id, T0 + i * 3 * DAY));
    const ledger = run(events);
    expect(ledger.some((e) => e.key === 'badge:zoneCompleted')).toBe(true);
    expect(run(events.slice(1)).some((e) => e.key === 'badge:zoneCompleted')).toBe(false);
  });

  it('buying never goes below zero, is free when owned, and respects milestone locks', () => {
    const ledger = run([s('a1', 'intro-1')]); // 10 + 20 + 15
    expect(purchaseEntry(ledger, 'mangrove', T0)).toEqual({ refused: 'insufficient' });
    expect(purchaseEntry(ledger, 'turtle', T0)).toEqual({ refused: 'locked' });
    expect(purchaseEntry(ledger, 'nothing', T0)).toEqual({ refused: 'unknown' });
    const spend = purchaseEntry(ledger, 'lilyPads', T0);
    expect(spend).toMatchObject({ key: 'item:lilyPads', points: -40 });
    const after = [...ledger, spend as LedgerEntry];
    expect(purchaseEntry(after, 'lilyPads', T0)).toBeNull();
    expect(balanceOf(after)).toBeGreaterThanOrEqual(0);
    // The first decoration earns its badge.
    expect(
      run([s('a1', 'intro-1')], { ledger: after }).some((e) => e.key === 'badge:firstDecoration'),
    ).toBe(true);
    expect(summarize(after).owned.map((o) => o.itemId)).toEqual(['lilyPads']);
  });
});

describe('growth', () => {
  it('stages follow total calm minutes and never go down as minutes grow', () => {
    expect(stageForSeconds(0)).toBe('hatchling');
    expect(stageForSeconds(30 * 60)).toBe('juvenile');
    expect(stageForSeconds(120 * 60)).toBe('adult');
    expect(stageForSeconds(360 * 60)).toBe('grand');
    let last = 0;
    const order = ['hatchling', 'juvenile', 'adult', 'grand'];
    for (let m = 0; m < 500; m += 7) {
      const i = order.indexOf(stageForSeconds(m * 60));
      expect(i).toBeGreaterThanOrEqual(last);
      last = i;
    }
    expect(growthProgress(45 * 60)).toMatchObject({
      stage: 'juvenile',
      next: 'adult',
      nextAt: 120,
    });
    expect(growthProgress(400 * 60)).toMatchObject({ next: null, fraction: 1 });
  });
});

describe('weekly goal', () => {
  it('defaults from the onboarding timing', () => {
    expect(defaultWeeklyTarget('short')).toBe(5);
    expect(defaultWeeklyTarget('medium')).toBe(4);
    expect(defaultWeeklyTarget('long')).toBe(3);
    expect(defaultWeeklyTarget(null)).toBe(4);
  });

  it('weeks start on Monday in the user’s time zone', () => {
    // Sunday 23:30 in Berlin is already Monday in Tokyo.
    const sundayNight = Date.UTC(2026, 9, 4, 21, 30);
    expect(weekOfDay(localDay(sundayNight, 'Europe/Berlin'))).not.toBe(
      weekOfDay(localDay(sundayNight, 'Asia/Tokyo')),
    );
    const monday = Date.UTC(2026, 9, 5, 9);
    expect(new Date(weekOfDay(localDay(monday, 'UTC')) * DAY).getUTCDay()).toBe(1);
    expect(activeDaysThisWeek([monday, monday + 3600_000, sundayNight], monday + DAY, 'UTC')).toBe(
      1,
    );
    expect(localDay(T0, 'Not/AZone')).toBe(Math.floor(T0 / DAY));
  });
});

describe('client view', () => {
  it('the app reads the same content as the pack', () => {
    expect(Object.keys(contentMetaFrom(localContent).stops)).toContain('sleep-10');
  });

  it('pending gains count only unconfirmed events', () => {
    const done = confirmedLog<GameOrSession>([
      { id: 'evt-00000001', type: 'gameCompleted', gameId: 'firefly', at: T0 },
    ]);
    const log = addToLog<GameOrSession>(done, {
      id: 'evt-00000002',
      type: 'sessionCompleted',
      stopId: 'intro-2',
      stopType: 'audio',
      at: T0,
      firstTime: true,
    });
    expect(pendingGains(log)).toEqual({
      points: SESSION_POINTS.audio + FIRST_TIME_BONUS,
      seconds: 180,
      count: 1,
    });
  });
});
