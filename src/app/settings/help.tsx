import React from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/copy';
import { SafetyRetake } from '@/features/profile/SafetyRetake';
import { SettingsGate } from '@/features/profile/SettingsGate';
import { SubPage } from '@/features/profile/SubPage';
import { space } from '@/theme';
import { Card, Notice, Text } from '@/ui';

/** Safety and help: safety information, crisis contacts (placeholders for MHP), the safety check. */
export default function HelpScreen() {
  return (
    <SubPage title={t('help.title')} testID="help-screen">
      <Card tone="raised" padding="lg">
        <View style={styles.stack}>
          <Text variant="subheading" heading={2}>
            {t('help.infoTitle')}
          </Text>
          <Text variant="body" testID="help-info">
            {t('onboarding.safety.infoBody')}
          </Text>
        </View>
      </Card>
      <Card tone="surface" padding="lg" testID="help-contacts">
        <View style={styles.stack}>
          <Text variant="subheading" heading={2}>
            {t('help.contactsTitle')}
          </Text>
          <Text variant="body" tone="secondary">
            {t('help.contactsIntro')}
          </Text>
          <View
            accessible
            accessibilityLabel={`${t('help.contact1Name')}, ${t('help.contact1Number')}`}
          >
            <Text variant="bodyStrong">{t('help.contact1Name')}</Text>
            <Text variant="body">{t('help.contact1Number')}</Text>
          </View>
          <View
            accessible
            accessibilityLabel={`${t('help.contact2Name')}, ${t('help.contact2Number')}`}
          >
            <Text variant="bodyStrong">{t('help.contact2Name')}</Text>
            <Text variant="body">{t('help.contact2Number')}</Text>
          </View>
        </View>
      </Card>
      <Notice tone="info" message={t('help.therapyNote')} testID="help-therapy-note" />
      <SettingsGate>
        <SafetyRetake />
      </SettingsGate>
    </SubPage>
  );
}

const styles = StyleSheet.create({ stack: { gap: space.sm } });
