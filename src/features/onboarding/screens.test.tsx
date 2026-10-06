import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '@/app/(app)/home';
import ConsentScreen from '@/app/onboarding/consent';
import DoneScreen from '@/app/onboarding/done';
import ExperienceScreen from '@/app/onboarding/experience';
import FirstSessionScreen from '@/app/onboarding/first-session';
import GoalsScreen from '@/app/onboarding/goals';
import HatchScreen from '@/app/onboarding/hatch';
import { HATCH_DURATION_MS } from '@/features/onboarding/HatchingEgg';
import OnboardingIndex from '@/app/onboarding/index';
import ReminderScreen from '@/app/onboarding/reminder';
import SafetyScreen from '@/app/onboarding/safety';
import { TapShieldProvider } from '@/features/layout/TapShield';
import { MotionProvider } from '@/motion/MotionProvider';
import {
  AuthError,
  AuthProvider,
  createAuthStore,
  createSessionManager,
  createSessionStore,
  type AuthStore,
} from '@/services/auth';
import {
  FeedbackProvider,
  createFeedback,
  type HapticKind,
  type UiSound,
} from '@/services/feedback';
import { ProfileProvider, createProfileStore, type ProfileStore } from '@/services/profile';
import type { OnboardingDoc } from '@/services/profile/types';
import { createFakeAuthClient, memoryStorage } from '@/test/fakeAuth';
import { createFakeProfileClient, type FakeProfileClient } from '@/test/fakeProfile';
import { AtmosphereProvider } from '@/theme';
import { RootGate } from '@/features/layout/RootGate';

const mockRedirect = jest.fn();
// The screen under test is "focused" until the test navigates away (router.push).
let mockFocused = true;
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(() => {
      mockFocused = false;
    }),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof React>('react');
    useEffect(() => {
      if (mockFocused) return effect();
    }, [effect]);
  },
}));
const mockRouter = jest.requireMock<{ router: Record<string, jest.Mock> }>('expo-router').router;

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let auth: AuthStore;
let profile: ProfileStore;
let profileClient: FakeProfileClient;
let haptics: HapticKind[];
let sounds: UiSound[];

beforeEach(async () => {
  jest.clearAllMocks();
  mockFocused = true;
  const client = createFakeAuthClient();
  const session = createSessionManager({ client, store: createSessionStore(memoryStorage()) });
  auth = createAuthStore({ client, session });
  profileClient = createFakeProfileClient();
  profile = createProfileStore({
    client: profileClient,
    session,
    storage: memoryStorage(),
    debounceMs: 0,
  });
  await auth.getState().bootstrap();
  await auth.getState().signUp({ email: 'ann@example.com', password: 'secret12' });
  await profile.getState().load('user-1', { fresh: true });
  haptics = [];
  sounds = [];
});

const feedback = () =>
  createFeedback({
    haptics: {
      play: async (k) => {
        haptics.push(k);
      },
    },
    sounds: {
      play: async (s) => {
        sounds.push(s);
      },
    },
  });

async function show(Screen: React.ComponentType) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AuthProvider store={auth}>
        <ProfileProvider store={profile}>
          <FeedbackProvider feedback={feedback()}>
            <TapShieldProvider>
              {/* Reduced motion: the scene's endless loops would never settle under Jest. */}
              <MotionProvider initialOverride>
                <AtmosphereProvider>
                  <Screen />
                </AtmosphereProvider>
              </MotionProvider>
            </TapShieldProvider>
          </FeedbackProvider>
        </ProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>,
  );
}

const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const type = (id: string, text: string) => fireEvent.changeText(screen.getByTestId(id), text);
const doc = () => profile.getState().onboarding;
const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const wait = (ms: number) => act(async () => new Promise((r) => setTimeout(r, ms)));
/** Mirrors the screen's double-tap guard. */
const TAP_GAP_MS = 220;

async function set(change: (d: OnboardingDoc) => OnboardingDoc) {
  await profile.getState().updateOnboarding(change);
}

const answeredUpTo = (step: OnboardingDoc['step']) => (d: OnboardingDoc) => {
  const order = ['goals', 'experience', 'safety', 'consent', 'hatch', 'firstSession', 'reminder'];
  const upTo = order.indexOf(step);
  return {
    ...d,
    step,
    goals: upTo >= 1 ? (['sleep'] as OnboardingDoc['goals']) : d.goals,
    experience: upTo >= 2 ? 'new' : d.experience,
    timeOfDay: upTo >= 2 ? 'evening' : d.timeOfDay,
    sessionLength: upTo >= 2 ? 'short' : d.sessionLength,
    safety: upTo >= 3 ? { answers: [false, false, false], acknowledged: false } : d.safety,
    moodConsent: upTo >= 4 ? false : d.moodConsent,
    crocHatched: upTo >= 5 ? true : d.crocHatched,
    crocName: upTo >= 5 ? 'Zed' : d.crocName,
    firstSession:
      upTo >= 6 ? { completed: true, moodBefore: null, moodAfter: null } : d.firstSession,
  } as OnboardingDoc;
};

