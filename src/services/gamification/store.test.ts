import { createAuthStore } from '@/services/auth/authStore';
import { createSessionManager } from '@/services/auth/sessionManager';
import { createSessionStore } from '@/services/auth/storage';
import { AuthError } from '@/services/auth/types';
import { createProfileStore } from '@/services/profile/profileStore';
import { createFakeAuthClient, memoryStorage } from '@/test/fakeAuth';
import { createFakeGamificationClient } from '@/test/fakeGamification';
import { createFakeProfileClient } from '@/test/fakeProfile';

import { createGamificationStore, placeIn, removeFrom } from './store';
import { emptySlots } from './types';

const flush = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
};

async function setup() {
  const authClient = createFakeAuthClient();
  const session = createSessionManager({
    client: authClient,
    store: createSessionStore(memoryStorage()),
  });
  const auth = createAuthStore({ client: authClient, session });
  await auth.getState().bootstrap();
  await auth.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
  const profileClient = createFakeProfileClient({ userOf: () => 'user-1' });
  const storage = memoryStorage();
  const profile = createProfileStore({ client: profileClient, session, storage, debounceMs: 0 });
  const server = createFakeGamificationClient({ profile: profileClient });
  const store = createGamificationStore({
    client: server,
    session,
    storage,
    profile,
    debounceMs: 0,
    timeZone: () => 'Europe/Berlin',
  });
  await profile.getState().load('user-1', { fresh: true });
  await store.getState().load('user-1', { fresh: true });
  return { profile, store, server, profileClient };
}

const session = (id: string, stopId: string) => ({
  id,
  type: 'sessionCompleted' as const,
  stopId,
  stopType: 'video' as const,
  at: Date.now() - 1000,
  firstTime: true,
});

describe('gamification store', () => {
  it('shows the server’s points once the events are stored', async () => {
    const { profile, store } = await setup();
    expect(store.getState().summary.balance).toBe(0);
    await profile.getState().recordSession(session('evt-00000001', 'intro-1'));
    await flush();
    await flush();
    // 10 + 20 first time + 15 first-session badge.
    expect(store.getState().summary.balance).toBe(45);
    expect(store.getState().summary.badges.map((b) => b.id)).toEqual(['firstSession']);
  });

  it('buys, places and takes out a decoration; refusals and offline are reported', async () => {
    const { profile, store, server } = await setup();
    expect(await store.getState().purchase('lilyPads')).toBe('insufficient');
    await profile.getState().recordSession(session('evt-00000001', 'intro-1'));
    await flush();
    expect(await store.getState().purchase('turtle')).toBe('locked');
    expect(await store.getState().purchase('lilyPads')).toBe('ok');
    expect(store.getState().summary.balance).toBe(45 - 40 + 15);
    await store.getState().place('lilyPads');
    expect(store.getState().habitat.slots['water-left']).toBe('lilyPads');
    await flush();
    expect(server.habitat?.slots['water-left']).toBe('lilyPads');
    await store.getState().remove('lilyPads');
    expect(store.getState().habitat.slots['water-left']).toBeNull();
    // Not owned: nothing is placed.
    await store.getState().place('heron');
    expect(Object.values(store.getState().habitat.slots)).not.toContain('heron');
    server.failAll(new AuthError('offline'));
    expect(await store.getState().purchase('reeds')).toBe('offline');
  });

  it('starts the weekly goal from the onboarding timing, then follows the user', async () => {
    const { profile, store, server } = await setup();
    await profile.getState().updateOnboarding((d) => ({
      ...d,
      completed: true,
      completedAt: 1,
      step: 'done',
      sessionLength: 'short',
    }));
    await flush();
    expect(store.getState().goal.weeklyTarget).toBe(5);
    expect(store.getState().goal.timeZone).toBe('Europe/Berlin');
    await store.getState().setWeeklyTarget(9);
    expect(store.getState().goal.weeklyTarget).toBe(7);
    await store.getState().stepWeeklyTarget(1);
    expect(store.getState().goal.weeklyTarget).toBe(7);
    for (let i = 0; i < 6; i++) await store.getState().stepWeeklyTarget(-1);
    expect(store.getState().goal.weeklyTarget).toBe(3);
    await store.getState().stepWeeklyTarget(2);
    await flush();
    expect(server.goal?.weeklyTarget).toBe(5);
  });

  it('the growth and week marks only move forward', async () => {
    const { store } = await setup();
    await store.getState().markStageSeen('adult');
    await store.getState().markStageSeen('juvenile');
    expect(store.getState().goal.seenStage).toBe('adult');
    await store.getState().markWeekCelebrated(20);
    await store.getState().markWeekCelebrated(10);
    expect(store.getState().goal.celebratedWeek).toBe(20);
  });

  it('places in a free slot of the item’s kind, never twice', () => {
    let slots = emptySlots();
    slots = placeIn(slots, 'lilyPads');
    slots = placeIn(slots, 'lotus');
    expect(slots['water-left']).toBe('lilyPads');
    expect(slots['water-right']).toBe('lotus');
    expect(placeIn(slots, 'lotus')).toBe(slots);
    expect(removeFrom(slots, 'lotus')['water-right']).toBeNull();
  });
});
