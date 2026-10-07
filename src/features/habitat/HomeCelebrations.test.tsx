import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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

import { HomeCelebrations } from './HomeCelebrations';

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

describe('home celebrations', () => {
  it('shows the growth moment once per stage, also when grown elsewhere', async () => {
    server.addSeconds(31 * 60);
    await show(<HomeCelebrations crocName="Zé" active />);
    await waitFor(() =>
      expect(screen.getByTestId('growth-moment', { includeHiddenElements: true })).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId('growth-continue'));
    await waitFor(() => expect(screen.queryByTestId('growth-moment')).toBeNull());
    expect(store.getState().goal.seenStage).toBe('juvenile');
  });

  it('shows nothing when inactive or when nothing is new', async () => {
    server.addSeconds(31 * 60);
    await show(<HomeCelebrations crocName="Zé" active={false} />);
    expect(screen.queryByTestId('growth-moment')).toBeNull();
  });
});
