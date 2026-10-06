import type { ProfileStore } from '@/services/profile/profileStore';
import type { SettingsDoc } from '@/services/profile/types';

import type { ReminderContent, Reminders } from './types';

type ReminderSettings = SettingsDoc['reminder'];

/** What the OS should hold for these settings: a time, or nothing. */
function wanted(settings: ReminderSettings): string | null {
  return settings.enabled && settings.time ? settings.time : null;
}

/**
 * Keeps the OS's daily reminder in step with the settings document, so it is scheduled when the
 * user turns it on, rescheduled when the time changes (another device, or a changed morning /
 * evening preference), cancelled when it is turned off, and cancelled when nobody is signed in
 * (sign-out, deletion, an ended session). Scheduling is idempotent (one identifier).
 */
export function createReminderSync({
  profile,
  reminders,
  content,
}: {
  profile: ProfileStore;
  reminders: Reminders;
  content: () => ReminderContent;
}): () => void {
  if (!reminders.supported) return () => undefined;
  // What the OS holds as far as we know: a time, nothing, or unknown (a cold start).
  let held: string | null | undefined;

  const apply = () => {
    const state = profile.getState();
    if (state.status === 'idle') {
      if (held !== null) {
        held = null;
        void reminders.cancel();
      }
      return;
    }
    if (state.status !== 'ready') return;
    const next = wanted(state.settings.reminder);
    if (next === held) return;
    held = next;
    if (next) void reminders.schedule(next, content());
    else void reminders.cancel();
  };

  apply();
  return profile.subscribe(apply);
}
