import { createFakeAuthClient, memoryStorage, sharedStorage } from '@/test/fakeAuth';

import { createMutex } from './lock';
import { createSessionManager, type SessionEvent } from './sessionManager';
import { createSessionStore, SESSION_KEY, type KeyValueStorage } from './storage';

type Fake = ReturnType<typeof createFakeAuthClient>;

function tab(client: Fake, storage: KeyValueStorage, lock = createMutex()) {
  const session = createSessionManager({
    client,
    store: createSessionStore(storage, { now: () => client.clock.now }),
    now: () => client.clock.now,
    lock,
  });
  const events: SessionEvent['type'][] = [];
  session.subscribe((e) => events.push(e.type));
  return { session, events };
}

const profile = (client: Fake) => (token: string) => client.getProfile(token);

describe('several instances sharing one stored session (tabs, launches)', () => {
  it('a stale tab adopts the token another tab rotated instead of reusing its old one', async () => {
    const client = createFakeAuthClient();
    const storage = memoryStorage();
    const a = tab(client, storage);
    await a.session.begin(await client.signUp({ email: 'a@b.co', password: 'secret12' }));
    const b = tab(client, storage);
    await b.session.restore();
    await b.session.withAccessToken(profile(client)); // B rotates T1 -> T2.

    client.expireAccessTokens();
    // A still holds T1 in memory; it must read T2 from storage and use that.
    await expect(a.session.withAccessToken(profile(client))).resolves.toMatchObject({
      email: 'a@b.co',
    });
    await expect(b.session.withAccessToken(profile(client))).resolves.toBeTruthy();
    expect(a.events).not.toContain('ended');
    expect(b.events).not.toContain('ended');
    expect(storage.data.has(SESSION_KEY)).toBe(true);
  });

  it('with a shared lock, tabs that start together exchange one after the other', async () => {
    const client = createFakeAuthClient({ delayMs: 10 });
    const storage = memoryStorage();
    const lock = createMutex(); // stands in for the Web Locks API shared by tabs
    const first = tab(client, storage, lock);
    await first.session.begin(await client.signUp({ email: 'a@b.co', password: 'secret12' }));
    const tabs = [
      tab(client, storage, lock),
      tab(client, storage, lock),
      tab(client, storage, lock),
    ];
    await Promise.all(tabs.map((t) => t.session.restore()));
    await Promise.all(tabs.map((t) => t.session.withAccessToken(profile(client))));
    for (const t of tabs) expect(t.events).not.toContain('ended');
    expect(client.calls.refresh).toBe(3);
  });

  it('a refused token falls back to a newer stored one before giving up', async () => {
    // A provider that rejects a reused token without revoking the session.
    const client = createFakeAuthClient({ reuseRevokes: false, delayMs: 10 });
    const storage = memoryStorage();
    const a = tab(client, storage);
    await a.session.begin(await client.signUp({ email: 'a@b.co', password: 'secret12' }));
    const b = tab(client, storage); // separate locks: no cross-tab coordination
    await b.session.restore();
    a.session.refresh().catch(() => undefined);
    await b.session.refresh(); // both present T1; B loses, then tries the token A stored
    expect(b.events).toEqual(['user']);
    expect(b.session.hasSession()).toBe(true);
  });

  it('a refusal does not clear a newer session another tab stored meanwhile', async () => {
    const client = createFakeAuthClient({ delayMs: 10 });
    const storage = memoryStorage();
    const a = tab(client, storage);
    await a.session.begin(await client.signUp({ email: 'a@b.co', password: 'secret12' }));
    client.revokeAll();
    // Another tab signs in again before A finds out its session is gone.
    const fresh = await client.signIn({ email: 'a@b.co', password: 'secret12' });
    const pending = a.session.refresh();
    await createSessionStore(storage).save({
      refreshToken: fresh.tokens.refreshToken,
      refreshTokenExpiresAt: fresh.tokens.refreshTokenExpiresAt,
      user: fresh.user,
    });
    // A read the store before the new sign-in landed, was refused, then sees the new token and uses it.
    await expect(pending).resolves.toBeTruthy();
    expect(storage.data.has(SESSION_KEY)).toBe(true);
  });

  it('remembering the profile never writes back a stale token', async () => {
    const client = createFakeAuthClient();
    const storage = memoryStorage();
    const a = tab(client, storage);
    await a.session.begin(await client.signUp({ email: 'a@b.co', password: 'secret12' }));
    const b = tab(client, storage);
    await b.session.restore();
    const rotated = await b.session.refresh();
    await a.session.rememberUser({ ...rotated.user, displayName: 'New' });
    const saved = JSON.parse(storage.data.get(SESSION_KEY)!);
    expect(saved.refreshToken).toBe(rotated.tokens.refreshToken);
    expect(saved.user.displayName).toBe('New');
  });

  it("a refresh never hands another account's tokens to a request made for the first one", async () => {
    const client = createFakeAuthClient();
    await client.signUp({ email: 'b@b.co', password: 'secret12' });
    const storage = memoryStorage(); // no storage events: tab 1 misses the switch
    const one = tab(client, storage);
    const a = await client.signUp({ email: 'a@b.co', password: 'secret12' });
    await one.session.begin(a);
    // Another tab signs in as B; the store now holds B's session.
    const b = await client.signIn({ email: 'b@b.co', password: 'secret12' });
    await createSessionStore(storage).save({
      refreshToken: b.tokens.refreshToken,
      refreshTokenExpiresAt: b.tokens.refreshTokenExpiresAt,
      user: b.user,
    });
    client.expireAccessTokens();
    const action = jest.fn((token: string) => client.getProfile(token));
    await expect(one.session.withAccessToken(action)).rejects.toMatchObject({
      code: 'session_ended',
    });
    // Only A's own (refused) token was ever used for A's request; B's was never handed out.
    expect(action.mock.calls).toEqual([[a.tokens.accessToken]]);
    expect(one.events).toEqual(['signedIn']);
    // From now on tab 1 works as B.
    await expect(one.session.withAccessToken(profile(client))).resolves.toMatchObject({
      email: 'b@b.co',
    });
  });

  it('a late profile for another account is not saved', async () => {
    const client = createFakeAuthClient();
    const storage = memoryStorage();
    const one = tab(client, storage);
    const a = await client.signUp({ email: 'a@b.co', password: 'secret12' });
    await one.session.begin(a);
    await one.session.rememberUser({ ...a.user, id: 'someone-else', email: 'x@b.co' });
    expect(JSON.parse(storage.data.get(SESSION_KEY)!).user.email).toBe('a@b.co');
  });

  describe('storage events', () => {
    it('signing out in one tab ends the session in the others', async () => {
      const client = createFakeAuthClient();
      const shared = sharedStorage();
      const a = tab(client, shared.view());
      const b = tab(client, shared.view());
      await a.session.begin(await client.signUp({ email: 'a@b.co', password: 'secret12' }));
      await b.session.restore();
      b.events.length = 0;
      await a.session.end({ revoke: true });
      expect(b.events).toEqual(['ended']);
      expect(b.session.hasSession()).toBe(false);
    });

    it('signing in in one tab signs in the others', async () => {
      const client = createFakeAuthClient();
      const shared = sharedStorage();
      const a = tab(client, shared.view());
      const b = tab(client, shared.view());
      await b.session.restore();
      await a.session.begin(await client.signUp({ email: 'a@b.co', password: 'secret12' }));
      expect(b.events).toEqual(['signedIn']);
      await expect(b.session.withAccessToken(profile(client))).resolves.toBeTruthy();
    });

    it('a rotation in one tab is picked up by the others without a refresh', async () => {
      const client = createFakeAuthClient();
      const shared = sharedStorage();
      const a = tab(client, shared.view());
      const b = tab(client, shared.view());
      await a.session.begin(await client.signUp({ email: 'a@b.co', password: 'secret12' }));
      await b.session.restore();
      await b.session.refresh();
      expect(a.events).toEqual([]);
      client.expireAccessTokens();
      await expect(a.session.withAccessToken(profile(client))).resolves.toBeTruthy();
      expect(a.events).toEqual(['user']);
    });
  });
});
