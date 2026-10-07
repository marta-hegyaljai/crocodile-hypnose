import { AuthError } from '@/services/auth/types';
import { memoryStorage, sharedStorage } from '@/test/fakeAuth';

import { createDocumentStore, newerOf } from './documentStore';
import { mergeOnboarding } from './mergeOnboarding';
import { mergeSettings, settingsStamps, stampSettings } from './mergeSettings';
import {
  defaultOnboarding,
  defaultSettings,
  isOnboardingDoc,
  isSettingsDoc,
  SETTINGS_FIELDS,
  type OnboardingDoc,
  type SettingsDoc,
} from './types';

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(
  storage = memoryStorage(),
  server: { doc: OnboardingDoc | null; fail?: AuthError | null; puts: OnboardingDoc[] } = {
    doc: null,
    puts: [],
  },
) {
  let now = 1_000_000;
  const clock = { advance: (ms: number) => (now += ms) };
  const store = createDocumentStore<OnboardingDoc>({
    key: 'test.onboarding',
    storage,
    defaults: () => defaultOnboarding(),
    validate: isOnboardingDoc,
    fetch: async () => {
      if (server.fail) throw server.fail;
      return server.doc;
    },
    push: async (_user, doc) => {
      if (server.fail) throw server.fail;
      server.puts.push(doc);
      if (server.doc && server.doc.updatedAt > doc.updatedAt) return server.doc;
      server.doc = doc;
      return doc;
    },
    merge: mergeOnboarding,
    now: () => now,
    debounceMs: 0,
    retryMs: { first: 5, max: 20 },
  });
  return { store, storage, server, clock };
}

const finished = (updatedAt: number): OnboardingDoc => ({
  ...defaultOnboarding(updatedAt),
  step: 'done',
  completed: true,
  completedAt: updatedAt,
  goals: ['sleep'],
  crocHatched: true,
  crocName: 'Zed',
  firstSession: { completed: true, moodBefore: null, moodAfter: null },
  reminder: 'skipped',
  rewardGranted: true,
});

describe('newerOf', () => {
  it('prefers the later updatedAt and keeps the local copy on a tie', () => {
    const a = defaultOnboarding(5);
    const b = defaultOnboarding(9);
    expect(newerOf(a, b)).toBe(b);
    expect(newerOf(b, a)).toBe(b);
    expect(newerOf(a, defaultOnboarding(5))).toBe(a);
    expect(newerOf(null, b)).toBe(b);
    expect(newerOf(a, null)).toBe(a);
    expect(newerOf(null, null)).toBeNull();
  });
});

