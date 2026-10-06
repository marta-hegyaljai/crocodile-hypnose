/**
 * Daily reminder (a local notification). This file is the web build: browsers get no scheduled
 * local notifications from a closed tab, so the screen shows an informative fallback instead.
 * The native build is reminders.native.ts.
 */
import type { Reminders } from './types';

export const reminders: Reminders = {
  supported: false,
  async requestPermission() {
    return 'unavailable';
  },
  async schedule() {
    return { status: 'unavailable' };
  },
  async cancel() {
    // Nothing is scheduled on the web.
  },
};

export type { ReminderContent, ReminderResult, Reminders } from './types';
export { parseReminderTime } from './types';
