import { localContent } from '@/content/repository';
import { FIRST_TIME_BONUS, SESSION_POINTS } from '@/services/points/points';
import { markDone } from '@/services/progress/mergeProgress';
import { defaultProgress } from '@/services/progress/types';

import { completeSession } from './completion';

const stop = localContent.stop('intro-2')!;

describe('completeSession', () => {
  it('a first completion earns the bonus and unlocks the next stop', () => {
    const progress = markDone(defaultProgress(), 'intro-1', 1);
    const c = completeSession(localContent, progress, stop, 'run-00000001', 50, false);
    expect(c.event).toEqual({
      id: 'run-00000001',
      type: 'sessionCompleted',
      stopId: 'intro-2',
      stopType: 'audio',
      at: 50,
      firstTime: true,
    });
    expect(c.points.total).toBe(SESSION_POINTS.audio + FIRST_TIME_BONUS);
    expect(c.unlocked).toEqual(['intro-3']);
  });

  it('a replay of a finished stop earns no first-time bonus and unlocks nothing', () => {
    const progress = markDone(markDone(defaultProgress(), 'intro-1', 1), 'intro-2', 2);
    const c = completeSession(localContent, progress, stop, 'run-00000002', 60, false);
    expect(c.event.firstTime).toBe(false);
    expect(c.points).toEqual({ base: SESSION_POINTS.audio, bonus: 0, total: SESSION_POINTS.audio });
    expect(c.unlocked).toEqual([]);
  });
});
