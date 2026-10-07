import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '@/app/(app)/home';
import ProfileTab from '@/app/(app)/profile';
import PrivacyScreen from '@/app/settings/privacy';
import ForgotPasswordScreen from '@/app/(auth)/forgot-password';
import ResetPasswordScreen from '@/app/(auth)/reset-password';
import SignInScreen from '@/app/(auth)/sign-in';
import SignUpScreen from '@/app/(auth)/sign-up';
import WelcomeScreen from '@/app/(auth)/welcome';
import {
  AuthError,
  AuthProvider,
  createAuthStore,
  createSessionManager,
  createSessionStore,
  type AuthStore,
} from '@/services/auth';
import { MotionProvider } from '@/motion/MotionProvider';
import { ProfileProvider, createProfileStore, type ProfileStore } from '@/services/profile';
import { createFakeAuthClient, memoryStorage, type FakeAuthClient } from '@/test/fakeAuth';
import { createFakeProfileClient } from '@/test/fakeProfile';
import { AtmosphereProvider } from '@/theme';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    dismissTo: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: () => mockParams,
  useIsFocused: () => true,
}));
const mockRouter = jest.requireMock<{ router: Record<string, jest.Mock> }>('expo-router').router;

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let client: FakeAuthClient;
let store: AuthStore;
let profile: ProfileStore;

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  client = createFakeAuthClient();
  const session = createSessionManager({ client, store: createSessionStore(memoryStorage()) });
  store = createAuthStore({ client, session });
  profile = createProfileStore({
    client: createFakeProfileClient(),
    session,
    storage: memoryStorage(),
    debounceMs: 0,
  });
  await store.getState().bootstrap();
});

async function show(Screen: React.ComponentType) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AuthProvider store={store}>
        <ProfileProvider store={profile}>
          {/* Reduced motion: the scene's endless loops would never settle under Jest. */}
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

describe('sign in', () => {
  beforeEach(async () => {
    await client.signUp({
      email: 'coach@example.com',
      password: 'river walk',
      displayName: 'Coach',
    });
  });

  it('validates before calling the server', async () => {
    await show(SignInScreen);
    await press('sign-in-submit');
    expect(screen.getByTestId('sign-in-email-error')).toHaveTextContent(
      'Enter your email address.',
    );
    expect(screen.getByTestId('sign-in-password-error')).toHaveTextContent('Enter your password.');
    expect(client.calls.signIn).toBe(0);
    // Editing a field clears its message.
    await type('sign-in-email', 'coach@');
    expect(screen.queryByTestId('sign-in-email-error')).toBeNull();
  });

  it('shows one message for a wrong password', async () => {
    await show(SignInScreen);
    await type('sign-in-email', 'coach@example.com');
    await type('sign-in-password', 'not it');
    await press('sign-in-submit');
    await waitFor(() =>
      expect(screen.getByTestId('sign-in-error-message')).toHaveTextContent(
        'Email or password is incorrect.',
      ),
    );
    expect(screen.queryByTestId('sign-in-retry')).toBeNull();
    expect(store.getState().status).toBe('signedOut');
  });

  it('offers a retry when offline, and the retry signs in', async () => {
    await show(SignInScreen);
    await type('sign-in-email', 'coach@example.com');
    await type('sign-in-password', 'river walk');
    client.failNext(new AuthError('offline'));
    await press('sign-in-submit');
    await waitFor(() => expect(screen.getByTestId('sign-in-retry')).toBeOnTheScreen());
    expect(screen.getByTestId('sign-in-error-message')).toHaveTextContent(/^You are offline\./);
    await press('sign-in-retry');
    await waitFor(() => expect(store.getState().status).toBe('signedIn'));
    expect(store.getState().user?.displayName).toBe('Coach');
  });

  it('explains when the server is down', async () => {
    await show(SignInScreen);
    await type('sign-in-email', 'coach@example.com');
    await type('sign-in-password', 'river walk');
    client.failNext(new AuthError('unreachable'));
    await press('sign-in-submit');
    await waitFor(() =>
      expect(screen.getByTestId('sign-in-error-message')).toHaveTextContent(
        /^The server cannot be reached/,
      ),
    );
  });

  it('prefills the email from the route', async () => {
    mockParams = { email: 'coach@example.com' };
    await show(SignInScreen);
    expect(screen.getByTestId('sign-in-email').props.value).toBe('coach@example.com');
    await press('sign-in-forgot');
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/forgot-password',
      params: { email: 'coach@example.com' },
    });
  });

  it('the croc closes its eyes while the hidden password has focus', async () => {
    await show(SignInScreen);
    const croc = () => screen.getByLabelText(/Croc, Stage 3/);
    await fireEvent(screen.getByTestId('sign-in-password'), 'focus');
    // The scene re-renders the croc with the new expression; it stays the same labelled image.
    expect(croc()).toBeOnTheScreen();
  });
});

