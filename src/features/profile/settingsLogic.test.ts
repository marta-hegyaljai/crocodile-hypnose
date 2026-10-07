import { deriveJourney } from '@/content/journey';
import { localContent } from '@/content/repository';
import { confirmedLog } from '@/services/events/eventLog';
import type { SessionCompletedEvent } from '@/services/events/types';
import { defaultSettings } from '@/services/profile/types';
import { defaultProgress } from '@/services/progress/types';

import {
  isValidTime,
  setReminderEnabled,
  setReminderTime,
  setSafetyAnswers,
  summarize,
  timeOfDayOf,
} from './settingsLogic';

describe('settings logic', () => {
  it('checks 24-hour times', () => {
    expect(['00:00', '08:30', '23:59'].every(isValidTime)).toBe(true);
    expect(['8:30', '24:00', '12:60', '', '08:3'].some(isValidTime)).toBe(false);
    expect(timeOfDayOf('11:59')).toBe('morning');
    expect(timeOfDayOf('12:00')).toBe('evening');
  });

  it('turning the reminder on picks the usual time; off keeps the time', () => {
    const base = defaultSettings(1);
    const on = setReminderEnabled(base, true);
    expect(on.reminder).toEqual({ enabled: true, time: '20:30', timeOfDay: 'evening' });
    expect(setReminderEnabled(on, true)).toBe(on);
    const off = setReminderEnabled(on, false);
    expect(off.reminder).toEqual({ enabled: false, time: '20:30', timeOfDay: 'evening' });
  });

  it('a new time updates the preference; an invalid one changes nothing', () => {
    const on = setReminderEnabled(defaultSettings(1), true);
    const changed = setReminderTime(on, '07:15');
    expect(changed.reminder).toEqual({ enabled: true, time: '07:15', timeOfDay: 'morning' });
    expect(setReminderTime(changed, '7:15')).toBe(changed);
    expect(setReminderTime(changed, '07:15')).toBe(changed);
  });

  it('a re-taken safety check sets the caution mode both ways', () => {
    const base = defaultSettings(1);
    expect(setSafetyAnswers(base, [false, true, false]).safety).toEqual({
      answers: [false, true, false],
      cautionMode: true,
    });
    const cautious = setSafetyAnswers(base, [true, false, false]);
    expect(setSafetyAnswers(cautious, [false, false, false]).safety.cautionMode).toBe(false);
  });

  it('summarises calm minutes, sessions and the current zone', () => {
    const journey = deriveJourney(localContent, defaultProgress(), { cautionMode: false });
    const stop = localContent.stopsOf('intro')[0]!;
    const event = (id: string): SessionCompletedEvent => ({
      id,
      type: 'sessionCompleted',
      stopId: stop.id,
      stopType: stop.type,
      at: 1,
      firstTime: id === 'evt-00000001',
    });
    const log = confirmedLog([event('evt-00000001'), event('evt-00000002')]);
    const summary = summarize(log, journey, localContent);
    expect(summary.sessions).toBe(2);
    expect(summary.calmMinutes).toBe(Math.round((2 * stop.durationSec) / 60));
    expect(summary.stageZone).toBe('intro');
    expect(summarize(confirmedLog([]), journey, localContent)).toMatchObject({
      sessions: 0,
      calmMinutes: 0,
    });
  });
});