describe('goals', () => {
  it('allows one or two goals, explains the limit, and continues', async () => {
    await show(GoalsScreen);
    expect(screen.getByTestId('onboarding-title')).toHaveTextContent('Your goals');
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();
    // The sign-up celebration is consumed by onboarding.
    expect(auth.getState().justSignedUp).toBe(false);

    await press('goal-sleep');
    await press('goal-focus');
    expect(doc().goals).toEqual(['sleep', 'focus']);
    expect(haptics).toEqual(['select', 'select']);
    await press('goal-habits');
    expect(doc().goals).toEqual(['sleep', 'focus']);
    expect(screen.getByTestId('goals-limit')).toBeOnTheScreen();
    await press('goal-sleep');
    expect(doc().goals).toEqual(['focus']);
    expect(screen.queryByTestId('goals-limit')).toBeNull();
    expect(screen.getByTestId('goals-picked')).toHaveTextContent('1 of 2 picked');

    await press('onboarding-continue');
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/experience');
    expect(doc().step).toBe('experience');
    // The next screen's button arrives where Continue was: a second tap is swallowed.
    expect(screen.getByTestId('tap-shield')).toBeOnTheScreen();
    // Settings follow the answers.
    expect(profile.getState().settings.goals).toEqual(['focus']);
  });

  it('shows why a third goal is refused, where the user is looking', async () => {
    await show(GoalsScreen);
    await press('goal-sleep');
    await press('goal-focus');
    await press('goal-habits');
    // The notice sits in the pinned footer, next to Continue; the egg and a haptic react too.
    expect(screen.getByTestId('goals-limit')).toBeOnTheScreen();
    expect(haptics).toEqual(['select', 'select', 'tap']);
  });

  it('is the only reachable step at the start: later steps redirect here', async () => {
    await show(SafetyScreen);
    expect(mockRedirect).toHaveBeenCalledWith('/onboarding/goals');
  });
});

describe('experience', () => {
  it('needs all three answers and sets the session and reminder defaults', async () => {
    await set(answeredUpTo('experience'));
    await show(ExperienceScreen);
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();
    await press('experience-new');
    await press('time-morning');
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();
    await press('length-long');
    expect(screen.getByTestId('onboarding-continue')).toBeEnabled();
    await press('onboarding-continue');
    expect(doc()).toMatchObject({ experience: 'new', timeOfDay: 'morning', sessionLength: 'long' });
    expect(profile.getState().settings).toMatchObject({
      sessionLength: 'long',
      reminder: { enabled: false, time: '08:00', timeOfDay: 'morning' },
    });
    // Back keeps the answers.
    await press('onboarding-back');
    expect(mockRouter.back).toHaveBeenCalled();
    expect(doc().experience).toBe('new');
  });
});

describe('safety', () => {
  it('a "no" to everything continues straight on without caution mode', async () => {
    await set(answeredUpTo('safety'));
    await set((d) => ({ ...d, safety: { answers: [null, null, null], acknowledged: false } }));
    await show(SafetyScreen);
    expect(screen.getByTestId('safety-question-1')).toHaveTextContent('[Safety question 1]');
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();
    for (const i of [1, 2, 3]) await press(`safety-${i}-no`);
    await press('onboarding-continue');
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/consent');
    expect(profile.getState().settings.safety).toEqual({
      answers: [false, false, false],
      cautionMode: false,
    });
  });

  it('a "yes" shows the calm information once and sets caution mode', async () => {
    await set(answeredUpTo('safety'));
    await set((d) => ({ ...d, safety: { answers: [null, null, null], acknowledged: false } }));
    await show(SafetyScreen);
    await press('safety-1-no');
    await press('safety-2-yes');
    await press('safety-3-no');
    await press('onboarding-continue');
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(screen.getByTestId('onboarding-safety-info')).toBeOnTheScreen();
    // "I understand" arrives under the finger: the rest of a double tap is swallowed.
    expect(screen.getByTestId('tap-shield')).toBeOnTheScreen();
    expect(screen.getByTestId('safety-info-body')).toHaveTextContent(/Safety information/);
    // Back returns to the questions with the answers kept.
    await press('onboarding-back');
    expect(screen.getByTestId('onboarding-safety')).toBeOnTheScreen();
    expect(doc().safety.answers).toEqual([false, true, false]);
    await press('onboarding-continue');
    await press('safety-acknowledge');
    expect(doc().safety.acknowledged).toBe(true);
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/consent');
    expect(profile.getState().settings.safety.cautionMode).toBe(true);
  });
});

