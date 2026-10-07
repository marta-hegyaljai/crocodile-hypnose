import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/copy';
import { useSubmit } from '@/features/auth/useSubmit';
import { InactiveGuard } from '@/features/layout/InactiveGuard';
import { useTapShield } from '@/features/layout/TapShield';
import { ProfileHeader, ProfileSummaryCard, RenameCroc } from '@/features/profile/ProfileHeader';
import { SettingsGate } from '@/features/profile/SettingsGate';
import { PreferenceSettings, ReminderSettings } from '@/features/profile/SettingsSections';
import { useAuth } from '@/services/auth';
import { isAuthError } from '@/services/auth/types';
import { useProfile } from '@/services/profile';
import { space, useTheme } from '@/theme';
import { Button, Card, Icon, Screen, Text } from '@/ui';

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
  const { colors } = useTheme();

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
    <InactiveGuard>
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
            <Text variant="subheading" heading={2} style={styles.linksTitle}>
              {t('profile.moreTitle')}
            </Text>
            {(
              [
                ['help', '/settings/help', 'profile.helpLink', 'profile.helpLinkDetail'],
                [
                  'privacy',
                  '/settings/privacy',
                  'profile.privacyLink',
                  'profile.privacyLinkDetail',
                ],
              ] as const
            ).map(([id, href, label, detail]) => (
              <Card
                key={id}
                tone="raised"
                padding="md"
                onPress={() => open(href)}
                accessibilityLabel={`${t(label)}, ${t(detail)}`}
                testID={`profile-${id}-link`}
              >
                <View style={styles.linkRow}>
                  <View style={styles.linkText}>
                    <Text variant="bodyStrong">{t(label)}</Text>
                    <Text variant="caption" tone="secondary">
                      {t(detail)}
                    </Text>
                  </View>
                  {/* A chevron: the card opens a page (the back icon, mirrored). */}
                  <View style={styles.chevron}>
                    <Icon name="back" size={20} color={colors.textSecondary} />
                  </View>
                </View>
              </Card>
            ))}
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
    </InactiveGuard>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: space.lg, paddingBottom: space.xxxl },
  column: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.lg },
  links: { gap: space.sm },
  linksTitle: { paddingHorizontal: space.xs },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  linkText: { flex: 1, gap: space.xxs },
  chevron: { transform: [{ scaleX: -1 }] },
});
