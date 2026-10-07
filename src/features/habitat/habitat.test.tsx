import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MotionProvider } from '@/motion/MotionProvider';
import {
  AuthProvider,
  createAuthStore,
  createSessionManager,
  createSessionStore,
  type AuthStore,
} from '@/services/auth';
import { FeedbackProvider, createFeedback } from '@/services/feedback';
import {
  GamificationProvider,
  createGamificationStore,
  type GamificationStore,
} from '@/services/gamification';
import { ProfileProvider, createProfileStore, type ProfileStore } from '@/services/profile';
import { createFakeAuthClient, memoryStorage } from '@/test/fakeAuth';
import { createFakeGamificationClient, type FakeGamificationClient } from '@/test/fakeGamification';
import { createFakeProfileClient } from '@/test/fakeProfile';
import { AtmosphereProvider } from '@/theme';

import { HabitatScreen } from './HabitatScreen';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let auth: AuthStore;
let profile: ProfileStore;
let store: GamificationStore;
let server: FakeGamificationClient;

beforeEach(async () => {
  const client = createFakeAuthClient();
  const session = createSessionManager({ client, store: createSessionStore(memoryStorage()) });
  auth = createAuthStore({ client, session });
  const profileClient = createFakeProfileClient();
  const storage = memoryStorage();
  profile = createProfileStore({ client: profileClient, session, storage, debounceMs: 0 });
  server = createFakeGamificationClient({ profile: profileClient });
  store = createGamificationStore({
    client: server,
    session,
    storage,
    profile,
    debounceMs: 0,
    timeZone: () => 'UTC',
  });
  await auth.getState().bootstrap();
  await auth.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
  await profile.getState().load('user-1', { fresh: true });
});

async function show(ui: React.ReactElement) {
  await store.getState().load('user-1', { fresh: true });
  const feedback = createFeedback({
    haptics: { play: async () => {} },
    sounds: { play: async () => {} },
  });
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AuthProvider store={auth}>
        <ProfileProvider store={profile}>
          <GamificationProvider store={store}>
            <FeedbackProvider feedback={feedback}>
              <MotionProvider initialOverride>
                <AtmosphereProvider>{ui}</AtmosphereProvider>
              </MotionProvider>
            </FeedbackProvider>
          </GamificationProvider>
        </ProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>,
  );
}

const earn = async () => {
  await act(async () => {
    await profile.getState().recordSession({
      id: 'evt-00000001',
      type: 'sessionCompleted',
      stopId: 'intro-1',
      stopType: 'video',
      at: Date.now() - 1000,
      firstTime: true,
    });
  });
  await waitFor(() => expect(store.getState().summary.balance).toBe(45));
};

describe('habitat (Croc tab)', () => {
  it('shows the points, the scales and the catalogue; buying places the decoration', async () => {
    await show(<HabitatScreen />);
    expect(screen.getByTestId('croc-screen')).toBeTruthy();
    expect(screen.getByTestId('badge-firstSession')).toBeTruthy();
    // Nothing affordable yet: buying is disabled, milestone items say what unlocks them.
    expect(screen.getByTestId('item-lilyPads-buy')).toBeDisabled();
    await earn();
    await waitFor(() => expect(screen.getByTestId('badge-firstSession-earned')).toBeTruthy());
    expect(screen.getByTestId('habitat-points')).toHaveTextContent(/45/);
    fireEvent.press(screen.getByTestId('item-lilyPads-buy'));
    await waitFor(() => expect(screen.getByTestId('item-lilyPads-remove')).toBeTruthy());
    expect(store.getState().habitat.slots['water-left']).toBe('lilyPads');
    expect(
      screen.getByTestId('habitat-scene-item-lilyPads', { includeHiddenElements: true }),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('item-lilyPads-remove'));
    await waitFor(() => expect(screen.getByTestId('item-lilyPads-place')).toBeTruthy());
  });

  it('changes the weekly goal with the stepper', async () => {
    await show(<HabitatScreen />);
    const target = () => store.getState().goal.weeklyTarget;
    const start = target();
    fireEvent.press(screen.getByTestId('weekly-more'));
    await waitFor(() => expect(target()).toBe(start + 1));
    // Two quick taps count twice.
    fireEvent.press(screen.getByTestId('weekly-less'));
    fireEvent.press(screen.getByTestId('weekly-less'));
    await waitFor(() => expect(target()).toBe(start - 1));
    expect(screen.getByTestId('weekly-target')).toHaveTextContent(new RegExp(`${start - 1}`));
  });
});
