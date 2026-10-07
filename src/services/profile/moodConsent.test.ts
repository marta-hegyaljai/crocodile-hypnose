import { createAuthStore } from '@/services/auth/authStore';
import { createSessionManager } from '@/services/auth/sessionManager';
import { createSessionStore } from '@/services/auth/storage';
import { AuthError } from '@/services/auth/types';
import { createFakeAuthClient, memoryStorage } from '@/test/fakeAuth';
import { createFakeProfileClient } from '@/test/fakeProfile';

import { pendingOf } from '@/services/events/eventLog';
import type { MoodEntry } from '@/services/events/types';

import { createProfileStore } from './profileStore';

const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
};

const mood = (id: string, over: Partial<MoodEntry> = {}): MoodEntry => ({
  id,
  at: 100,
  phase: 'before',
  value: 3,
  stopId: 'intro-2',
  ...over,
});

async function setup() {
  const authClient = createFakeAuthClient();
  const session = createSessionManager({
    client: authClient,
    store: createSessionStore(memoryStorage()),
  });
  const auth = createAuthStore({ client: authClient, session });
  await auth.getState().bootstrap();
  await auth.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
  const client = createFakeProfileClient({ userOf: () => 'user-1' });
  const device = (storage = memoryStorage()) =>
    createProfileStore({
      client,
      session,
      storage,
      debounceMs: 0,
      retryMs: { first: 5, max: 20 },
    });
  return { client, device };
}

async function withConsent(profile: ReturnType<Awaited<ReturnType<typeof setup>>['device']>) {
  await profile.getState().load('user-1', { fresh: true });
  await profile.getState().updateSettings((d) => ({ ...d, moodConsent: true }));
  await profile.getState().updateOnboarding((d) => ({
    ...d,
    moodConsent: true,
    firstSession: { completed: true, moodBefore: 2, moodAfter: 4 },
  }));
  await profile.getState().recordMood(mood('mood-0000001'));
  await settle();
}

