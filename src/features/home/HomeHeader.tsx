import React from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/copy';
import { Croc } from '@/illustration';
import { useGrowthStage, usePoints, useWeeklyGoal } from '@/services/gamification';
import { palette, space } from '@/theme';
import { Chip, Text } from '@/ui';

/**
 * The croc's avatar (at its growth stage) and name, the points chip (the server's balance, plus
 * what offline events will add) and the weekly-goal chip.
 */
export function HomeHeader({ crocName }: { crocName: string }) {
  const { balance, pending } = usePoints();
  const { days, target } = useWeeklyGoal();
  const stage = useGrowthStage();
  const pointsLabel =
    pending > 0
      ? t('gamification.pointsWithPending', { n: balance, pending })
      : t('points.amount', { n: balance });
  const pointsA11y =
    pending > 0
      ? t('gamification.a11yPointsPending', { n: balance, pending })
      : t('a11y.points', { n: balance });
  return (
    <View style={styles.row}>
      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          <Croc
            stage={stage}
            pose="peek"
            water="inline"
            width={52}
            expression="happy"
            name={crocName}
            animated={false}
            relativeSize={false}
          />
        </View>
        <Text variant="subheading" numberOfLines={1} style={styles.name} testID="home-croc-name">
          {crocName}
        </Text>
      </View>
      <View style={styles.chips}>
        <Chip
          label={pointsLabel}
          tone="points"
          accessibilityLabel={pointsA11y}
          testID="home-points"
        />
        <Chip
          label={t('goal.progress', { done: Math.min(days, target), total: target })}
          tone={days >= target ? 'celebrate' : 'goal'}
          accessibilityLabel={t('a11y.weeklyGoal', { done: days, total: target })}
          testID="home-weekly"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: palette.shallows,
    borderWidth: 2,
    borderColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { flexShrink: 1 },
  chips: { flexDirection: 'row', gap: space.xs, flexShrink: 0 },
});
