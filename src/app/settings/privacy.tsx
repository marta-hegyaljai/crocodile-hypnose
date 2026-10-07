import React from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/copy';
import { DeleteAccount } from '@/features/profile/DeleteAccount';
import { ExportData } from '@/features/profile/ExportData';
import { SubPage } from '@/features/profile/SubPage';
import { useAuth } from '@/services/auth';
import { space } from '@/theme';
import { Card, Text } from '@/ui';

/** Privacy: what is stored and why (placeholder), export my data, delete account. */
export default function PrivacyScreen() {
  const userId = useAuth((s) => s.user?.id ?? null);
  return (
    <SubPage title={t('privacy.title')} testID="privacy-screen">
      <Card tone="surface" padding="lg">
        <View style={styles.stack}>
          <Text variant="subheading" heading>
            {t('privacy.storedTitle')}
          </Text>
          <Text variant="body" tone="secondary" testID="privacy-stored">
            {t('privacy.storedBody')}
          </Text>
        </View>
      </Card>
      <View style={styles.stack}>
        <Text variant="subheading" heading>
          {t('privacy.exportTitle')}
        </Text>
        <ExportData />
      </View>
      <View style={styles.stack}>
        <Text variant="subheading" heading>
          {t('privacy.deleteTitle')}
        </Text>
        {/* Keyed on the account: a confirmation (and a typed password) never carries over to another user. */}
        <DeleteAccount key={userId ?? 'none'} />
      </View>
    </SubPage>
  );
}

const styles = StyleSheet.create({ stack: { gap: space.sm } });
