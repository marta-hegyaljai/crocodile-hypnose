import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { t } from '@/copy';
import { Croc } from '@/illustration';
import { space } from '@/theme';
import { Button, Screen, Text } from '@/ui';

export default function NotFoundScreen() {
  const { width } = useWindowDimensions();
  return (
    <Screen scroll={false} testID="not-found-screen">
      <View style={styles.center}>
        <Croc
          stage="hatchling"
          expression="sleepy"
          width={Math.min(width - space.xl * 2, 360)}
          relativeSize={false}
        />
        <Text variant="title" align="center" heading>
          {t('notFound.title')}
        </Text>
        <Button
          label={t('notFound.home')}
          variant="secondary"
          onPress={() => router.replace('/')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl },
});
