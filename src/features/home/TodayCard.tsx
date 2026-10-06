import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { t } from '@/copy';
import type { TodaysSession } from '@/content/journey';
import { StopGlyph } from '@/features/map/StopGlyph';
import { durationLabel, typeLabel } from '@/features/map/stopLabels';
import { palette, radius, space, useTheme } from '@/theme';
import { Icon, Text } from '@/ui';
import { FocusRing, noNativeOutline } from '@/ui/FocusRing';
import { useFocusRing } from '@/ui/useFocusRing';
import { usePressDepth } from '@/ui/usePressDepth';

export interface TodayCardProps {
  today: TodaysSession | null;
  onPlay: (today: TodaysSession) => void;
  /** Tighter padding and a smaller play button on short screens. */
  compact?: boolean;
}

const PLAY = 60;

/** Today's session: what it is, and one big amber play button. The whole card is the button. */
export function TodayCard({ today, onPlay, compact = false }: TodayCardProps) {
  const { colors } = useTheme();
  const focus = useFocusRing();
  const press = usePressDepth();
  const sink = useAnimatedStyle(() => ({ transform: [{ translateY: press.pressed.value * 4 }] }));

  if (!today) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface }]} testID="today-card">
        <Text variant="body" tone="secondary">
          {t('home.today.empty')}
        </Text>
      </View>
    );
  }
  const { stop, zone, kind } = today;
  const title = t(stop.titleKey);
  const label =
    kind === 'resume'
      ? t('home.today.labelResume')
      : kind === 'replay'
        ? t('home.today.labelReplay')
        : t('home.today.label');
  return (
    <Pressable
      onPress={() => onPlay(today)}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${t('home.today.play', { title })}, ${durationLabel(stop.durationSec)}`}
      style={noNativeOutline}
      testID="today-play"
    >
      <View
        style={[
          styles.card,
          styles.cardEdge,
          compact && styles.cardCompact,
          { backgroundColor: colors.surface },
        ]}
        testID="today-card"
      >
        <View style={[styles.glyph, stop.type === 'longTrance' && styles.glyphLong]}>
          <StopGlyph
            type={stop.type}
            size={26}
            color={stop.type === 'longTrance' ? palette.amberGlow : palette.crocGreenDark}
          />
        </View>
        <View style={styles.text}>
          <Text variant="label" color={colors.textWater} numberOfLines={1} testID="today-label">
            {label.toUpperCase()}
          </Text>
          <Text variant="subheading" numberOfLines={2} testID="today-title">
            {title}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1} testID="today-meta">
            {t('home.today.meta', {
              zone: t(zone.titleKey),
              duration: durationLabel(stop.durationSec),
              type: typeLabel(stop.type).toLowerCase(),
            })}
          </Text>
        </View>
        <View style={styles.playSlot}>
          <View style={styles.playEdge} />
          <Animated.View style={[styles.play, sink]}>
            <View pointerEvents="none" style={styles.playGloss} />
            <Icon name="play" size={30} color={palette.amberInk} />
          </Animated.View>
        </View>
        {focus.focused ? <FocusRing radius={radius.lg} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingLeft: space.md,
    paddingRight: space.md,
    minHeight: 88,
  },
  cardCompact: { minHeight: 72, paddingVertical: space.sm },
  cardEdge: {
    borderBottomWidth: 4,
    borderColor: '#C9D9CB',
    shadowColor: palette.deepJungle,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  glyph: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.leafLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphLong: { backgroundColor: palette.tealDeep },
  text: { flex: 1, gap: 1, minWidth: 0 },
  playSlot: { width: PLAY, height: PLAY + 5 },
  playEdge: {
    position: 'absolute',
    top: 5,
    width: PLAY,
    height: PLAY,
    borderRadius: PLAY / 2,
    backgroundColor: palette.amberDeep,
  },
  play: {
    width: PLAY,
    height: PLAY,
    borderRadius: PLAY / 2,
    backgroundColor: palette.amber,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  playGloss: {
    position: 'absolute',
    top: 6,
    left: 16,
    width: 22,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
});
