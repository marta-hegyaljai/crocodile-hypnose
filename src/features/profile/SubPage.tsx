import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/copy';
import { space } from '@/theme';
import { IconButton, Screen, Text } from '@/ui';

/** A page below the Profile tab: a back button, a title and its sections. */
export function SubPage({
  title,
  testID,
  children,
}: {
  title: string;
  testID: string;
  children: React.ReactNode;
}) {
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };
  return (
    <Screen testID={testID} contentStyle={styles.screen}>
      <View style={styles.column}>
        <View style={styles.top}>
          <IconButton
            icon="back"
            variant="filled"
            accessibilityLabel={t('a11y.back')}
            onPress={goBack}
            testID="subpage-back"
          />
        </View>
        <Text variant="title" heading={1}>
          {title}
        </Text>
        {children}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: space.xxxl },
  column: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.lg },
  top: { paddingTop: space.sm, alignItems: 'flex-start' },
});
