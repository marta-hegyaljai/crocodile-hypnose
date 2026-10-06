import { createFakeAuthClient, memoryStorage } from '@/test/fakeAuth';

import { createSessionManager } from './sessionManager';
import { createSessionStore, SESSION_KEY } from './storage';
import { AuthError } from './types';

async function setup() {
  const client = createFakeAuthClient();
  const storage = memoryStorage();
  const store = createSessionStore(storage, { now: () => client.clock.now });
  const session = createSessionManager({ client, store, now: () => client.clock.now });
  const events: string[] = [];
  session.subscribe((e) => events.push(e.type));
  const result = await client.signUp({ email: 'ann@example.com', password: 'secret12' });
  await session.begin(result);
  return { client, storage, store, session, events, result };
}

describe('session manager', () => {
  it('persists only the refresh token and profile, never the access token', async () => {
    const { storage, result } = await setup();
    const raw = storage.data.get(SESSION_KEY)!;
    expect(JSON.parse(raw)).toEqual({
      refreshToken: result.tokens.refreshToken,
      refreshTokenExpiresAt: result.tokens.refreshTokenExpiresAt,
      user: result.user,
    });
    expect(raw).not.toContain(result.tokens.accessToken);
  });

  it('uses the current access token without refreshing', async () => {
    const { client, session } = await setup();
    await session.withAccessToken((t) => client.getProfile(t));
    expect(client.calls.refresh).toBe(0);
  });

  it('after a restart, concurrent calls share a single refresh', async () => {
    const { client, store } = await setup();
    const restarted = createSessionManager({ client, store, now: () => client.clock.now });
    await restarted.restore();
    const users = await Promise.all([
      restarted.withAccessToken((t) => client.getProfile(t)),
      restarted.withAccessToken((t) => client.getProfile(t)),
      restarted.withAccessToken((t) => client.getProfile(t)),
    ]);
    expect(users.map((u) => u.email)).toEqual(Array(3).fill('ann@example.com'));
    expect(client.calls.refresh).toBe(1);
  });

  it('refreshes ahead of expiry', async () => {
    const { client, session } = await setup();
    client.clock.now += 15 * 60_000 - 10_000; // 10 s left, under the 30 s skew
    await session.withAccessToken((t) => client.getProfile(t));
    expect(client.calls.refresh).toBe(1);
  });

  it('refreshes silently on a 401 and retries once', async () => {
    const { client, session, events } = await setup();
    client.expireAccessTokens();
    const user = await session.withAccessToken((t) => client.getProfile(t));
    expect(user.email).toBe('ann@example.com');
    expect(client.calls.refresh).toBe(1);
    expect(client.calls.getProfile).toBe(2);
    expect(events).toEqual(['user']);
  });

  it('a refused refresh token ends the session cleanly', async () => {
    const { client, session, storage, events } = await setup();
    client.revokeAll();
    await expect(session.withAccessToken((t) => client.getProfile(t))).rejects.toMatchObject({
      code: 'session_ended',
    });
    expect(events).toEqual(['ended']);
    expect(session.hasSession()).toBe(false);
    expect(storage.data.has(SESSION_KEY)).toBe(false);
  });

  it('a 401 for a brand-new token ends the session', async () => {
    const { client, session, events } = await setup();
    const alwaysRefused = async () => {
      throw new AuthError('unauthorized', { status: 401 });
    };
    await expect(session.withAccessToken(alwaysRefused)).rejects.toMatchObject({
      code: 'session_ended',
    });
    expect(events).toEqual(['user', 'ended']);
    expect(client.calls.refresh).toBe(1);
  });

  it('keeps the session when the refresh fails for connectivity', async () => {
    const { client, session, storage, events } = await setup();
    client.expireAccessTokens();
    client.failAll(new AuthError('offline'));
    await expect(session.withAccessToken((t) => client.getProfile(t))).rejects.toMatchObject({
      code: 'offline',
    });
    expect(session.hasSession()).toBe(true);
    expect(storage.data.has(SESSION_KEY)).toBe(true);
    expect(events).toEqual([]);
    client.failAll(null);
    await expect(session.withAccessToken((t) => client.getProfile(t))).resolves.toBeTruthy();
  });

  it('signing out clears locally even when the server is unreachable', async () => {
    const { client, session, storage, result } = await setup();
    client.failAll(new AuthError('unreachable'));
    await session.end({ revoke: true });
    expect(session.hasSession()).toBe(false);
    expect(storage.data.has(SESSION_KEY)).toBe(false);
    expect(client.calls.signOut).toBe(1);
    client.failAll(null);
    // The refresh token still exists server-side (it could not be told), but the app forgot it.
    await expect(client.refresh(result.tokens.refreshToken)).resolves.toBeTruthy();
  });

  it('a refresh that finishes after sign-out does not bring the session back', async () => {
    const client = createFakeAuthClient({ delayMs: 20 });
    const storage = memoryStorage();
    const session = createSessionManager({ client, store: createSessionStore(storage) });
    await session.begin(await client.signUp({ email: 'a@b.co', password: 'secret12' }));
    const pending = session.refresh();
    await session.end();
    await expect(pending).rejects.toMatchObject({ code: 'session_ended' });
    expect(session.hasSession()).toBe(false);
    expect(storage.data.size).toBe(0);
  });

  it('refresh without a session is session_ended', async () => {
    const client = createFakeAuthClient();
    const session = createSessionManager({ client, store: createSessionStore(memoryStorage()) });
    await expect(session.refresh()).rejects.toMatchObject({ code: 'session_ended' });
    expect(client.calls.refresh).toBe(0);
  });
});

describe('session store', () => {
  const user = { id: 'u', email: 'a@b.co', displayName: null, signupClient: 'mhp-hypnose' };

  it('round-trips and clears', async () => {
    const store = createSessionStore(memoryStorage());
    const session = { refreshToken: 'r', refreshTokenExpiresAt: Date.now() + 1000, user };
    await store.save(session);
    expect(await store.load()).toEqual(session);
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it('drops corrupt, malformed and expired records', async () => {
    for (const raw of [
      '{nope',
      JSON.stringify({ refreshToken: '', refreshTokenExpiresAt: Date.now() + 1000, user }),
      JSON.stringify({ refreshToken: 'r', refreshTokenExpiresAt: Date.now() + 1000 }),
      JSON.stringify({ refreshToken: 'r', refreshTokenExpiresAt: Date.now() - 1, user }),
    ]) {
      const storage = memoryStorage({ [SESSION_KEY]: raw });
      expect(await createSessionStore(storage).load()).toBeNull();
      expect(storage.data.size).toBe(0);
    }
  });

  it('treats unreadable storage as no session', async () => {
    const storage = memoryStorage();
    storage.getItem = async () => {
      throw new Error('keychain locked');
    };
    expect(await createSessionStore(storage).load()).toBeNull();
  });
});
