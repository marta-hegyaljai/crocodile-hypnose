import { createAuthStore } from '@/services/auth/authStore';
import { createSessionManager } from '@/services/auth/sessionManager';
import { createSessionStore } from '@/services/auth/storage';
import { AuthError } from '@/services/auth/types';
import { createFakeAuthClient, memoryStorage } from '@/test/fakeAuth';
import { createFakeProfileClient } from '@/test/fakeProfile';

import { createProfileStore, followAuth, isSyncProblem } from './profileStore';
import { defaultOnboarding, defaultSettings } from './types';

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  const authClient = createFakeAuthClient();
  const session = createSessionManager({
    client: authClient,
    store: createSessionStore(memoryStorage()),
  });
  const auth = createAuthStore({ client: authClient, session });
  // The fake auth client numbers users `user-N`; map every token of a user to that id.
  const owners = new Map<string, string>();
  const client = createFakeProfileClient({
    userOf: (token) => owners.get(token) ?? auth.getState().user?.id ?? 'user-?',
  });
  const storage = memoryStorage();
  const profile = createProfileStore({
    client,
    session,
    storage,
    debounceMs: 0,
    retryMs: { first: 5, max: 20 },
  });
  return { authClient, session, auth, client, storage, profile, owners };
}

describe('profile store', () => {
  it('follows the account: loads fresh after a sign-up, forgets on sign-out', async () => {
    const { auth, profile, client, storage } = setup();
    await auth.getState().bootstrap();
    const stop = followAuth(profile, auth);
    expect(profile.getState().status).toBe('idle');

    await auth.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
    await flush();
    expect(profile.getState()).toMatchObject({ status: 'ready', userId: 'user-1' });
    expect(client.calls.get).toBe(0); // fresh account: no server read
    await profile.getState().updateOnboarding((d) => ({ ...d, goals: ['focus'] }));
    await flush();
    await flush();
    expect(client.documents.get('user-1:onboarding')).toMatchObject({ goals: ['focus'] });
    expect(storage.data.size).toBeGreaterThan(0);

    await auth.getState().signOut();
    await flush();
    expect(profile.getState()).toMatchObject({ status: 'idle', userId: null });
    expect(profile.getState().onboarding.goals).toEqual([]);
    // Health data never lingers on a signed-out device.
    expect([...storage.data.keys()].filter((k) => k.startsWith('mhp.hypnose.'))).toEqual([]);
    stop();
  });

  it('waits for the server on a new device, so a finished onboarding is skipped', async () => {
    const { auth, profile, client } = setup();
    await auth.getState().bootstrap();
    client.seed('user-1', 'onboarding', {
      ...defaultOnboarding(500),
      step: 'done',
      completed: true,
    });
    client.seed('user-1', 'settings', { ...defaultSettings(500), crocName: 'Zed' });
    const hold = client.hold();
    await auth.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
    // The "sign-in" case: the account exists, so nothing is fresh.
    const loading = profile.getState().load('user-1');
    await flush();
    expect(profile.getState().status).toBe('loading');
    hold.release();
    await loading;
    expect(profile.getState().status).toBe('ready');
    expect(profile.getState().onboarding.completed).toBe(true);
    expect(profile.getState().settings.crocName).toBe('Zed');
  });

  it('stays loading, with the error, while the server is unreachable on a new device', async () => {
    const { auth, profile, client } = setup();
    await auth.getState().bootstrap();
    await auth.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
    client.seed('user-1', 'onboarding', {
      ...defaultOnboarding(500),
      step: 'done',
      completed: true,
    });
    client.failAll(new AuthError('unreachable'));
    const loading = profile.getState().load('user-1');
    await flush();
    await flush();
    expect(profile.getState().status).toBe('loading');
    expect(profile.getState().loadError).toBeInstanceOf(AuthError);
    // Nothing is written meanwhile, and the server is asked again until it answers.
    client.failAll(null);
    await loading;
    expect(profile.getState().status).toBe('ready');
    expect(profile.getState().loadError).toBeNull();
    expect(profile.getState().onboarding.completed).toBe(true);
    expect(client.calls.put).toBe(0);
  });

  it('mirrors dirty and sync errors from the documents', async () => {
    const { auth, profile, client } = setup();
    await auth.getState().bootstrap();
    await auth.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
    await profile.getState().load('user-1', { fresh: true });
    client.failAll(new AuthError('offline'));
    await profile.getState().updateSettings((d) => ({ ...d, sound: false }));
    await flush();
    await flush();
    expect(profile.getState().dirty).toBe(true);
    expect(isSyncProblem(profile.getState().syncError)).toBe(false);
    client.failAll(null);
    await profile.getState().flush();
    expect(profile.getState().dirty).toBe(false);
    expect(profile.getState().syncError).toBeNull();
  });

  it('isSyncProblem ignores connectivity and ended sessions', () => {
    expect(isSyncProblem(null)).toBe(false);
    expect(isSyncProblem(new AuthError('unreachable'))).toBe(false);
    expect(isSyncProblem(new AuthError('session_ended'))).toBe(false);
    expect(isSyncProblem(new AuthError('invalid_request'))).toBe(true);
    expect(isSyncProblem(new Error('boom'))).toBe(true);
  });
});
