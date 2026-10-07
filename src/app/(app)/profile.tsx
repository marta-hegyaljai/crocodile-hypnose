import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/copy';
import { useSubmit } from '@/features/auth/useSubmit';
import { useTapShield } from '@/features/layout/TapShield';
import { ProfileHeader, ProfileSummaryCard, RenameCroc } from '@/features/profile/ProfileHeader';
import { SettingsGate } from '@/features/profile/SettingsGate';
import { PreferenceSettings, ReminderSettings } from '@/features/profile/SettingsSections';
import { useAuth } from '@/services/auth';
import { isAuthError } from '@/services/auth/types';
import { useProfile } from '@/services/profile';
import { space } from '@/theme';
import { Button, Card, Screen, Text } from '@/ui';

/**
 * Profile and settings (Daylight): the croc and its name, a summary, every setting (each takes
 * effect at once and syncs), links to safety, help and privacy, and sign out.
 */
export default function ProfileTab() {
  const signOut = useAuth((s) => s.signOut);
  const flushProfile = useProfile((s) => s.flush);
  const pendingOffline = useProfile(
    (s) => s.dirty && isAuthError(s.syncError) && s.syncError.isConnectivity,
  );
  const shield = useTapShield();

  const signingOut = useSubmit(async () => {
    // Pending app data (progress included) goes to the server first, while the token is valid.
    await flushProfile();
    await signOut();
  });

  const open = (href: '/settings/help' | '/settings/privacy') => {
    // The page opens where the finger is: swallow the rest of a double tap.
    shield();
    router.push(href);
  };

  return (
    <Screen testID="profile-screen" contentStyle={styles.screen}>
      <View style={styles.column}>
        <ProfileHeader />
        {pendingOffline ? (
          <Text variant="caption" tone="secondary" testID="profile-sync-pending">
            {t('profile.syncPending')}
          </Text>
        ) : null}
        <ProfileSummaryCard />
        <SettingsGate>
          <RenameCroc />
          <ReminderSettings />
          <PreferenceSettings />
        </SettingsGate>
        <View style={styles.links}>
          <Text variant="subheading" heading>
            {t('profile.moreTitle')}
          </Text>
          <Card
            tone="raised"
            padding="md"
            onPress={() => open('/settings/help')}
            accessibilityLabel={`${t('profile.helpLink')}, ${t('profile.helpLinkDetail')}`}
            testID="profile-help-link"
          >
            <Text variant="bodyStrong">{t('profile.helpLink')}</Text>
            <Text variant="caption" tone="secondary">
              {t('profile.helpLinkDetail')}
            </Text>
          </Card>
          <Card
            tone="raised"
            padding="md"
            onPress={() => open('/settings/privacy')}
            accessibilityLabel={`${t('profile.privacyLink')}, ${t('profile.privacyLinkDetail')}`}
            testID="profile-privacy-link"
          >
            <Text variant="bodyStrong">{t('profile.privacyLink')}</Text>
            <Text variant="caption" tone="secondary">
              {t('profile.privacyLinkDetail')}
            </Text>
          </Card>
        </View>
        <Button
          label={t('home.signOut')}
          variant="secondary"
          size="lg"
          fullWidth
          loading={signingOut.pending}
          onPress={() => void signingOut.run()}
          testID="profile-sign-out"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: space.lg, paddingBottom: space.xxxl },
  column: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.lg },
  links: { gap: space.sm },
});
