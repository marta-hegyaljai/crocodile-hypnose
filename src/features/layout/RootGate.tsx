import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import { describeAuthError } from '@/features/auth/describeError';
import { Lagoon } from '@/illustration';
import type { AuthStatus } from '@/services/auth';
import type { ProfileStatus } from '@/services/profile';
import { space } from '@/theme';
import { Button, Notice, Screen, Text } from '@/ui';

export interface RootGateProps {
  fontsReady: boolean;
  authStatus: AuthStatus;
  profileStatus: ProfileStatus;
  /** The profile could not be loaded yet (the device has no copy and the server is unreachable). */
  loadError: unknown;
  onRetry: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

/**
 * Decides what the app shows before the navigator can: nothing at all until the first ready
 * moment (the splash is still up, on web the page is blank for a moment), and afterwards, while
 * a signed-in user's profile loads (after an interactive sign-in on a device that has nothing
 * stored), a loading screen with the croc instead of an empty one.
 */
export function RootGate({
  fontsReady,
  authStatus,
  profileStatus,
  loadError,
  onRetry,
  onSignOut,
  children,
}: RootGateProps) {
  const signedIn = authStatus === 'signedIn';
  const ready =
    fontsReady && authStatus !== 'restoring' && (!signedIn || profileStatus === 'ready');
  // Remembers the first ready moment (adjusting state while rendering, as React recommends).
  const [wasReady, setWasReady] = useState(ready);
  if (ready && !wasReady) setWasReady(true);

  if (ready) return <>{children}</>;
  if (!wasReady || !fontsReady) return null;
  return <ProfileLoadingScreen error={loadError} onRetry={onRetry} onSignOut={onSignOut} />;
}

/** The river with the croc waiting while the account's data arrives; a way out if it does not. */
export function ProfileLoadingScreen({
  error,
  onRetry,
  onSignOut,
}: {
  error: unknown;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const landscape = width > height;
  const described = error ? describeAuthError(error) : null;

  return (
    <Screen
      scroll={false}
      padded={false}
      edges={[]}
      testID="profile-loading"
      background={
        <Lagoon
          width={width}
          height={height}
          stage="hatchling"
          expression="sleepy"
          waterTop={landscape ? 0.5 : 0.52}
          crocX={0.5}
          crocWidth={Math.min(Math.round(width * 0.6), 360)}
          farReeds={!landscape}
        />
      }
    >
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl },
        ]}
        accessibilityLiveRegion="polite"
      >
        <Text variant="heading" heading align="center" testID="profile-loading-title">
          {t('onboarding.loading')}
        </Text>
        <View style={styles.flex} />
        {described ? (
          <View style={styles.problem}>
            <Notice
              tone="info"
              message={`${t('onboarding.loadingProblem')} ${t(described.key, described.params)}`}
              testID="profile-loading-problem"
            />
            <Button
              label={t('common.retry')}
              size="lg"
              fullWidth
              onPress={onRetry}
              testID="profile-loading-retry"
            />
            <Button
              label={t('home.signOut')}
              variant="ghost"
              fullWidth
              onPress={onSignOut}
              testID="profile-loading-sign-out"
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: space.xl, alignItems: 'center' },
  problem: { width: '100%', maxWidth: 440, gap: space.md },
});
