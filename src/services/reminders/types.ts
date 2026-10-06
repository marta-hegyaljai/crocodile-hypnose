export type ReminderResult =
  | { status: 'scheduled' }
  /** The user refused the notification permission. */
  | { status: 'denied' }
  /** This platform cannot schedule local notifications (web), or scheduling failed. */
  | { status: 'unavailable' };

export interface ReminderContent {
  title: string;
  body: string;
}

export interface Reminders {
  /** Whether this platform can schedule a daily local notification at all. */
  readonly supported: boolean;
  /** Asks for the notification permission if needed. Never throws. */
  requestPermission(): Promise<'granted' | 'denied' | 'unavailable'>;
  /**
   * Schedules the app's one daily reminder at `time` ("HH:MM"), replacing any earlier one (one
   * identifier). Asks for permission if needed. Never throws.
   */
  schedule(time: string, content: ReminderContent): Promise<ReminderResult>;
  /** Removes the app's daily reminder. Never throws. */
  cancel(): Promise<void>;
}

/** "HH:MM" to hour and minute; null when malformed. */
export function parseReminderTime(time: string): { hour: number; minute: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}
