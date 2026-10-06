import { createAuthStore } from '@/services/auth/authStore';
import { createSessionManager } from '@/services/auth/sessionManager';
import { createSessionStore } from '@/services/auth/storage';
import { createProfileStore, followAuth } from '@/services/profile/profileStore';
import { createFakeAuthClient, memoryStorage } from '@/test/fakeAuth';
import { createFakeProfileClient } from '@/test/fakeProfile';

import { createReminderSync } from './reminderSync';
import type { Reminders } from './types';

const flush = () => new Promise((r) => setTimeout(r, 0));

function fakeReminders(): Reminders & { log: string[] } {
  const log: string[] = [];
  return {
    log,
    supported: true,
    async requestPermission() {
      return 'granted';
    },
    async schedule(time) {
      log.push(`schedule ${time}`);
      return { status: 'scheduled' };
    },
    async cancel() {
      log.push('cancel');
    },
  };
}

async function setup() {
  const client = createFakeAuthClient();
  const session = createSessionManager({ client, store: createSessionStore(memoryStorage()) });
  const auth = createAuthStore({ client, session });
  const profile = createProfileStore({
    client: createFakeProfileClient(),
    session,
    storage: memoryStorage(),
    debounceMs: 0,
  });
  const reminders = fakeReminders();
  const content = () => ({ title: 't', body: 'b' });
  await auth.getState().bootstrap();
  followAuth(profile, auth);
  createReminderSync({ profile, reminders, content });
  // A cold start with nobody signed in clears whatever a previous user left scheduled.
  expect(reminders.log).toEqual(['cancel']);
  reminders.log.length = 0;
  return { auth, profile, reminders };
}

describe('reminder sync', () => {
  it('schedules when turned on, reschedules when the time changes, cancels when turned off', async () => {
    const { auth, profile, reminders } = await setup();
    await auth.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
    await flush();
    expect(reminders.log).toEqual([]);
    await profile.getState().updateSettings((s) => ({
      ...s,
      reminder: { enabled: true, time: '08:00', timeOfDay: 'morning' },
    }));
    expect(reminders.log).toEqual(['schedule 08:00']);
    // The same settings again: nothing happens (idempotent).
    await profile.getState().updateSettings((s) => ({ ...s, sound: false }));
    expect(reminders.log).toEqual(['schedule 08:00']);
    // Evening person now: rescheduled.
    await profile.getState().updateSettings((s) => ({
      ...s,
      reminder: { enabled: true, time: '20:30', timeOfDay: 'evening' },
    }));
    expect(reminders.log).toEqual(['schedule 08:00', 'schedule 20:30']);
    // "Not now" after all: cancelled.
    await profile.getState().updateSettings((s) => ({
      ...s,
      reminder: { enabled: false, time: '20:30', timeOfDay: 'evening' },
    }));
    expect(reminders.log).toEqual(['schedule 08:00', 'schedule 20:30', 'cancel']);
  });

  it('cancels on sign-out', async () => {
    const { auth, profile, reminders } = await setup();
    await auth.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
    await flush();
    await profile.getState().updateSettings((s) => ({
      ...s,
      reminder: { enabled: true, time: '08:00', timeOfDay: 'morning' },
    }));
    await auth.getState().signOut();
    await flush();
    expect(reminders.log).toEqual(['schedule 08:00', 'cancel']);
  });

  it('does nothing on a platform without reminders', async () => {
    const { profile } = await setup();
    const reminders = { ...fakeReminders(), supported: false };
    const stop = createReminderSync({
      profile,
      reminders,
      content: () => ({ title: '', body: '' }),
    });
    stop();
    expect(reminders.log).toEqual([]);
  });
});
