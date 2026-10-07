import { createAuthStore } from '@/services/auth/authStore';
import { createSessionManager } from '@/services/auth/sessionManager';
import { createSessionStore } from '@/services/auth/storage';
import { AuthError } from '@/services/auth/types';
import { createProfileStore } from '@/services/profile/profileStore';
import { createFakeAuthClient, memoryStorage, sharedStorage } from '@/test/fakeAuth';
import { createFakeProfileClient } from '@/test/fakeProfile';

import { eventsOf, pendingOf } from './eventLog';
import type { SessionCompletedEvent } from './types';

const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
};

const event = (id: string, over: Partial<SessionCompletedEvent> = {}): SessionCompletedEvent => ({
  id,
  type: 'sessionCompleted',
  stopId: 'intro-2',
  stopType: 'audio',
  at: 100,
  firstTime: true,
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
  const device = (storage = memoryStorage() as ReturnType<typeof memoryStorage> | never) =>
    createProfileStore({ client, session, storage, debounceMs: 0, retryMs: { first: 5, max: 20 } });
  const server = () => client.streams.get('user-1:events') ?? [];
  return { client, device, server };
}

describe('session events sync', () => {
  it('an event recorded offline (and again) reaches the server once', async () => {
    const { device, server, client } = await setup();
    const phone = device();
    await phone.getState().load('user-1', { fresh: true });
    client.failAll(new AuthError('offline'));
    await phone.getState().recordSession(event('evt-00000001'));
    await phone.getState().recordSession(event('evt-00000001'));
    await flush();
    expect(pendingOf(phone.getState().sessions)).toHaveLength(1);
    client.failAll(null);
    await phone.getState().flush();
    await phone.getState().flush();
    await flush();
    expect(server()).toHaveLength(1);
    expect(pendingOf(phone.getState().sessions)).toHaveLength(0);
  });

  it("two devices both claiming a stop's first completion: the server's verdict wins", async () => {
    const { device, server } = await setup();
    const phone = device();
    const tablet = device();
    await phone.getState().load('user-1', { fresh: true });
    await tablet.getState().load('user-1', { fresh: true });
    await phone.getState().recordSession(event('evt-00000001'));
    await flush();
    await tablet.getState().recordSession(event('evt-00000002', { at: 200 }));
    await flush();
    expect(server().map((e) => (e as SessionCompletedEvent).firstTime)).toEqual([true, false]);
    expect(
      (tablet.getState().sessions.items['evt-00000002'] as SessionCompletedEvent).firstTime,
    ).toBe(false);
    // A third device sees both, confirmed.
    const laptop = device();
    await laptop.getState().load('user-1');
    await flush();
    expect(eventsOf(laptop.getState().sessions).map((e) => e.id)).toEqual([
      'evt-00000001',
      'evt-00000002',
    ]);
  });

  it('two tabs: an event from either tab is kept (union)', async () => {
    const { device } = await setup();
    const shared = sharedStorage();
    const tabA = device(shared.view() as never);
    const tabB = device(shared.view() as never);
    await tabA.getState().load('user-1', { fresh: true });
    await tabB.getState().load('user-1', { fresh: true });
    await tabA.getState().recordSession(event('evt-00000001'));
    await flush();
    await tabB.getState().recordSession(event('evt-00000002', { stopId: 'intro-3' }));
    await flush();
    expect(Object.keys(tabA.getState().sessions.items)).toEqual(['evt-00000001', 'evt-00000002']);
    expect(Object.keys(tabB.getState().sessions.items)).toEqual(['evt-00000001', 'evt-00000002']);
  });

  it('a rate limit in the middle of the one-by-one fallback keeps what was learned', async () => {
    const { device, server, client } = await setup();
    const phone = device();
    await phone.getState().load('user-1', { fresh: true });
    const real = client.appendEvents.bind(client);
    const bad = 'evt-00000002';
    let limitOnce = true;
    const sizes: number[] = [];
    client.appendEvents = (async (stream: never, items: SessionCompletedEvent[], token: string) => {
      sizes.push(items.length);
      if (items.some((e) => e.id === bad)) throw new AuthError('invalid_request', { status: 400 });
      if (limitOnce && items.some((e) => e.id === 'evt-00000003')) {
        limitOnce = false;
        throw new AuthError('rate_limited', { status: 429, retryAfterSeconds: 60 });
      }
      return real(stream, items as never, token);
    }) as never;
    client.failAll(new AuthError('offline'));
    for (const n of [1, 2, 3, 4]) {
      await phone.getState().recordSession(event(`evt-0000000${n}`, { stopId: `intro-${n}` }));
    }
    await flush();
    client.failAll(null);
    await phone.getState().flush();
    await flush();
    // The batch was refused, evt-1 was stored, evt-2 refused for good, evt-3 hit the rate limit.
    expect(server().map((e) => e.id)).toEqual(['evt-00000001']);
    expect(pendingOf(phone.getState().sessions).map((e) => e.id)).toEqual([
      'evt-00000003',
      'evt-00000004',
    ]);
    expect((phone.getState().syncError as AuthError).code).toBe('rate_limited');
    // The next attempt does not start over: only the two pending events are sent, in one request.
    sizes.length = 0;
    await phone.getState().flush();
    await flush();
    expect(sizes).toEqual([2]);
    expect(server().map((e) => e.id)).toEqual(['evt-00000001', 'evt-00000003', 'evt-00000004']);
    expect(pendingOf(phone.getState().sessions)).toEqual([]);
    await phone.getState().reset();
  });

  it('an error that is not an explicit refusal never settles events for good', async () => {
    const { device, server, client } = await setup();
    const phone = device();
    await phone.getState().load('user-1', { fresh: true });
    client.failAll(new AuthError('unknown', { status: 409 }));
    await phone.getState().recordSession(event('evt-00000001'));
    await flush();
    client.failAll(null);
    expect(pendingOf(phone.getState().sessions)).toHaveLength(1);
    // The profile store accepts a later change (rejected is cleared by a new write).
    await phone.getState().recordSession(event('evt-00000002', { stopId: 'intro-3' }));
    await flush();
    expect(
      server()
        .map((e) => e.id)
        .sort(),
    ).toEqual(['evt-00000001', 'evt-00000002']);
  });
});
