import { confirmedLog } from '@/services/events/eventLog';
import type { SessionCompletedEvent } from '@/services/events/types';
import { defaultProgress } from '@/services/progress/types';
import { markDone } from '@/services/progress/mergeProgress';

import { daysActiveThisWeek, placeholderPoints, weekStart } from './stats';

describe('home stats (placeholders until step 7)', () => {
  it('points: the onboarding reward', () => {
    expect(placeholderPoints({ rewardGranted: true })).toBe(50);
    expect(placeholderPoints({ rewardGranted: false })).toBe(0);
  });

  it('counts distinct days this week with a finished stop', () => {
    const wed = new Date(2026, 9, 7, 18, 0).getTime(); // Wednesday
    expect(new Date(weekStart(wed)).getDay()).toBe(1);
    const mon = new Date(2026, 9, 5, 9).getTime();
    const lastSun = new Date(2026, 9, 4, 22).getTime();
    let p = defaultProgress();
    p = markDone(p, 'a', mon);
    p = markDone(p, 'b', mon + 3600_000);
    p = markDone(p, 'c', wed - 3600_000);
    p = markDone(p, 'd', lastSun);
    expect(daysActiveThisWeek(p, wed)).toBe(2);
  });
});

describe('placeholderPoints with sessions', () => {
  it('adds the session points to the onboarding reward', () => {
    const log = confirmedLog<SessionCompletedEvent>([
      {
        id: 'evt-00000001',
        type: 'sessionCompleted',
        stopId: 'intro-2',
        stopType: 'audio',
        at: 1,
        firstTime: true,
      },
    ]);
    expect(placeholderPoints({ rewardGranted: true }, log)).toBe(80);
    expect(placeholderPoints({ rewardGranted: false })).toBe(0);
  });
});
