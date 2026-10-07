import type { Journey } from '@/content/journey';
import type { ContentRepository } from '@/content/repository';
import type { ZoneId } from '@/content/types';
import { cautionMode, REMINDER_TIMES } from '@/features/onboarding/flow';
import { eventsOf } from '@/services/events/eventLog';
import type { ActivityEvent, EventLogDoc, SessionCompletedEvent } from '@/services/events/types';
import type { SafetyAnswers, SettingsDoc, TimeOfDay } from '@/services/profile/types';

/** Pure rules of the settings screens: what each control writes into the settings document. */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "HH:MM" in 24-hour time. */
export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** Morning before noon, evening after: the label that goes with a time. */
export function timeOfDayOf(time: string): TimeOfDay {
  return Number(time.slice(0, 2)) < 12 ? 'morning' : 'evening';
}

/** Turns the daily reminder on or off. Turning it on without a time picks the usual one. */
export function setReminderEnabled(doc: SettingsDoc, enabled: boolean): SettingsDoc {
  if (doc.reminder.enabled === enabled && (!enabled || doc.reminder.time)) return doc;
  const time = doc.reminder.time ?? REMINDER_TIMES[doc.reminder.timeOfDay ?? 'evening'];
  return {
    ...doc,
    reminder: { enabled, time, timeOfDay: doc.reminder.timeOfDay ?? timeOfDayOf(time) },
  };
}

/** Sets the reminder time (the preference follows it). An invalid time changes nothing. */
export function setReminderTime(doc: SettingsDoc, time: string): SettingsDoc {
  if (!isValidTime(time) || doc.reminder.time === time) return doc;
  return { ...doc, reminder: { ...doc.reminder, time, timeOfDay: timeOfDayOf(time) } };
}

/** A re-taken safety check: the answers and the caution mode that follows from them. */
export function setSafetyAnswers(doc: SettingsDoc, answers: SafetyAnswers): SettingsDoc {
  return { ...doc, safety: { answers: [...answers], cautionMode: cautionMode(answers) } };
}

export interface ProfileSummary {
  calmMinutes: number;
  sessions: number;
  /** The zone the user is working through, or null once every open zone is finished. */
  stageZone: ZoneId | null;
}

/** Calm minutes and sessions from the finished-session events; the stage from the journey. */
export function summarize(
  sessions: EventLogDoc<ActivityEvent>,
  journey: Journey,
  content: Pick<ContentRepository, 'stop'>,
): ProfileSummary {
  const events = eventsOf(sessions).filter(
    (e): e is SessionCompletedEvent => e.type === 'sessionCompleted',
  );
  const seconds = events.reduce((sum, e) => sum + (content.stop(e.stopId)?.durationSec ?? 0), 0);
  const current = journey.zones.find((z) => z.state === 'open' && !z.finished);
  return {
    calmMinutes: Math.round(seconds / 60),
    sessions: events.length,
    stageZone: current?.zone.id ?? null,
  };
}
