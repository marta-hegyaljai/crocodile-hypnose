import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ProfileTab from '@/app/(app)/profile';
import HelpScreen from '@/app/settings/help';
import PrivacyScreen from '@/app/settings/privacy';
import { MotionProvider } from '@/motion/MotionProvider';
import {
  AuthError,
  AuthProvider,
  createAuthStore,
  createSessionManager,
  createSessionStore,
  type AuthStore,
} from '@/services/auth';
import { ProfileProvider, createProfileStore, type ProfileStore } from '@/services/profile';
import { createFakeAuthClient, memoryStorage } from '@/test/fakeAuth';
import { createFakeProfileClient, type FakeProfileClient } from '@/test/fakeProfile';
import { AtmosphereProvider } from '@/theme';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useIsFocused: () => true,
}));
const mockRouter = jest.requireMock<{ router: Record<string, jest.Mock> }>('expo-router').router;

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let auth: AuthStore;
let profile: ProfileStore;
let client: FakeProfileClient;
let session: ReturnType<typeof createSessionManager>;

beforeEach(async () => {
  jest.clearAllMocks();
  const authClient = createFakeAuthClient();
  session = createSessionManager({
    client: authClient,
    store: createSessionStore(memoryStorage()),
  });
  auth = createAuthStore({ client: authClient, session });
  await auth.getState().bootstrap();
  await auth.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
  client = createFakeProfileClient({ userOf: () => 'user-1' });
  profile = createProfileStore({
    client,
    session,
    storage: memoryStorage(),
    debounceMs: 0,
    retryMs: { first: 5, max: 20 },
  });
  await profile.getState().load('user-1', { fresh: true });
  await profile.getState().updateSettings((d) => ({
    ...d,
    crocName: 'Snap',
    moodConsent: true,
    safety: { answers: [false, false, false], cautionMode: false },
  }));
});

async function show(Screen: React.ComponentType) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AuthProvider store={auth}>
        <ProfileProvider store={profile}>
          <MotionProvider initialOverride>
            <AtmosphereProvider>
              <Screen />
            </AtmosphereProvider>
          </MotionProvider>
        </ProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>,
  );
}

const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const type = (id: string, text: string) => fireEvent.changeText(screen.getByTestId(id), text);
const settings = () => profile.getState().settings;

