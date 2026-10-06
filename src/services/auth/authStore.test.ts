import { createFakeAuthClient, memoryStorage, sharedStorage } from '@/test/fakeAuth';

import { createAuthStore } from './authStore';
import { createSessionManager } from './sessionManager';
import { createSessionStore, SESSION_KEY, type KeyValueStorage } from './storage';
import { AuthError } from './types';

function setup(
  storage: KeyValueStorage & { data?: Map<string, string> } = memoryStorage(),
  client = createFakeAuthClient(),
) {
  const session = createSessionManager({ client, store: createSessionStore(storage) });
  const store = createAuthStore({ client, session });
  return { client, storage, session, store };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('auth store', () => {
  it('starts signed out without a stored session', async () => {
    const { store } = setup();
    expect(store.getState().status).toBe('restoring');
    await store.getState().bootstrap();
    expect(store.getState().status).toBe('signedOut');
  });

  it('signs up, celebrates once and survives a restart', async () => {
    const { client, storage, store } = setup();
    await store.getState().bootstrap();
    await store
      .getState()
      .signUp({ email: 'ann@example.com', password: 'secret12', displayName: 'Ann' });
    expect(store.getState()).toMatchObject({ status: 'signedIn', justSignedUp: true });
    expect(store.getState().user?.displayName).toBe('Ann');
    store.getState().acknowledgeSignUp();
    expect(store.getState().justSignedUp).toBe(false);

    // Restart: a fresh store on the same storage is signed in straight away, then checks the server.
    const restarted = setup(storage, client);
    await restarted.store.getState().bootstrap();
    expect(restarted.store.getState()).toMatchObject({ status: 'signedIn', justSignedUp: false });
    expect(restarted.store.getState().user?.email).toBe('ann@example.com');
    await flush();
    expect(client.calls.refresh).toBe(1);
    expect(client.calls.getProfile).toBe(1);
  });

  it('starts signed in while offline and keeps the cached profile', async () => {
    const { client, storage, store } = setup();
    await store.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
    client.failAll(new AuthError('offline'));
    const restarted = setup(storage, client);
    await restarted.store.getState().bootstrap();
    await flush();
    expect(restarted.store.getState().status).toBe('signedIn');
    expect(restarted.store.getState().user?.email).toBe('ann@example.com');
  });

  it('a session revoked elsewhere signs out on the next start, with a notice', async () => {
    const { client, storage, store } = setup();
    await store.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
    client.revokeAll();
    const restarted = setup(storage, client);
    await restarted.store.getState().bootstrap();
    await flush();
    expect(restarted.store.getState()).toMatchObject({
      status: 'signedOut',
      user: null,
      notice: 'sessionEnded',
    });
    expect(storage.data?.size).toBe(0);
    restarted.store.getState().dismissNotice();
    expect(restarted.store.getState().notice).toBeNull();
  });

  it('sign-in errors reach the caller and leave the state alone', async () => {
    const { store } = setup();
    await store.getState().bootstrap();
    await expect(
      store.getState().signIn({ email: 'nobody@example.com', password: 'secret12' }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(store.getState().status).toBe('signedOut');
  });

  it('signs in with an account created elsewhere and refreshes the profile', async () => {
    const { client, store } = setup();
    await client.signUp({ email: 'coach@example.com', password: 'secret12', displayName: 'Coach' });
    await store.getState().bootstrap();
    await store.getState().signIn({ email: 'Coach@example.com ', password: 'secret12' });
    expect(store.getState()).toMatchObject({ status: 'signedIn', justSignedUp: false });
    client.accounts.get('coach@example.com')!.user.displayName = 'Renamed';
    await store.getState().refreshProfile();
    expect(store.getState().user?.displayName).toBe('Renamed');
  });

  it('signs out even when the server cannot be reached', async () => {
    const { client, store, storage } = setup();
    await store.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
    client.failAll(new AuthError('unreachable'));
    await store.getState().signOut();
    expect(store.getState()).toMatchObject({ status: 'signedOut', user: null, notice: null });
    expect(storage.data?.size).toBe(0);
  });

  it('deletes the account; signing in afterwards fails normally', async () => {
    const { client, store } = setup();
    await store.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
    await store.getState().deleteAccount();
    expect(store.getState()).toMatchObject({ status: 'signedOut', notice: 'accountDeleted' });
    expect(client.accounts.size).toBe(0);
    await expect(
      store.getState().signIn({ email: 'ann@example.com', password: 'secret12' }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
  });

  it('a failed deletion keeps you signed in', async () => {
    const { client, store } = setup();
    await store.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
    client.failNext(new AuthError('server_error', { status: 500 }));
    await expect(store.getState().deleteAccount()).rejects.toMatchObject({ code: 'server_error' });
    expect(store.getState().status).toBe('signedIn');
    expect(client.accounts.size).toBe(1);
  });

  it('an action cut short by an ended session says so instead of vanishing', async () => {
    const { client, store } = setup();
    await store.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
    client.revokeAll();
    await expect(store.getState().deleteAccount()).rejects.toMatchObject({ code: 'session_ended' });
    expect(store.getState()).toMatchObject({ status: 'signedOut', notice: 'actionInterrupted' });
    expect(client.accounts.size).toBe(1);
  });

  it('follows a sign-in and a sign-out made in another tab', async () => {
    const client = createFakeAuthClient();
    const shared = sharedStorage();
    const a = setup(shared.view(), client);
    const b = setup(shared.view(), client);
    await a.store.getState().bootstrap();
    await b.store.getState().bootstrap();
    await a.store.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
    expect(b.store.getState()).toMatchObject({ status: 'signedIn', justSignedUp: false });
    expect(b.store.getState().user?.email).toBe('ann@example.com');
    await a.store.getState().signOut();
    expect(b.store.getState()).toMatchObject({ status: 'signedOut', notice: 'sessionEnded' });
  });

  it('setting a new password signs out with a notice', async () => {
    const { client, store } = setup();
    await store.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
    const token = client.issueResetToken('ann@example.com');
    await store.getState().confirmPasswordReset(token, 'new secret 1');
    expect(store.getState()).toMatchObject({ status: 'signedOut', notice: 'passwordChanged' });
    await expect(
      store.getState().signIn({ email: 'ann@example.com', password: 'new secret 1' }),
    ).resolves.toBeUndefined();
    await expect(store.getState().confirmPasswordReset(token, 'again 12345')).rejects.toMatchObject(
      {
        code: 'invalid_reset_token',
      },
    );
  });

  it("a late profile for account A never lands on account B's session", async () => {
    const client = createFakeAuthClient();
    await client.signUp({ email: 'b@example.com', password: 'secret12', displayName: 'Bee' });
    const shared = sharedStorage();
    // Tab 1's profile request hangs until we let it through.
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => {
      release = r;
    });
    const slowProfile = {
      ...client,
      getProfile: async (token: string) => {
        const user = await client.getProfile(token);
        await held;
        return user;
      },
    };
    const tab1 = setup(shared.view(), slowProfile as typeof client);
    const tab2 = setup(shared.view(), client);
    await tab1.store.getState().bootstrap();
    await tab2.store.getState().bootstrap();
    await tab1.store
      .getState()
      .signUp({ email: 'a@example.com', password: 'secret12', displayName: 'Ay' });

    const pending = tab1.store.getState().refreshProfile();
    await new Promise((r) => setTimeout(r, 0));
    // Tab 2 signs out and signs in as B while A's profile is on its way.
    await tab2.store.getState().signOut();
    await tab2.store.getState().signIn({ email: 'b@example.com', password: 'secret12' });
    expect(tab1.store.getState().user?.email).toBe('b@example.com');
    release();
    await pending;

    expect(tab1.store.getState().user?.email).toBe('b@example.com');
    const saved = JSON.parse(shared.data.get(SESSION_KEY)!);
    expect(saved.user.email).toBe('b@example.com');
    expect(tab2.store.getState().user?.email).toBe('b@example.com');
  });
});
