import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { t, type CopyKey } from '@/copy';
import { SharedAccountNote } from '@/features/auth/SharedAccountNote';
import { LagoonSheetScreen } from '@/features/layout/LagoonSheetScreen';
import { useAuth, type AuthNotice } from '@/services/auth';
import { space } from '@/theme';
import { Button, IconButton, Notice, Text } from '@/ui';

const NOTICE_COPY: Record<AuthNotice, CopyKey> = {
  sessionEnded: 'auth.notices.sessionEnded',
  actionInterrupted: 'auth.notices.actionInterrupted',
  accountDeleted: 'auth.notices.accountDeleted',
  passwordChanged: 'auth.notices.passwordChanged',
};

/** Welcome: the croc greets you from the river; sign in or create the shared MHP account. */
export default function WelcomeScreen() {
  const notice = useAuth((s) => s.notice);
  const dismissNotice = useAuth((s) => s.dismissNotice);
  const go = (href: '/sign-in' | '/sign-up') => {
    if (notice) dismissNotice();
    router.push(href);
  };

  return (
    <LagoonSheetScreen
      testID="welcome-screen"
      expression="happy"
      header={
        <View style={styles.back}>
          <IconButton
            icon="back"
            variant="filled"
            accessibilityLabel={t('a11y.back')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            testID="welcome-back"
          />
        </View>
      }
      sheet={
        <View style={styles.sheet}>
          <View style={styles.title}>
            <Text variant="label" tone="water">
              {t('app.name')}
            </Text>
            <Text variant="title" heading testID="welcome-title">
              {t('auth.welcome.title')}
            </Text>
          </View>
          {notice ? (
            <Notice tone="info" message={t(NOTICE_COPY[notice])} testID="welcome-notice" />
          ) : null}
          <SharedAccountNote testID="welcome-shared-note" />
          <View style={styles.buttons}>
            <Button
              label={t('auth.welcome.signIn')}
              size="lg"
              fullWidth
              onPress={() => go('/sign-in')}
              testID="welcome-sign-in"
            />
            <Button
              label={t('auth.welcome.createAccount')}
              variant="secondary"
              size="lg"
              fullWidth
              onPress={() => go('/sign-up')}
              testID="welcome-sign-up"
            />
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  back: { alignItems: 'flex-start' },
  sheet: { gap: space.lg },
  title: { gap: space.xxs },
  buttons: { gap: space.md },
});
