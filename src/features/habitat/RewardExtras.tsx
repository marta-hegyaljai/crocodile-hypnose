import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { t, type CopyKey } from '@/copy';
import { BadgeScale } from '@/illustration';
import { BADGE_IDS, BADGE_POINTS, useGamification, type BadgeId } from '@/services/gamification';
import { palette, radius, space, withAlpha } from '@/theme';
import { Chip, Icon, Reveal, Text } from '@/ui';

const badgeName = (id: string) => t(`gamification.badges.${id}` as CopyKey);

/**
 * The scales the server confirmed since this screen opened: what a session or game just earned.
 * Presentation only; the store's summary is the source (it refreshes once the event synced).
 */
export function useNewBadges(): BadgeId[] {
  const badges = useGamification((s) => s.summary.badges);
  // The scales held when the screen opened, fixed once (state, not a ref: read during render).
  const [before] = useState(() => new Set(badges.map((b) => b.id)));
  return badges.map((b) => b.id).filter((id) => !before.has(id));
}

/** A row of scale pills, one per newly earned scale, each with the scale's bonus. */
export function NewScales({ badges, delay = 0 }: { badges: readonly BadgeId[]; delay?: number }) {
  if (badges.length === 0) return null;
  return (
    <View style={styles.list} testID="reward-scales">
      {badges.map((id, i) => (
        <Reveal key={id} offset={10} delay={delay + i * 120}>
          <View
            style={styles.pill}
            accessible
            accessibilityRole="text"
            accessibilityLabel={t('gamification.a11yNewScale', {
              name: badgeName(id),
              n: BADGE_POINTS,
            })}
            testID={`reward-scale-${id}`}
          >
            <BadgeScale earned size={40} mark={BADGE_IDS.indexOf(id)} />
            <View style={styles.pillText}>
              <Text variant="bodyStrong" color={palette.amberText} placeholder numberOfLines={2}>
                {t('gamification.newScale', { name: badgeName(id) })}
              </Text>
              <Text variant="caption" color={palette.amberText} placeholder>
                {t('points.gain', { n: BADGE_POINTS })}
              </Text>
            </View>
            <Icon name="sparkle" size={18} color={palette.amber} />
          </View>
        </Reveal>
      ))}
    </View>
  );
}

/**
 * What a game just earned: its points, and any scale the server confirmed since the game opened.
 * Sits on the game's end card.
 */
export function GameReward({ points }: { points: number }) {
  const badges = useNewBadges();
  return (
    <View style={styles.gameReward}>
      <Reveal offset={8} delay={120}>
        <Chip
          label={t('points.gain', { n: points })}
          tone="points"
          icon="drop"
          placeholder
          accessibilityLabel={t('a11y.points', { n: points })}
          testID="game-reward-points"
        />
      </Reveal>
      <NewScales badges={badges} delay={240} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.xs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
    paddingLeft: space.xs,
    paddingRight: space.md,
    borderRadius: radius.lg,
    backgroundColor: withAlpha(palette.amber, 0.18),
    borderWidth: 1,
    borderColor: withAlpha(palette.amber, 0.45),
  },
  pillText: { flex: 1, gap: 2 },
  gameReward: { gap: space.xs, alignItems: 'flex-start' },
});