describe('sign up', () => {
  it('creates the account and marks it for the celebration', async () => {
    await show(SignUpScreen);
    await type('sign-up-name', ' Ann ');
    await type('sign-up-email', 'Ann@Example.com');
    await type('sign-up-password', 'secret12');
    await press('sign-up-submit');
    await waitFor(() => expect(store.getState().status).toBe('signedIn'));
    expect(store.getState()).toMatchObject({ justSignedUp: true });
    expect(store.getState().user).toMatchObject({ email: 'ann@example.com', displayName: 'Ann' });
  });

  it('rejects a short password before calling the server', async () => {
    await show(SignUpScreen);
    await type('sign-up-email', 'ann@example.com');
    await type('sign-up-password', 'short');
    await press('sign-up-submit');
    expect(screen.getByTestId('sign-up-password-error')).toHaveTextContent(
      'Use at least 8 characters.',
    );
    expect(client.calls.signUp).toBe(0);
  });

  it('a taken email offers to sign in instead', async () => {
    await client.signUp({ email: 'ann@example.com', password: 'secret12' });
    await show(SignUpScreen);
    await type('sign-up-email', 'ann@example.com');
    await type('sign-up-password', 'secret12');
    await press('sign-up-submit');
    await waitFor(() =>
      expect(screen.getByTestId('sign-up-email-error')).toHaveTextContent(
        'An account with this email already exists.',
      ),
    );
    // Leaving the field (as a tap on the button does) keeps the server's message and the button.
    await fireEvent(screen.getByTestId('sign-up-email'), 'blur');
    await press('sign-up-sign-in-instead');
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/sign-in',
      params: { email: 'ann@example.com' },
    });
  });
});

describe('forgot password', () => {
  it('confirms without saying whether the account exists', async () => {
    await show(ForgotPasswordScreen);
    await type('forgot-email', 'nobody@example.com');
    await press('forgot-submit');
    await waitFor(() =>
      expect(screen.getByTestId('forgot-sent-message')).toHaveTextContent(
        /^If an MHP account exists for nobody@example\.com/,
      ),
    );
    await press('forgot-back-to-sign-in');
    expect(mockRouter.dismissTo).toHaveBeenCalledWith({
      pathname: '/sign-in',
      params: { email: 'nobody@example.com' },
    });
  });

  it('shows connection problems with a retry', async () => {
    await show(ForgotPasswordScreen);
    await type('forgot-email', 'a@example.com');
    client.failNext(new AuthError('server_error', { status: 500 }));
    await press('forgot-submit');
    await waitFor(() => expect(screen.getByTestId('forgot-retry')).toBeOnTheScreen());
    await press('forgot-retry');
    await waitFor(() => expect(screen.getByTestId('forgot-sent')).toBeOnTheScreen());
  });
});

describe('welcome', () => {
  it('leads to sign in and sign up, and shows a pending notice once', async () => {
    store.setState({ notice: 'accountDeleted' });
    await show(WelcomeScreen);
    expect(screen.getByTestId('welcome-notice-message')).toHaveTextContent(
      'Your account was deleted.',
    );
    await press('welcome-sign-in');
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
    expect(store.getState().notice).toBeNull();
    await press('welcome-sign-up');
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-up');
  });
});

describe('reset password', () => {
  beforeEach(async () => {
    await client.signUp({ email: 'ann@example.com', password: 'secret12' });
  });

  it('sets a new password from the link and returns to welcome with a notice', async () => {
    mockParams = { token: client.issueResetToken('ann@example.com') };
    await show(ResetPasswordScreen);
    await type('reset-password', 'short');
    await press('reset-submit');
    expect(screen.getByTestId('reset-password-error')).toHaveTextContent(
      'Use at least 8 characters.',
    );
    await type('reset-password', 'brand new 1');
    await press('reset-submit');
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/welcome'));
    expect(store.getState().notice).toBe('passwordChanged');
    await expect(
      client.signIn({ email: 'ann@example.com', password: 'brand new 1' }),
    ).resolves.toBeTruthy();
  });

  it('an unknown or used link offers a new one', async () => {
    mockParams = { token: 'nope' };
    await show(ResetPasswordScreen);
    await type('reset-password', 'brand new 1');
    await press('reset-submit');
    await waitFor(() => expect(screen.getByTestId('reset-invalid')).toBeOnTheScreen());
    await press('reset-request-new');
    expect(mockRouter.replace).toHaveBeenCalledWith('/forgot-password');
  });

  it('a mangled, over-long token is an invalid link, not a generic error', async () => {
    mockParams = { token: 'x'.repeat(5000) };
    await show(ResetPasswordScreen);
    expect(screen.getByTestId('reset-invalid')).toBeOnTheScreen();
  });

  it('a token the server rejects as malformed is an invalid link too', async () => {
    mockParams = { token: 'abc' };
    client.failNext(
      new AuthError('invalid_request', { status: 400, fields: { token: 'invalid_request' } }),
    );
    await show(ResetPasswordScreen);
    await type('reset-password', 'brand new 1');
    await press('reset-submit');
    await waitFor(() => expect(screen.getByTestId('reset-invalid')).toBeOnTheScreen());
    expect(screen.queryByTestId('reset-retry')).toBeNull();
  });

  it('signed in, an invalid link explains how to get a new one and offers the way home', async () => {
    await store.getState().signIn({ email: 'ann@example.com', password: 'secret12' });
    mockParams = {};
    await show(ResetPasswordScreen);
    expect(screen.getByTestId('reset-signed-in-note')).toBeOnTheScreen();
    expect(screen.queryByTestId('reset-request-new')).toBeNull();
    await press('reset-go-home');
    expect(mockRouter.replace).toHaveBeenCalledWith('/home');
  });

  it('a link without a token says so straight away', async () => {
    await show(ResetPasswordScreen);
    expect(screen.getByTestId('reset-invalid')).toBeOnTheScreen();
  });
});

