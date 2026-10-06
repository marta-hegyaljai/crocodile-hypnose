import type { SessionCompletedEvent } from '@/services/events/types';

import { FIRST_TIME_BONUS, SESSION_POINTS, sessionPoints, totalSessionPoints } from './points';

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

  it('the total never grants the first-time bonus twice for a stop or counts an event twice', () => {
    const a = event();
    const b = event({ id: 'evt-00000002', at: 200 }); // a second device also claimed "first"
    const c = event({ id: 'evt-00000003', at: 300, stopId: 'intro-4' });
    const once = SESSION_POINTS.audio + FIRST_TIME_BONUS;
    expect(totalSessionPoints([a])).toBe(once);
    expect(totalSessionPoints([a, a])).toBe(once);
    expect(totalSessionPoints([b, a])).toBe(once + SESSION_POINTS.audio);
    expect(totalSessionPoints([a, b, c])).toBe(once + SESSION_POINTS.audio + once);
    expect(totalSessionPoints([])).toBe(0);
  });
});
