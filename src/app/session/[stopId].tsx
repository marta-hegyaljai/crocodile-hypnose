import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { devMode } from '@/config/env';
import { t } from '@/copy';
import { useJourney } from '@/features/home/useJourney';
import { durationLabel, typeLabel } from '@/features/map/stopLabels';
import { useProfile } from '@/services/profile';
import { markDone, markStarted } from '@/services/progress/mergeProgress';
import { space } from '@/theme';
import { Button, Screen, Text } from '@/ui';

const back = () => (router.canGoBack() ? router.back() : router.replace('/home'));

/**
 * Placeholder for the session player (step 5), in Night River. Opening a playable stop marks it
 * started; dev builds can finish it here, which is how e2e and QA move along the river.
 */
export default function SessionPlaceholder() {
  const insets = useSafeAreaInsets();
  const { stopId } = useLocalSearchParams<{ stopId: string }>();
  const { journey } = useJourney();
  const updateProgress = useProfile((s) => s.updateProgress);
  const view = stopId ? journey.byStopId.get(stopId) : undefined;
  const playable =
    !!view &&
    (view.status === 'available' || view.status === 'inProgress' || view.status === 'done');

  useEffect(() => {
    if (playable && stopId) void updateProgress((doc) => markStarted(doc, stopId, Date.now()));
  }, [playable, stopId, updateProgress]);

  const complete = async () => {
    if (!stopId) return;
    await updateProgress((doc) => markDone(doc, stopId, Date.now()));
    back();
  };

  return (
    <Screen atmosphere="night" scroll={false} padded={false} edges={[]} testID="session-screen">
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xl },
        ]}
      >
        {view && playable ? (
          <View style={styles.text}>
            <Text variant="caption" tone="secondary" align="center">
              {t('session.meta', {
                type: typeLabel(view.stop.type),
                duration: durationLabel(view.stop.durationSec),
              })}
            </Text>
            <Text variant="title" heading align="center" testID="session-title">
              {t(view.stop.titleKey)}
            </Text>
            <Text variant="body" tone="secondary" align="center">
              {t('session.placeholder')}
            </Text>
          </View>
        ) : (
          <Text variant="heading" heading align="center" testID="session-unavailable">
            {t('session.notFound')}
          </Text>
        )}
        <View style={styles.actions}>
          {devMode && playable ? (
            <Button
              label={t('session.completeDev')}
              variant="secondary"
              fullWidth
              onPress={() => void complete()}
              testID="session-complete-dev"
            />
          ) : null}
          <Button
            label={t('session.back')}
            variant="ghost"
            fullWidth
            onPress={back}
            testID="session-back"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: space.xl,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  text: { gap: space.md, maxWidth: 520 },
  actions: { width: '100%', maxWidth: 440, gap: space.md },
});
