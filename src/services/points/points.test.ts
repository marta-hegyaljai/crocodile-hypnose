import type { SessionCompletedEvent } from '@/services/events/types';

import { FIRST_TIME_BONUS, SESSION_POINTS, sessionPoints } from './points';

const event = (over: Partial<SessionCompletedEvent> = {}): SessionCompletedEvent => ({
  id: 'evt-00000001',
  type: 'sessionCompleted',
  stopId: 'intro-2',
  stopType: 'audio',
  at: 100,
  firstTime: true,
  ...over,
});

describe('session points', () => {
  it('a first completion earns the bonus, a replay only the base', () => {
    expect(sessionPoints(event())).toEqual({
      base: SESSION_POINTS.audio,
      bonus: FIRST_TIME_BONUS,
      total: SESSION_POINTS.audio + FIRST_TIME_BONUS,
    });
    expect(sessionPoints(event({ firstTime: false })).bonus).toBe(0);
    expect(sessionPoints(event({ stopType: 'longTrance', firstTime: false })).total).toBe(
      SESSION_POINTS.longTrance,
    );
  });
});