describe('consent', () => {
  it('withdrawing consent forgets the mood values already recorded', async () => {
    await set(answeredUpTo('reminder'));
    await set((d) => ({
      ...d,
      step: 'consent',
      moodConsent: true,
      firstSession: { completed: true, moodBefore: 1, moodAfter: 5 },
    }));
    await show(ConsentScreen);
    await press('consent-decline');
    expect(doc().moodConsent).toBe(false);
    expect(doc().firstSession).toEqual({ completed: true, moodBefore: null, moodAfter: null });
    await flush();
    await flush();
    const stored = profileClient.documents.get('user-1:onboarding') as OnboardingDoc;
    expect(stored.firstSession.moodBefore).toBeNull();
    expect(stored.firstSession.moodAfter).toBeNull();
  });

  it('records the choice; declining is a valid answer', async () => {
    await set(answeredUpTo('consent'));
    await set((d) => ({ ...d, moodConsent: null }));
    await show(ConsentScreen);
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();
    await press('consent-decline');
    expect(doc().moodConsent).toBe(false);
    await press('consent-allow');
    expect(doc().moodConsent).toBe(true);
    await press('onboarding-continue');
    expect(profile.getState().settings.moodConsent).toBe(true);
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/hatch');
  });
});

describe('hatch', () => {
  it('hatches on the third tap, with feedback, then needs a name', async () => {
    await set(answeredUpTo('hatch'));
    await set((d) => ({ ...d, crocHatched: false, crocName: null }));
    await show(HatchScreen);
    expect(screen.getByTestId('hatch-hint')).toHaveTextContent('Tap the egg 3 times');
    expect(screen.queryByTestId('croc-name')).toBeNull();

    await press('hatch-egg');
    expect(screen.getByTestId('hatch-hint')).toHaveTextContent('2 more taps');
    // A bounce right after a tap is not a second tap.
    await press('hatch-egg');
    expect(screen.getByTestId('hatch-hint')).toHaveTextContent('2 more taps');
    await wait(TAP_GAP_MS + 30);
    await press('hatch-egg');
    expect(screen.getByTestId('hatch-hint')).toHaveTextContent('One more tap');
    await wait(TAP_GAP_MS + 30);
    await press('hatch-egg');
    expect(doc().crocHatched).toBe(true);
    expect(screen.getByTestId('hatch-hatchling')).toBeOnTheScreen();
    expect(haptics).toEqual(['tap', 'tap', 'success']);
    expect(sounds).toEqual(['tap', 'tap', 'hatch']);
    // Taps after the hatch do nothing.
    await press('hatch-egg');
    expect(haptics).toHaveLength(3);

    // The name form arrives once the hatchling has settled.
    await waitFor(() => expect(screen.getByTestId('croc-name')).toBeOnTheScreen(), {
      timeout: HATCH_DURATION_MS + 1500,
    });
    expect(screen.getByTestId('croc-name')).toHaveProp('value', 'Croc');
    await type('croc-name', '   ');
    await press('onboarding-continue');
    expect(screen.getByTestId('croc-name-error')).toHaveTextContent('Enter a name.');
    expect(mockRouter.push).not.toHaveBeenCalled();
    await type('croc-name', 'x'.repeat(21));
    await press('onboarding-continue');
    expect(screen.getByTestId('croc-name-error')).toHaveTextContent('Use at most 20 characters.');
    await type('croc-name', '  Zé 🐊  ');
    await press('onboarding-continue');
    expect(doc().crocName).toBe('Zé 🐊');
    expect(profile.getState().settings.crocName).toBe('Zé 🐊');
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/first-session');
  });

  it('revisited after hatching, the hatchling and the name are simply there', async () => {
    await set(answeredUpTo('firstSession'));
    await set((d) => ({ ...d, step: 'hatch' }));
    await show(HatchScreen);
    expect(screen.getByTestId('hatch-hatchling')).toBeOnTheScreen();
    expect(screen.getByTestId('croc-name')).toHaveProp('value', 'Zed');
    expect(screen.getByTestId('hatch-done')).toBeOnTheScreen();
  });
});