describe('document store', () => {
  it('starts from the defaults when nothing is stored anywhere', async () => {
    const { store, server } = setup();
    await store.getState().load('u1');
    expect(store.getState()).toMatchObject({ status: 'ready', source: 'none', dirty: false });
    expect(store.getState().doc.step).toBe('goals');
    await flush();
    expect(server.puts).toEqual([]);
  });

  it('persists a change on the device at once and pushes it to the server', async () => {
    const { store, storage, server, clock } = setup();
    await store.getState().load('u1');
    await flush();
    clock.advance(10);
    await store.getState().update((d) => ({ ...d, goals: ['sleep'], step: 'experience' }));
    expect(store.getState().dirty).toBe(true);
    const local = JSON.parse(storage.data.get('test.onboarding.u1')!) as OnboardingDoc;
    expect(local.goals).toEqual(['sleep']);
    expect(local.updatedAt).toBe(1_000_010);
    await flush();
    await flush();
    expect(server.puts).toHaveLength(1);
    expect(store.getState().dirty).toBe(false);
  });

  it('resumes from the device copy and lets the server catch up', async () => {
    const { store, storage, server, clock } = setup();
    await store.getState().load('u1');
    await flush();
    clock.advance(1);
    server.fail = new AuthError('offline');
    await store.getState().update((d) => ({ ...d, step: 'safety' }));
    await flush();
    expect(store.getState().dirty).toBe(true);
    expect(store.getState().syncError).toBeInstanceOf(AuthError);

    // Restart while still offline: the device copy is what the user sees.
    const restarted = setup(storage, server);
    await restarted.store.getState().load('u1');
    expect(restarted.store.getState().doc.step).toBe('safety');
    expect(restarted.store.getState().source).toBe('local');
    await flush();
    expect(restarted.store.getState().serverKnown).toBe(false);
    expect(restarted.store.getState().syncError).toBeInstanceOf(AuthError);

    // Back online: a flush reads the server first, then pushes the pending change.
    server.fail = null;
    await restarted.store.getState().flush();
    await flush();
    expect(server.doc?.step).toBe('safety');
    expect(restarted.store.getState().dirty).toBe(false);
    expect(restarted.store.getState().serverKnown).toBe(true);
  });

  it('never pushes before the server was read: a failed first read keeps retrying', async () => {
    const server: { doc: OnboardingDoc; fail: AuthError | null; puts: OnboardingDoc[] } = {
      doc: finished(5_000_000),
      fail: new AuthError('unreachable'),
      puts: [],
    };
    const { store, clock } = setup(memoryStorage(), server);
    await store.getState().load('u1');
    expect(store.getState().serverKnown).toBe(false);
    // The user taps anyway (the app shows a loading state, but suppose it did not).
    clock.advance(10);
    await store.getState().update((d) => ({ ...d, goals: ['focus'] }));
    await flush();
    await flush();
    expect(server.puts).toEqual([]);
    // The server comes back: the read is retried, and the finished onboarding wins.
    server.fail = null;
    await new Promise((r) => setTimeout(r, 60));
    expect(store.getState().serverKnown).toBe(true);
    expect(store.getState().doc.completed).toBe(true);
    expect(store.getState().doc.crocName).toBe('Zed');
    expect(server.doc.completed).toBe(true);
  });

  it('a finished onboarding always wins over a stale, newer, unfinished copy', async () => {
    const storage = memoryStorage();
    const stale = {
      ...defaultOnboarding(9_000_000),
      step: 'experience' as const,
      goals: ['focus'] as OnboardingDoc['goals'],
    };
    storage.data.set('test.onboarding.u1', JSON.stringify(stale));
    const server = { doc: finished(5_000_000), puts: [] as OnboardingDoc[] };
    const { store } = setup(storage, server);
    await store.getState().load('u1');
    await flush();
    await flush();
    expect(store.getState().doc.completed).toBe(true);
    expect(store.getState().dirty).toBe(false);
    expect(server.doc.completed).toBe(true);
  });

  it('two tabs: a tab on an earlier step follows the tab that finished', async () => {
    const shared = sharedStorage();
    const server = { doc: null as OnboardingDoc | null, puts: [] as OnboardingDoc[] };
    const a = setup(shared.view() as never, server);
    const b = setup(shared.view() as never, server);
    await a.store.getState().load('u1');
    await b.store.getState().load('u1');
    await flush();
    a.clock.advance(10);
    await a.store.getState().update((d) => ({ ...d, goals: ['sleep'], step: 'experience' }));
    await flush();
    expect(b.store.getState().doc.step).toBe('experience');
    // B finishes.
    b.clock.advance(20);
    await b.store.getState().update(() => finished(1_000_020));
    await flush();
    await flush();
    expect(a.store.getState().doc.completed).toBe(true);
    // A stale tap in A (its React tree may still be on the old screen) cannot undo it.
    a.clock.advance(30);
    await a.store.getState().update((d) => ({ ...d, experience: 'new' }));
    expect(a.store.getState().doc.completed).toBe(true);
    await flush();
    await flush();
    expect(server.doc?.completed).toBe(true);
  });

  it('stops retrying a write the server refused', async () => {
    const { store, server, clock } = setup();
    await store.getState().load('u1');
    await flush();
    clock.advance(1);
    server.fail = new AuthError('invalid_request', { status: 400 });
    await store.getState().update((d) => ({ ...d, step: 'consent' }));
    await flush();
    await flush();
    expect(store.getState().rejected).toBe(true);
    expect(store.getState().dirty).toBe(true);
    server.fail = null;
    await store.getState().flush();
    expect(server.puts).toHaveLength(0);
    // The next change tries again.
    clock.advance(1);
    await store.getState().update((d) => ({ ...d, step: 'hatch' }));
    await flush();
    await flush();
    expect(server.puts).toHaveLength(1);
  });

  it('adopts a newer server document on load (a second device)', async () => {
    const remote = { ...defaultOnboarding(5_000_000), step: 'done' as const, completed: true };
    const { store, storage } = setup(memoryStorage(), { doc: remote, puts: [] });
    await store.getState().load('u1');
    await flush();
    expect(store.getState()).toMatchObject({ source: 'server', dirty: false, serverKnown: true });
    expect(store.getState().doc.completed).toBe(true);
    expect(storage.data.get('test.onboarding.u1')).toContain('"completed":true');
  });

  it('keeps a newer device copy over an older server one and pushes it', async () => {
    const storage = memoryStorage();
    const local = { ...defaultOnboarding(2_000_000), step: 'hatch' as const };
    storage.data.set('test.onboarding.u1', JSON.stringify(local));
    const remote = { ...defaultOnboarding(1_500_000), step: 'consent' as const };
    const { store, server } = setup(storage, { doc: remote, puts: [] });
    await store.getState().load('u1');
    await flush();
    await flush();
    expect(store.getState().doc.step).toBe('hatch');
    expect(server.doc?.step).toBe('hatch');
    expect(store.getState().dirty).toBe(false);
  });

  it('adopts the newer document the server answers a write with', async () => {
    const { store, server, clock } = setup();
    await store.getState().load('u1');
    await flush();
    clock.advance(10);
    await store.getState().update((d) => ({ ...d, step: 'experience' }));
    // Another device wrote later meanwhile.
    server.doc = { ...defaultOnboarding(9_000_000), step: 'reminder' };
    await store.getState().flush();
    expect(store.getState().doc.step).toBe('reminder');
    expect(store.getState().dirty).toBe(false);
  });

  it('pushes again when the document changed while a write was in flight', async () => {
    const { store, clock } = setup();
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => {
      release = r;
    });
    const slow = createDocumentStore<OnboardingDoc>({
      key: 'slow',
      storage: memoryStorage(),
      defaults: () => defaultOnboarding(),
      validate: isOnboardingDoc,
      fetch: async () => null,
      push: async (_u, doc) => {
        pushed.push(doc.step);
        if (pushed.length === 1) await held;
        return doc;
      },
      now: () => Date.now(),
      debounceMs: 0,
    });
    const pushed: string[] = [];
    void store;
    void clock;
    await slow.getState().load('u1');
    await flush();
    await slow.getState().update((d) => ({ ...d, step: 'experience' }));
    await flush();
    await slow.getState().update((d) => ({ ...d, step: 'safety' }));
    release();
    await flush();
    await flush();
    await flush();
    expect(pushed).toEqual(['experience', 'safety']);
    expect(slow.getState().dirty).toBe(false);
  });

  it('ignores a corrupt device copy and an unknown schema version', async () => {
    const storage = memoryStorage();
    storage.data.set('test.onboarding.u1', '{nope');
    const { store } = setup(storage);
    await store.getState().load('u1');
    expect(store.getState().source).toBe('none');
    storage.data.set('test.onboarding.u1', JSON.stringify({ ...defaultOnboarding(1), version: 2 }));
    await store.getState().load('u1');
    expect(store.getState().source).toBe('none');
  });

  it('a fresh account skips the server read', async () => {
    const { store, server } = setup(memoryStorage(), {
      doc: { ...defaultOnboarding(1), step: 'done' },
      puts: [],
    });
    await store.getState().load('u1', { fresh: true });
    await flush();
    expect(store.getState().doc.step).toBe('goals');
    expect(store.getState().serverKnown).toBe(true);
    void server;
  });

  it('reset forgets the document and its device copy', async () => {
    const { store, storage, clock } = setup();
    await store.getState().load('u1');
    await flush();
    clock.advance(1);
    await store.getState().update((d) => ({ ...d, step: 'consent' }));
    await store.getState().reset();
    expect(store.getState()).toMatchObject({ status: 'idle', userId: null, dirty: false });
    expect(store.getState().doc.step).toBe('goals');
    expect(storage.data.has('test.onboarding.u1')).toBe(false);
    // Nothing is pushed for a signed-out user.
    await store.getState().update((d) => ({ ...d, step: 'hatch' }));
    expect(store.getState().doc.step).toBe('goals');
  });

  it('a late server answer for a previous user is dropped', async () => {
    let resolveFetch: (doc: OnboardingDoc | null) => void = () => undefined;
    const store = createDocumentStore<OnboardingDoc>({
      key: 'late',
      storage: memoryStorage(),
      defaults: () => defaultOnboarding(),
      validate: isOnboardingDoc,
      fetch: (user) =>
        user === 'u1'
          ? new Promise((r) => {
              resolveFetch = r;
            })
          : Promise.resolve(null),
      push: async (_u, doc) => doc,
    });
    await store.getState().load('u1');
    await store.getState().reset();
    await store.getState().load('u2');
    resolveFetch({ ...defaultOnboarding(99), step: 'done', completed: true });
    await flush();
    expect(store.getState().userId).toBe('u2');
    expect(store.getState().doc.completed).toBe(false);
  });

  it('settles after one round trip when the client clock is ahead of the server clamp', async () => {
    const serverNow = 1_000_000;
    const clientNow = serverNow + 10 * 60_000;
    // Another device already changed the name, a while ago.
    let stored: SettingsDoc = {
      ...defaultSettings(900_000),
      crocName: 'Zed',
      fieldsAt: {
        doc: 900_000,
        ...Object.fromEntries(SETTINGS_FIELDS.map((f) => [f, f === 'crocName' ? 900_000 : 0])),
      } as never,
    };
    let puts = 0;
    // The dev server's rules: updatedAt and every stamp are clamped to the server's time, then
    // the copies merge field by field.
    const clamp = (doc: SettingsDoc): SettingsDoc => {
      const updatedAt = Math.min(doc.updatedAt, serverNow);
      const stamps = settingsStamps(doc);
      for (const f of SETTINGS_FIELDS) stamps[f] = Math.min(stamps[f], updatedAt);
      return { ...doc, updatedAt, fieldsAt: { doc: updatedAt, ...stamps } };
    };
    const store = createDocumentStore<SettingsDoc>({
      key: 'test.settings',
      storage: memoryStorage(),
      defaults: () => defaultSettings(),
      validate: isSettingsDoc,
      fetch: async () => stored,
      push: async (_user, doc) => {
        puts += 1;
        stored = mergeSettings(stored, clamp(doc));
        return { ...stored };
      },
      merge: mergeSettings,
      stamp: stampSettings,
      now: () => clientNow,
      debounceMs: 0,
      retryMs: { first: 5, max: 20 },
    });
    await store.getState().load('u1');
    for (let i = 0; i < 4; i++) await flush();
    expect(store.getState().doc.crocName).toBe('Zed');
    expect(puts).toBe(0);

    await store.getState().update((d) => ({ ...d, sound: !d.sound }));
    for (let i = 0; i < 20; i++) await flush();

    expect(puts).toBeLessThanOrEqual(2);
    expect(store.getState().dirty).toBe(false);
    const sound = !defaultSettings().sound;
    expect(store.getState().doc).toMatchObject({ sound, crocName: 'Zed' });
    expect(stored).toMatchObject({ sound, crocName: 'Zed', updatedAt: serverNow });
  });
});