describe('profile tab', () => {
  it('shows the croc, the account and the summary', async () => {
    await show(ProfileTab);
    expect(screen.getByTestId('profile-croc-name')).toHaveTextContent('Snap');
    expect(screen.getByTestId('profile-email')).toHaveTextContent(/ann@example.com/);
    expect(screen.getByTestId('profile-stat-sessions')).toHaveTextContent('0');
    expect(screen.getByTestId('profile-stat-minutes')).toHaveTextContent('0 min');
  });

  it('renames the croc, with the same rules as the hatch screen', async () => {
    await show(ProfileTab);
    await type('profile-name', '   ');
    await press('profile-name-save');
    expect(screen.getByTestId('profile-name-error')).toBeOnTheScreen();
    expect(settings().crocName).toBe('Snap');
    await type('profile-name', 'Z'.repeat(21));
    await press('profile-name-save');
    expect(screen.getByTestId('profile-name-error')).toHaveTextContent(
      'Use at most 20 characters.',
    );
    await type('profile-name', '  Zed   Z ');
    await press('profile-name-save');
    expect(settings().crocName).toBe('Zed Z');
    expect(screen.getByTestId('profile-name-saved')).toBeOnTheScreen();
  });

  it('shows the settings only once the user settings are in (never the defaults)', async () => {
    client.seed('user-1', 'settings', { ...settings(), sound: false });
    await profile.getState().reset();
    const hold = client.hold();
    const storage = memoryStorage();
    storage.data.set(
      'mhp.hypnose.onboarding.v1.user-1',
      JSON.stringify({ ...profile.getState().onboarding, step: 'done', completed: true }),
    );
    profile = createProfileStore({
      client,
      session,
      storage,
      debounceMs: 0,
    });
    await profile.getState().load('user-1');
    await show(ProfileTab);
    expect(screen.getByTestId('settings-loading')).toBeOnTheScreen();
    expect(screen.queryByTestId('setting-sound')).toBeNull();
    expect(screen.queryByTestId('profile-name')).toBeNull();
    await act(async () => hold.release());
    await waitFor(() => expect(screen.getByTestId('setting-sound')).toBeOnTheScreen());
    expect(screen.queryByTestId('settings-loading')).toBeNull();
  });

  it('every toggle takes effect at once', async () => {
    await show(ProfileTab);
    await press('setting-sound');
    expect(settings().sound).toBe(false);
    await press('setting-haptics');
    expect(settings().haptics).toBe(false);
    expect(screen.getByTestId('setting-sound')).toHaveAccessibleName(/Sounds/);
    await press('setting-length-long');
    expect(settings().sessionLength).toBe('long');
    await press('setting-motion-reduce');
    expect(settings().reducedMotion).toBe(true);
    await press('setting-motion-follow');
    expect(settings().reducedMotion).toBeNull();
  });

  it('the reminder: on, quick times, a typed time (invalid ones are refused), off', async () => {
    await show(ProfileTab);
    expect(screen.queryByTestId('reminder-time')).toBeNull();
    await press('setting-reminder');
    expect(settings().reminder).toMatchObject({ enabled: true, time: '20:30' });
    await press('reminder-morning');
    expect(settings().reminder).toMatchObject({ time: '08:00', timeOfDay: 'morning' });
    await type('reminder-time', '07:1');
    expect(screen.getByTestId('reminder-time-error')).toBeOnTheScreen();
    expect(settings().reminder.time).toBe('08:00');
    await type('reminder-time', '07:15');
    expect(settings().reminder.time).toBe('07:15');
    await press('setting-reminder');
    expect(settings().reminder).toMatchObject({ enabled: false, time: '07:15' });
    // The change reaches the server.
    await act(async () => {
      await profile.getState().flush();
    });
    expect(client.documents.get('user-1:settings')).toMatchObject({
      reminder: { enabled: false, time: '07:15' },
    });
  });

  it('turning mood check-ins off deletes the entries and says so', async () => {
    await profile.getState().recordMood({
      id: 'mood-0000001',
      at: 1,
      phase: 'before',
      value: 3,
      stopId: null,
    });
    await show(ProfileTab);
    await press('setting-mood');
    await waitFor(() => expect(screen.getByTestId('mood-deleted')).toBeOnTheScreen());
    expect(settings().moodConsent).toBe(false);
    expect(Object.keys(profile.getState().moods.items)).toEqual([]);
  });

  it('opens safety and privacy', async () => {
    await show(ProfileTab);
    await press('profile-help-link');
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/help');
  });
});

describe('safety and help', () => {
  it('marks the contacts and the therapy note as placeholders and re-takes the check', async () => {
    await show(HelpScreen);
    expect(screen.getByTestId('help-contacts')).toBeOnTheScreen();
    expect(screen.getByTestId('help-therapy-note')).toBeOnTheScreen();
    expect(screen.getByTestId('retake-save')).toBeDisabled();

    // A "yes" shows the information first; saving needs the acknowledgement.
    await press('retake-2-yes');
    await press('retake-save');
    expect(screen.getByTestId('retake-info')).toBeOnTheScreen();
    expect(settings().safety.cautionMode).toBe(false);
    await press('retake-acknowledge');
    expect(settings().safety).toEqual({ answers: [false, true, false], cautionMode: true });
    expect(profile.getState().onboarding.safety.answers).toEqual([false, true, false]);
    expect(screen.getByTestId('retake-result')).toBeOnTheScreen();

    // Back to all "no": caution mode goes off, no information needed.
    await press('retake-2-no');
    await press('retake-save');
    expect(settings().safety).toEqual({ answers: [false, false, false], cautionMode: false });
  });
});

describe('privacy', () => {
  it('exports the data as a block of JSON to copy', async () => {
    await show(PrivacyScreen);
    expect(screen.getByTestId('privacy-stored')).toBeOnTheScreen();
    await press('export-data');
    await waitFor(() => expect(screen.getByTestId('export-json')).toBeOnTheScreen());
    const data = JSON.parse(String(screen.getByTestId('export-json').props.children)) as {
      documents: { settings: { crocName: string } };
    };
    expect(data.documents.settings.crocName).toBe('Snap');
  });

  it('says so when the export fails', async () => {
    await show(PrivacyScreen);
    client.failAll(new AuthError('unreachable'));
    await press('export-data');
    await waitFor(() => expect(screen.getByTestId('export-error')).toBeOnTheScreen());
    expect(screen.queryByTestId('export-json')).toBeNull();
  });
});
