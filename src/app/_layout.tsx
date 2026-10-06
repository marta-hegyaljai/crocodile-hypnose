import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { RootGate } from '@/features/layout/RootGate';
import { TapShieldProvider, useTapShield } from '@/features/layout/TapShield';
import { MotionProvider } from '@/motion/MotionProvider';
import { AuthProvider, useAuth } from '@/services/auth';
import { appAuthStore } from '@/services/auth/instance';
import { FeedbackProvider } from '@/services/feedback';
import { appFeedback } from '@/services/feedback/instance';
import { ProfileProvider, useProfile } from '@/services/profile';
import { appProfileStore } from '@/services/profile/instance';
import '@/services/reminders/instance';
import { AtmosphereProvider, daylightTheme, useAppFonts } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Web: the generated HTML shell is white; paint River Mist as soon as the bundle runs (before fonts load)
// and declare the theme colour for the browser chrome.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const bg = daylightTheme.colors.background;
  document.documentElement.style.backgroundColor = bg;
  document.body.style.backgroundColor = bg;
  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = bg;
    document.head.appendChild(meta);
  }
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport && !viewport.getAttribute('content')?.includes('viewport-fit')) {
    viewport.setAttribute('content', `${viewport.getAttribute('content')}, viewport-fit=cover`);
  }
}

// Reads the stored session from the device (no network) as early as possible.
void appAuthStore.getState().bootstrap();

export default function RootLayout() {
  return (
    <AuthProvider store={appAuthStore}>
      <ProfileProvider store={appProfileStore}>
        <FeedbackProvider feedback={appFeedback}>
          <RootNavigator />
        </FeedbackProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  return (
    <TapShieldProvider>
      <GuardedStack />
    </TapShieldProvider>
  );
}

function GuardedStack() {
  const [fontsLoaded, fontError] = useAppFonts();
  const status = useAuth((s) => s.status);
  const signOut = useAuth((s) => s.signOut);
  const profileStatus = useProfile((s) => s.status);
  const loadError = useProfile((s) => s.loadError);
  const flushProfile = useProfile((s) => s.flush);
  const onboardingDone = useProfile((s) => s.onboarding.completed);
  const shield = useTapShield();
  const previousStatus = useRef(status);

  // Signing in or out swaps the whole screen under the finger: swallow the rest of a double tap.
  useEffect(() => {
    if (previousStatus.current !== 'restoring' && previousStatus.current !== status) shield();
    previousStatus.current = status;
  }, [status, shield]);

  const signedIn = status === 'signedIn';
  const fontsReady = fontsLoaded || fontError !== null;
  const ready = fontsReady && status !== 'restoring' && (!signedIn || profileStatus === 'ready');

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  return (
    <MotionProvider>
      <AtmosphereProvider>
        {/* Keep the splash (native) / a blank page (web) until the fonts are in and we know whether
            someone is signed in; afterwards a loading screen bridges a profile load. */}
        <RootGate
          fontsReady={fontsReady}
          authStatus={status}
          profileStatus={profileStatus}
          loadError={loadError}
          onRetry={() => void flushProfile()}
          onSignOut={() => void signOut()}
        >
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: daylightTheme.colors.background },
            }}
          >
            {/* Route guards: signed-in users with finished onboarding reach the app... */}
            <Stack.Protected guard={signedIn && onboardingDone}>
              <Stack.Screen name="(app)/home" />
            </Stack.Protected>
            {/* ...the others walk through onboarding first (resumable at any step). */}
            <Stack.Protected guard={signedIn && !onboardingDone}>
              <Stack.Screen name="onboarding/index" />
              <Stack.Screen name="onboarding/goals" />
              <Stack.Screen name="onboarding/experience" />
              <Stack.Screen name="onboarding/safety" />
              <Stack.Screen name="onboarding/consent" />
              <Stack.Screen name="onboarding/hatch" />
              <Stack.Screen name="onboarding/first-session" />
              <Stack.Screen name="onboarding/reminder" />
              <Stack.Screen name="onboarding/done" />
            </Stack.Protected>
            {/* Welcome first: it is where you land after signing out or when a session ends. */}
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="(auth)/welcome" />
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)/sign-in" />
              <Stack.Screen name="(auth)/sign-up" />
              <Stack.Screen name="(auth)/forgot-password" />
            </Stack.Protected>
            {/* The emailed reset link works whether or not someone is signed in on this device. */}
            <Stack.Screen name="(auth)/reset-password" />
            <Stack.Screen name="dev/gallery" />
            <Stack.Screen name="+not-found" />
          </Stack>
        </RootGate>
      </AtmosphereProvider>
    </MotionProvider>
  );
}