describe('pending requests', () => {
  it('links and Back are disabled while a sign-in runs, and a fast failure still shows the spinner', async () => {
    const slow = createFakeAuthClient({ delayMs: 50 });
    store = createAuthStore({
      client: slow,
      session: createSessionManager({ client: slow, store: createSessionStore(memoryStorage()) }),
    });
    await store.getState().bootstrap();
    await show(SignInScreen);
    await type('sign-in-email', 'a@example.com');
    await type('sign-in-password', 'whatever1');
    slow.failNext(new AuthError('offline'));
    const started = Date.now();
    void fireEvent.press(screen.getByTestId('sign-in-submit'));
    await waitFor(() => expect(screen.getByTestId('sign-in-forgot')).toBeDisabled());
    expect(screen.getByTestId('sign-in-to-sign-up')).toBeDisabled();
    expect(screen.getByTestId('auth-back')).toBeDisabled();
    await waitFor(() => expect(screen.getByTestId('sign-in-error')).toBeOnTheScreen());
    expect(Date.now() - started).toBeGreaterThanOrEqual(450);
    expect(screen.getByTestId('sign-in-forgot')).toBeEnabled();
  });
});

describe('home', () => {
  beforeEach(async () => {
    await store
      .getState()
      .signUp({ email: 'ann@example.com', password: 'secret12', displayName: 'Ann' });
  });

  it('greets by name; the profile tab shows the account and signs out', async () => {
    await show(HomeScreen);
    expect(screen.getByTestId('home-greeting')).toHaveTextContent('Hi, Ann');
    expect(screen.getByTestId('today-title')).toHaveTextContent('Intro · Stop 1');
    await screen.unmount();
    await show(ProfileTab);
    expect(screen.getByTestId('profile-email')).toHaveTextContent(/ann@example.com/);
    await press('profile-sign-out');
    await waitFor(() => expect(store.getState().status).toBe('signedOut'));
  });

  it('falls back to the email name when there is no display name', async () => {
    store.setState({ user: { ...store.getState().user!, displayName: null } });
    client.accounts.get('ann@example.com')!.user.displayName = null;
    await show(HomeScreen);
    expect(screen.getByTestId('home-greeting')).toHaveTextContent('Hi, ann');
  });

  it('deletes the account only after the in-page confirmation and the password', async () => {
    await show(PrivacyScreen);
    await press('profile-delete-account');
    expect(client.calls.deleteAccount).toBe(0);
    await press('delete-cancel');
    expect(screen.queryByTestId('delete-confirm')).toBeNull();
    await press('profile-delete-account');
    // No password: nothing is sent.
    await press('delete-confirm-button');
    expect(screen.getByTestId('delete-password-error')).toHaveTextContent('Enter your password.');
    expect(client.calls.deleteAccount).toBe(0);
    await type('delete-password', 'secret12');
    await press('delete-confirm-button');
    await waitFor(() =>
      expect(store.getState()).toMatchObject({ status: 'signedOut', notice: 'accountDeleted' }),
    );
    expect(client.accounts.size).toBe(0);
  });

  it('a wrong password deletes nothing and says so', async () => {
    await show(PrivacyScreen);
    await press('profile-delete-account');
    await type('delete-password', 'not-it-at-all');
    await press('delete-confirm-button');
    await waitFor(() =>
      expect(screen.getByTestId('delete-error-message')).toHaveTextContent(
        /^That password is not correct\./,
      ),
    );
    expect(store.getState().status).toBe('signedIn');
    expect(client.accounts.size).toBe(1);
  });

  it('a failed deletion explains why and keeps you signed in', async () => {
    await show(PrivacyScreen);
    await press('profile-delete-account');
    await type('delete-password', 'secret12');
    client.failNext(new AuthError('offline'));
    await press('delete-confirm-button');
    await waitFor(() =>
      expect(screen.getByTestId('delete-error-message')).toHaveTextContent(/^You are offline\./),
    );
    expect(store.getState().status).toBe('signedIn');
  });

  it('closes the confirmation (and forgets the password) when the user changes', async () => {
    await show(PrivacyScreen);
    await press('profile-delete-account');
    await type('delete-password', 'secret12');
    expect(screen.getByTestId('delete-confirm')).toBeOnTheScreen();
    // Another tab signed in as someone else.
    await act(async () => {
      store.setState({ user: { ...store.getState().user!, id: 'someone-else' } });
    });
    expect(screen.queryByTestId('delete-confirm')).toBeNull();
    await press('profile-delete-account');
    expect(screen.getByTestId('delete-password').props.value).toBe('');
  });
});
