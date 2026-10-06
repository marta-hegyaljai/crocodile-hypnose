import { createAuthStore } from '@/services/auth/authStore';
import { createSessionManager } from '@/services/auth/sessionManager';
import { createSessionStore } from '@/services/auth/storage';
import { AuthError } from '@/services/auth/types';
import { createProfileStore } from '@/services/profile/profileStore';
import { createFakeAuthClient, memoryStorage, sharedStorage } from '@/test/fakeAuth';
import { createFakeProfileClient } from '@/test/fakeProfile';

import { markDone, markStarted } from './mergeProgress';
import type { ProgressDoc } from './types';

const flush = async () => {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
};

/** One account on the fake server; each `device()` is a profile store (a device or a tab). */
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
  const device = (storage = memoryStorage() as ReturnType<typeof memoryStorage> | never) =>
    createProfileStore({ client, session, storage, debounceMs: 0, retryMs: { first: 5, max: 20 } });
  const server = () => client.documents.get('user-1:progress') as ProgressDoc | undefined;
  return { client, device, server };
}

describe('progress sync', () => {
  it('a finished stop reaches the server and another device', async () => {
    const { device, server } = await setup();
    const phone = device();
    await phone.getState().load('user-1', { fresh: true });
    await phone.getState().updateProgress((d) => markDone(d, 'intro-1', 100));
    await flush();
    expect(server()?.stops['intro-1']?.status).toBe('done');

    const tablet = device();
    await tablet.getState().load('user-1');
    await flush();
    expect(tablet.getState().progress.stops['intro-1']?.status).toBe('done');
  });

  it('works offline and syncs when back online', async () => {
    const { device, server, client } = await setup();
    const phone = device();
    await phone.getState().load('user-1', { fresh: true });
    client.failAll(new AuthError('offline'));
    await phone.getState().updateProgress((d) => markDone(d, 'intro-1', 100));
    await phone.getState().updateProgress((d) => markStarted(d, 'intro-2', 101));
    await flush();
    expect(phone.getState().progress.stops['intro-1']?.status).toBe('done');
    expect(phone.getState().dirty).toBe(true);
    expect(server()).toBeUndefined();
    client.failAll(null);
    await phone.getState().flush();
    await flush();
    expect(phone.getState().dirty).toBe(false);
    expect(Object.keys(server()!.stops)).toEqual(['intro-1', 'intro-2']);
  });

  it('nothing is pushed before the first read; then both sides merge (no stop lost)', async () => {
    const { device, server, client } = await setup();
    client.seed('user-1', 'progress', {
      version: 1,
      updatedAt: 50,
      stops: { 'intro-1': { status: 'done', updatedAt: 50, completedAt: 50 } },
    });
    client.failAll(new AuthError('unreachable'));
    const phone = device();
    // A new device: the profile waits for the server (the app shows its loading screen).
    const loading = phone.getState().load('user-1');
    await flush();
    // Finishing a stop while the server copy is unknown stays on the device.
    await phone.getState().updateProgress((d) => markDone(d, 'sleep-1', 9_999_999));
    await flush();
    expect(client.calls.put).toBe(0);
    client.failAll(null);
    await phone.getState().flush();
    await flush();
    expect(Object.keys(server()!.stops)).toEqual(['intro-1', 'sleep-1']);
    expect(Object.keys(phone.getState().progress.stops)).toEqual(['intro-1', 'sleep-1']);
    await loading;
  });

  it('a stale tab or device can never undo a finished stop', async () => {
    const { device, server } = await setup();
    const shared = sharedStorage();
    const tabA = device(shared.view() as never);
    const tabB = device(shared.view() as never);
    await tabA.getState().load('user-1', { fresh: true });
    await tabB.getState().load('user-1', { fresh: true });
    await tabA.getState().updateProgress((d) => markStarted(d, 'intro-1', 10));
    await flush();
    await tabB.getState().updateProgress((d) => markDone(d, 'intro-1', 20));
    await flush();
    // Tab A still shows the stop as started; a late "started" write from it changes nothing.
    await tabA.getState().updateProgress((d) => markStarted(d, 'intro-2', 30));
    await tabA.getState().updateProgress((d) => ({
      ...d,
      stops: { ...d.stops, 'intro-1': { status: 'inProgress', updatedAt: 999, completedAt: null } },
    }));
    await tabA.getState().flush();
    await flush();
    expect(server()!.stops['intro-1']).toMatchObject({ status: 'done', completedAt: 20 });
    expect(server()!.stops['intro-2']?.status).toBe('inProgress');
    // The server's answer brings tab A back in line.
    expect(tabA.getState().progress.stops['intro-1']?.status).toBe('done');
  });
});