describe('mood consent', () => {
  it('turning it off deletes the moods: device (pending included), onboarding answers, server', async () => {
    const { client, device } = await setup();
    const phone = device();
    await withConsent(phone);
    expect(client.streams.get('user-1:mood')).toHaveLength(1);

    // A pending entry that never reached the server.
    client.failAll(new AuthError('offline'));
    await phone.getState().recordMood(mood('mood-0000002', { phase: 'after' }));
    expect(pendingOf(phone.getState().moods)).toHaveLength(1);
    client.failAll(null);

    await phone.getState().setMoodConsent(false);
    await settle();

    expect(phone.getState().settings.moodConsent).toBe(false);
    expect(Object.keys(phone.getState().moods.items)).toEqual([]);
    expect(phone.getState().onboarding.firstSession).toMatchObject({
      moodBefore: null,
      moodAfter: null,
    });
    expect(client.streams.get('user-1:mood') ?? []).toHaveLength(0);
    expect(client.calls.deleteMood).toBe(1);
    expect(client.documents.get('user-1:settings')).toMatchObject({ moodConsent: false });
    // The rest of the onboarding is untouched.
    expect(phone.getState().onboarding.firstSession.completed).toBe(true);
  });

  it('offline: the local data goes at once and the server delete follows with the settings', async () => {
    const { client, device } = await setup();
    const phone = device();
    await withConsent(phone);
    client.failAll(new AuthError('offline'));
    await phone.getState().setMoodConsent(false);
    expect(Object.keys(phone.getState().moods.items)).toEqual([]);
    expect(phone.getState().dirty).toBe(true);
    client.failAll(null);
    await phone.getState().flush();
    expect(client.documents.get('user-1:settings')).toMatchObject({ moodConsent: false });
  });

  it('another device that learns of the withdrawal drops its moods too', async () => {
    const { client, device } = await setup();
    const phone = device();
    const tablet = device();
    await withConsent(phone);
    await tablet.getState().load('user-1');
    await settle();
    expect(Object.keys(tablet.getState().moods.items)).toHaveLength(1);

    await phone.getState().setMoodConsent(false);
    await settle();
    // The tablet reads the newer settings and enforces the withdrawal on its own copy.
    await tablet.getState().load('user-1');
    await settle();
    expect(tablet.getState().settings.moodConsent).toBe(false);
    expect(Object.keys(tablet.getState().moods.items)).toEqual([]);
    expect(client.streams.get('user-1:mood') ?? []).toHaveLength(0);
  });

  it('turning it back on keeps nothing from before and records again', async () => {
    const { device } = await setup();
    const phone = device();
    await withConsent(phone);
    await phone.getState().setMoodConsent(false);
    await phone.getState().setMoodConsent(true);
    await settle();
    expect(phone.getState().settings.moodConsent).toBe(true);
    expect(Object.keys(phone.getState().moods.items)).toEqual([]);
    await phone.getState().recordMood(mood('mood-0000003'));
    expect(Object.keys(phone.getState().moods.items)).toEqual(['mood-0000003']);
  });

  it('a withdrawal that was written but not yet scrubbed when the app closed is scrubbed on load', async () => {
    const { client, device } = await setup();
    const storage = memoryStorage();
    const before = device(storage);
    await withConsent(before);
    expect(Object.keys(before.getState().moods.items)).toHaveLength(1);
    // The consent-off write reached the device, then the app was killed before the scrub.
    const key = 'mhp.hypnose.settings.v1.user-1';
    const stored = JSON.parse(storage.data.get(key)!) as {
      updatedAt: number;
      fieldsAt: Record<string, number>;
    } & Record<string, unknown>;
    const at = stored.updatedAt + 10;
    storage.data.set(
      key,
      JSON.stringify({
        ...stored,
        moodConsent: false,
        updatedAt: at,
        fieldsAt: { ...stored.fieldsAt, doc: at, moodConsent: at },
      }),
    );
    // Restart, offline: nothing may depend on the server.
    client.failAll(new AuthError('offline'));
    const after = device(storage);
    await after.getState().load('user-1');
    await settle();
    expect(after.getState().settings.moodConsent).toBe(false);
    expect(Object.keys(after.getState().moods.items)).toEqual([]);
    expect(after.getState().onboarding.firstSession).toMatchObject({
      moodBefore: null,
      moodAfter: null,
    });
    expect(JSON.parse(storage.data.get('mhp.hypnose.moods.v1.user-1')!).items).toEqual({});
  });

  it('settings still at the defaults (not yet known) never delete anything', async () => {
    const { client, device } = await setup();
    const phone = device();
    await phone.getState().load('user-1', { fresh: true });
    await phone.getState().updateOnboarding((d) => ({
      ...d,
      moodConsent: true,
      firstSession: { completed: true, moodBefore: 3, moodAfter: null },
    }));
    expect(phone.getState().onboarding.firstSession.moodBefore).toBe(3);
    expect(client.calls.deleteMood).toBe(0);
  });

  it('a stale copy that says off and changes another field neither withdraws nor deletes', async () => {
    const { client, device } = await setup();
    const phone = device();
    const tablet = device();
    await tablet.getState().load('user-1', { fresh: true });
    await tablet.getState().updateSettings((d) => ({ ...d, sound: true, crocName: 'Snap' }));
    await settle();
    // The phone turns consent on and records a mood; the tablet never hears of it.
    await phone.getState().load('user-1');
    await settle();
    await phone.getState().setMoodConsent(true);
    await phone.getState().recordMood(mood('mood-0000001'));
    await settle();
    // The tablet, still holding consent off, turns the sound off.
    await tablet.getState().updateSettings((d) => ({ ...d, sound: false }));
    await settle();
    expect(client.documents.get('user-1:settings')).toMatchObject({
      moodConsent: true,
      sound: false,
    });
    expect(client.calls.deleteMood).toBe(0);
    expect(client.streams.get('user-1:mood')).toHaveLength(1);
    // Both copies end up agreeing, and the tablet keeps the phone's consent.
    expect(tablet.getState().settings.moodConsent).toBe(true);
    await phone.getState().load('user-1');
    await settle();
    expect(phone.getState().settings).toMatchObject({ moodConsent: true, sound: false });
    expect(Object.keys(phone.getState().moods.items)).toEqual(['mood-0000001']);
  });

  it('a stale copy that says on never grants consent again', async () => {
    const { client, device } = await setup();
    const phone = device();
    const tablet = device();
    await withConsent(phone);
    await tablet.getState().load('user-1');
    await settle();
    await phone.getState().setMoodConsent(false);
    await settle();
    // The tablet still holds consent on and changes the haptics.
    await tablet.getState().updateSettings((d) => ({ ...d, haptics: false }));
    await settle();
    expect(client.documents.get('user-1:settings')).toMatchObject({
      moodConsent: false,
      haptics: false,
    });
    // The tablet learns of the withdrawal from the server's answer and drops its moods.
    expect(tablet.getState().settings.moodConsent).toBe(false);
    expect(Object.keys(tablet.getState().moods.items)).toEqual([]);
  });

  it('a moods refetch that started before the withdrawal does not bring the moods back', async () => {
    const { client, device } = await setup();
    const phone = device();
    await withConsent(phone);
    const gate = client.hold();
    const refetching = phone.getState().refetch();
    await settle();
    // The user withdraws while the read is out; it answers with the server's moods from before.
    const withdrawing = phone.getState().setMoodConsent(false);
    gate.release();
    await Promise.all([refetching, withdrawing]);
    await settle();
    expect(phone.getState().settings.moodConsent).toBe(false);
    expect(Object.keys(phone.getState().moods.items)).toEqual([]);
    expect(phone.getState().onboarding.firstSession).toMatchObject({
      moodBefore: null,
      moodAfter: null,
    });
  });

  it('a partial push that ends after the withdrawal does not bring the moods back', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { client, device } = await setup();
    const phone = device();
    await phone.getState().load('user-1', { fresh: true });
    await phone.getState().setMoodConsent(true);
    await settle();
    // More than one request's worth of entries, written while the server is out of reach.
    client.failAll(new AuthError('offline'));
    for (let i = 1; i <= 51; i++) {
      await phone.getState().recordMood(mood(`mood-${String(i).padStart(7, '0')}`));
    }
    client.failAll(null);
    // The first request goes through; the second waits, then hits the rate limit.
    const append = client.appendEvents.bind(client);
    let calls = 0;
    let fail: () => void = () => undefined;
    client.appendEvents = (async (...args: Parameters<typeof append>) => {
      calls += 1;
      if (calls === 1) return append(...args);
      await new Promise<void>((r) => {
        fail = r;
      });
      throw new AuthError('rate_limited', { status: 429, retryAfterSeconds: 1 });
    }) as typeof client.appendEvents;
    const pushing = phone.getState().flush();
    await settle();
    expect(calls).toBe(2);
    const withdrawing = phone.getState().setMoodConsent(false);
    await settle();
    expect(Object.keys(phone.getState().moods.items)).toEqual([]);
    fail();
    await Promise.all([pushing, withdrawing]);
    await settle();
    expect(phone.getState().settings.moodConsent).toBe(false);
    expect(Object.keys(phone.getState().moods.items)).toEqual([]);
    warn.mockRestore();
  });

  it('exports the stored data as JSON after sending pending changes', async () => {
    const { device } = await setup();
    const phone = device();
    await withConsent(phone);
    await phone.getState().updateSettings((d) => ({ ...d, crocName: 'Snap' }));
    const json = JSON.parse(await phone.getState().exportData()) as {
      documents: { settings: { crocName: string } };
      moodEntries: unknown[];
    };
    expect(json.documents.settings.crocName).toBe('Snap');
    expect(json.moodEntries).toHaveLength(1);
  });
});
