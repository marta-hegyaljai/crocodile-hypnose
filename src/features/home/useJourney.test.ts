import { deriveJourney, pickTodaysSession } from '@/content/journey';
import { localContent } from '@/content/repository';
import { createAuthStore } from '@/services/auth/authStore';
import { createSessionManager } from '@/services/auth/sessionManager';
import { createSessionStore } from '@/services/auth/storage';
import { AuthError } from '@/services/auth/types';
import type { ProfileClient } from '@/services/profile';
import { createProfileStore } from '@/services/profile/profileStore';
import { defaultOnboarding, defaultSettings } from '@/services/profile/types';
import { markDone } from '@/services/progress/mergeProgress';
import { defaultProgress } from '@/services/progress/types';
import { createFakeAuthClient, memoryStorage } from '@/test/fakeAuth';
import { createFakeProfileClient } from '@/test/fakeProfile';

import { effectiveCautionMode } from './useJourney';

const flush = async () => {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
};

const cautionAnswers = { ...defaultOnboarding().safety, answers: [true, false, false] };
const intro = (n: number) => Array.from({ length: n }, (_, i) => `intro-${i + 1}`);
const advanced = intro(5).reduce((doc, id) => markDone(doc, id, 10), defaultProgress());

describe('effectiveCautionMode', () => {
  const base = { settings: defaultSettings(), onboarding: defaultOnboarding() };
  const cautious = { ...base.onboarding, safety: cautionAnswers };

  it('before the settings are known it follows the onboarding answers', () => {
    expect(effectiveCautionMode({ ...base, onboarding: cautious, settingsKnown: false })).toBe(
      true,
    );
    expect(effectiveCautionMode({ ...base, settingsKnown: false })).toBe(false);
  });

  it('once the settings are known they decide (a user may turn caution mode off)', () => {
    expect(effectiveCautionMode({ ...base, onboarding: cautious, settingsKnown: true })).toBe(
      false,
    );
    const on = { ...base.settings, safety: { ...base.settings.safety, cautionMode: true } };
    expect(
      effectiveCautionMode({ settings: on, onboarding: base.onboarding, settingsKnown: true }),
    ).toBe(true);
  });
});

describe('a new device where progress arrives before the settings', () => {
  it('a caution user is never offered or able to start an unsuitable stop', async () => {
    const authClient = createFakeAuthClient();
    const session = createSessionManager({
      client: authClient,
      store: createSessionStore(memoryStorage()),
    });
    const auth = createAuthStore({ client: authClient, session });
    await auth.getState().bootstrap();
    await auth.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
    const fake = createFakeProfileClient({ userOf: () => 'user-1' });
    fake.seed('user-1', 'onboarding', {
      ...defaultOnboarding(5),
      step: 'done',
      completed: true,
      completedAt: 5,
      safety: { ...cautionAnswers, acknowledged: true },
    });
    fake.seed('user-1', 'progress', advanced);
    fake.seed('user-1', 'settings', {
      ...defaultSettings(5),
      safety: { answers: cautionAnswers.answers, cautionMode: true },
    });
    // The settings read fails (slow or offline) while onboarding and progress arrive.
    let settingsDown = true;
    const client: ProfileClient = {
      get: (kind, token) =>
        kind === 'settings' && settingsDown
          ? Promise.reject(new AuthError('unreachable'))
          : fake.get(kind, token),
      put: (kind, doc, token) => fake.put(kind, doc, token),
    } as ProfileClient;
    const store = createProfileStore({
      client,
      session,
      storage: memoryStorage(),
      debounceMs: 0,
      retryMs: { first: 5, max: 20 },
    });
    await store.getState().load('user-1');
    await flush();

    const state = store.getState();
    expect(state.status).toBe('ready');
    expect(state.settingsKnown).toBe(false);
    expect(Object.keys(state.progress.stops)).toHaveLength(5);
    const cautionMode = effectiveCautionMode(state);
    expect(cautionMode).toBe(true);
    const journey = deriveJourney(localContent, state.progress, { cautionMode });
    const unsafe = (id: string) => !localContent.stop(id)?.cautionSafe;
    for (const zone of journey.zones) {
      for (const view of zone.stops) {
        if (view.status === 'available' || view.status === 'inProgress') {
          expect(unsafe(view.stop.id)).toBe(false);
        }
      }
    }
    expect(journey.byStopId.get('intro-6')?.status).toBe('caution');
    for (const hour of [8, 14, 21]) {
      const today = pickTodaysSession(journey, { goals: ['sleep'], hour, cautionMode });
      if (today) expect(unsafe(today.stop.id)).toBe(false);
    }

    // The settings arrive: they decide from then on.
    settingsDown = false;
    await store.getState().flush();
    await flush();
    expect(store.getState().settingsKnown).toBe(true);
    expect(effectiveCautionMode(store.getState())).toBe(true);
  });
});