describe('first session', () => {
  it('counts as done the moment the track ends, and Back from the complete screen is possible', async () => {
    await set(answeredUpTo('firstSession'));
    await set((d) => ({ ...d, moodConsent: true }));
    await show(FirstSessionScreen);
    expect(screen.getByTestId('onboarding-first-session')).toBeOnTheScreen();
    await press('mood-before-2');
    await press('first-session-start');
    await waitFor(() => expect(screen.getByTestId('first-session-player')).toBeOnTheScreen(), {
      timeout: 3000,
    });
    // The pause button and the way out are both there.
    expect(screen.getByTestId('first-session-toggle')).toBeOnTheScreen();
    expect(screen.getByTestId('first-session-end')).toBeOnTheScreen();
    await press('first-session-dev-skip');
    await waitFor(() => expect(doc().firstSession.completed).toBe(true));
    expect(doc().firstSession.moodBefore).toBe(2);
    await waitFor(
      () => expect(screen.getByTestId('onboarding-first-session-after')).toBeOnTheScreen(),
      { timeout: 3000 },
    );
    // Once the croc has surfaced, Back leads to the intro, which offers Continue and Play again.
    await waitFor(() => expect(screen.queryByTestId('first-session-night')).toBeNull(), {
      timeout: 4000,
    });
    await press('onboarding-back');
    expect(screen.getByTestId('onboarding-first-session')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-continue')).toBeOnTheScreen();
    expect(screen.getByTestId('first-session-start')).toHaveTextContent('Play again');
    await press('onboarding-continue');
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/reminder');
  });

  it('can be ended early, after a calm confirmation, without counting as done', async () => {
    await set(answeredUpTo('firstSession'));
    await show(FirstSessionScreen);
    await press('first-session-start');
    await waitFor(() => expect(screen.getByTestId('first-session-player')).toBeOnTheScreen(), {
      timeout: 3000,
    });
    await press('first-session-toggle'); // paused: the exit still works
    await press('first-session-end');
    expect(screen.getByTestId('first-session-end-dialog')).toBeOnTheScreen();
    await press('first-session-end-cancel');
    expect(screen.queryByTestId('first-session-end-dialog')).toBeNull();
    await press('first-session-end');
    await press('first-session-end-confirm');
    await waitFor(() => expect(screen.getByTestId('onboarding-first-session')).toBeOnTheScreen(), {
      timeout: 3000,
    });
    expect(screen.getByTestId('onboarding-title')).toHaveTextContent('Session ended');
    expect(doc().firstSession.completed).toBe(false);
    expect(screen.queryByTestId('onboarding-continue')).toBeNull();
    expect(screen.getByTestId('first-session-start')).toHaveTextContent('Play again');
  });
});

describe('account menu', () => {
  it('signs out from onboarding after pushing pending answers', async () => {
    await show(GoalsScreen);
    await press('goal-sleep');
    await press('onboarding-menu');
    expect(screen.getByTestId('onboarding-menu-panel')).toHaveTextContent(/ann@example\.com/);
    await press('onboarding-sign-out');
    await waitFor(() => expect(auth.getState().status).toBe('signedOut'));
    expect(profileClient.documents.get('user-1:onboarding')).toMatchObject({ goals: ['sleep'] });
  });
});

describe('root gate', () => {
  function Gate({
    profileStatus,
    authStatus,
    error,
  }: {
    profileStatus: 'idle' | 'loading' | 'ready';
    authStatus: 'restoring' | 'signedOut' | 'signedIn';
    error?: unknown;
  }) {
    return (
      <RootGate
        fontsReady
        authStatus={authStatus}
        profileStatus={profileStatus}
        loadError={error ?? null}
        onRetry={() => undefined}
        onSignOut={() => undefined}
      >
        <Text testID="app">app</Text>
      </RootGate>
    );
  }

  it('shows nothing before the first ready moment, then a loading screen while the profile loads', async () => {
    const r = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <MotionProvider initialOverride>
          <AtmosphereProvider>
            <Gate authStatus="restoring" profileStatus="idle" />
          </AtmosphereProvider>
        </MotionProvider>
      </SafeAreaProvider>,
    );
    expect(screen.queryByTestId('app')).toBeNull();
    expect(screen.queryByTestId('profile-loading')).toBeNull();
    // Signed out and ready: the app.
    await r.rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <MotionProvider initialOverride>
          <AtmosphereProvider>
            <Gate authStatus="signedOut" profileStatus="idle" />
          </AtmosphereProvider>
        </MotionProvider>
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId('app')).toBeOnTheScreen();
    // Signed in, profile loading: never blank again, a loading screen with a way out on trouble.
    await r.rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <MotionProvider initialOverride>
          <AtmosphereProvider>
            <Gate
              authStatus="signedIn"
              profileStatus="loading"
              error={new AuthError('unreachable')}
            />
          </AtmosphereProvider>
        </MotionProvider>
      </SafeAreaProvider>,
    );
    expect(screen.queryByTestId('app')).toBeNull();
    expect(screen.getByTestId('profile-loading')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-loading-problem')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-loading-retry')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-loading-sign-out')).toBeOnTheScreen();
  });
});

