import { router, useIsFocused } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import type { StopView, TodaysSession } from '@/content/journey';
import { localContent } from '@/content/repository';
import { useTapShield } from '@/features/layout/TapShield';
import { HomeHeader } from '@/features/home/HomeHeader';
import { TodayCard } from '@/features/home/TodayCard';
import { useJourney } from '@/features/home/useJourney';
import { RiverMap } from '@/features/map/RiverMap';
import { StopSheet } from '@/features/map/StopSheet';
import { useAuth } from '@/services/auth';
import { useProfile } from '@/services/profile';
import { isAuthError } from '@/services/auth/types';
import { space, useTheme } from '@/theme';
import { Text } from '@/ui';

/**
 * Home (Daylight): the croc and the counters on top, today's session one tap away, and the
 * river map with every zone and stop below.
 */
export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const shield = useTapShield();
  const user = useAuth((s) => s.user);
  const crocName = useProfile((s) => s.settings.crocName) ?? t('croc.defaultName');
  const pendingOffline = useProfile(
    (s) => s.dirty && isAuthError(s.syncError) && s.syncError.isConnectivity,
  );
  const { journey, today } = useJourney();
  // On a short screen (e.g. 360x640) the top block tightens so more of the river shows.
  const compact = useWindowDimensions().height < 720;
  const [selected, setSelected] = useState<StopView | null>(null);
  const focused = useIsFocused();

  const start = useCallback(
    (stopId: string) => {
      // The session screen opens where the button was: swallow the rest of a double tap.
      shield();
      router.push({ pathname: '/session/[stopId]', params: { stopId } });
    },
    [shield],
  );
  const onPlay = useCallback((s: TodaysSession) => start(s.stop.id), [start]);
  const onSheetStart = useCallback(
    (view: StopView) => {
      setSelected(null);
      start(view.stop.id);
    },
    [start],
  );
  const closeSheet = useCallback(() => setSelected(null), []);

  const name = user?.displayName || user?.email.split('@')[0] || '';
  const selectedZone = selected ? localContent.zone(selected.stop.zoneId) : undefined;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="home-screen">
      <View
        style={[
          styles.top,
          compact && styles.topCompact,
          { paddingTop: insets.top + (compact ? space.xs : space.sm) },
        ]}
      >
        <HomeHeader crocName={crocName} />
        <Text
          variant={compact ? 'subheading' : 'heading'}
          heading
          numberOfLines={1}
          placeholder
          testID="home-greeting"
        >
          {t('home.greeting', { name })}
        </Text>
        <TodayCard today={today} onPlay={onPlay} compact={compact} />
        {pendingOffline ? (
          <Text variant="caption" tone="secondary" testID="home-sync-pending">
            {t('home.syncPending')}
          </Text>
        ) : null}
      </View>
      <RiverMap
        journey={journey}
        currentStopId={today?.stop.id ?? null}
        crocName={crocName}
        crocStage="hatchling"
        onStopPress={setSelected}
        bottomInset={space.xl}
        active={focused}
        testID="river-map"
      />
      <StopSheet
        view={selected}
        zoneTitle={selectedZone ? t(selectedZone.titleKey) : ''}
        current={!!selected && selected.stop.id === today?.stop.id}
        onStart={onSheetStart}
        onClose={closeSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    gap: space.sm,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    zIndex: 1,
  },
  topCompact: { paddingBottom: space.sm, gap: space.xs },
});