describe('reminder', () => {
  // Jest runs as iOS, so the native reminders (expo-notifications, mocked) are in use here; the
  // web fallback is covered end to end against the web build.
  const notifications = jest.requireMock<{
    getPermissionsAsync: jest.Mock;
    requestPermissionsAsync: jest.Mock;
    scheduleNotificationAsync: jest.Mock;
  }>('expo-notifications');

  it('asks for permission and turns the reminder on at the time the timing step implied', async () => {
    await set(answeredUpTo('reminder'));
    await show(ReminderScreen);
    expect(screen.getByTestId('reminder-time')).toHaveTextContent('Every day at 20:30');
    expect(screen.queryByTestId('reminder-web')).toBeNull();
    await press('reminder-enable');
    await waitFor(() => expect(doc().reminder).toBe('enabled'));
    expect(notifications.getPermissionsAsync).toHaveBeenCalled();
    // Scheduling itself follows the settings (src/services/reminders/reminderSync).
    expect(profile.getState().settings.reminder).toEqual({
      enabled: true,
      time: '20:30',
      timeOfDay: 'evening',
    });
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/done');
  });

  it('explains a refused permission and lets the user carry on', async () => {
    notifications.getPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      status: 'denied',
      canAskAgain: false,
    });
    await set(answeredUpTo('reminder'));
    await show(ReminderScreen);
    await press('reminder-enable');
    await waitFor(() => expect(screen.getByTestId('reminder-denied')).toBeOnTheScreen());
    expect(doc().reminder).toBeNull();
    expect(screen.queryByTestId('reminder-enable')).toBeNull();
    await press('reminder-skip');
    expect(doc().reminder).toBe('skipped');
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/done');
  });

  it('"Not now" skips without scheduling anything', async () => {
    await set(answeredUpTo('reminder'));
    await show(ReminderScreen);
    await press('reminder-skip');
    expect(doc().reminder).toBe('skipped');
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(profile.getState().settings.reminder.enabled).toBe(false);
  });
});

describe('done', () => {
  it('celebrates, grants the first points and finishes onboarding', async () => {
    await set(answeredUpTo('reminder'));
    await set((d) => ({ ...d, reminder: 'skipped', step: 'done' }));
    await show(DoneScreen);
    expect(screen.getByTestId('done-points')).toHaveTextContent('+50 Points');
    expect(screen.getByTestId('done-croc')).toHaveTextContent('Zed is with you');
    // Decorative pieces are hidden from assistive tech, so they need the explicit flag.
    expect(
      screen.getByTestId('onboarding-done-scene-celebration', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    await press('onboarding-finish');
    await waitFor(() => expect(doc().completed).toBe(true));
    expect(doc()).toMatchObject({ step: 'done', rewardGranted: true });
    expect(doc().completedAt).toBeGreaterThan(0);
    await flush();
    await flush();
    // Synced to the server.
    expect(profileClient.documents.get('user-1:onboarding')).toMatchObject({ completed: true });
  });
});

describe('resume', () => {
  it('/onboarding goes to the saved step, or to the furthest allowed one', async () => {
    await set(answeredUpTo('consent'));
    await show(OnboardingIndex);
    expect(mockRedirect).toHaveBeenCalledWith('/onboarding/consent');
    mockRedirect.mockClear();
    // The saved step is behind the answers (Back was used): resume there.
    await set((d) => ({ ...d, step: 'experience' }));
    await show(OnboardingIndex);
    expect(mockRedirect).toHaveBeenCalledWith('/onboarding/experience');
    mockRedirect.mockClear();
    // Finished: home.
    await set((d) => ({ ...d, completed: true }));
    await show(OnboardingIndex);
    expect(mockRedirect).toHaveBeenCalledWith('/home');
  });

  it('home shows the named hatchling', async () => {
    await set(answeredUpTo('reminder'));
    await profile.getState().updateSettings((s) => ({ ...s, crocName: 'Zed' }));
    auth.getState().acknowledgeSignUp();
    await show(HomeScreen);
    expect(screen.getByLabelText('Zed, Stage 2')).toBeOnTheScreen();
  });
});
