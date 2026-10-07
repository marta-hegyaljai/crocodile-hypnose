import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t, type CopyKey } from '@/copy';
import { BadgeScale, Decoration, HabitatScene } from '@/illustration';
import { useFeedback } from '@/services/feedback';
import {
  BADGE_IDS,
  DECORATIONS,
  WEEKLY_TARGET_MAX,
  WEEKLY_TARGET_MIN,
  growthProgress,
  placeIn,
  useGamification,
  usePoints,
  useWeeklyGoal,
  type DecorationDef,
  type PurchaseResult,
} from '@/services/gamification';
import { useProfile } from '@/services/profile';
import { appContentMeta, pendingGains } from '@/services/gamification/derive';
import { palette, radius, space } from '@/theme';
import { Button, Card, Chip, IconButton, Notice, ProgressBar, Screen, Text } from '@/ui';

const itemName = (id: string) => t(`gamification.items.${id}` as CopyKey);
const badgeName = (id: string) => t(`gamification.badges.${id}` as CopyKey);

const PURCHASE_MESSAGE: Record<Exclude<PurchaseResult, 'ok'>, CopyKey> = {
  insufficient: 'gamification.habitat.insufficient',
  locked: 'gamification.habitat.lockedError',
  offline: 'gamification.habitat.offline',
  error: 'gamification.habitat.error',
};

/** Columns for a grid at this content width (cards at least ~150 wide). */
const columnsFor = (width: number, min: number) => Math.max(2, Math.floor(width / min));

/** The item that would leave the scene if this one were placed now (its slots are all taken). */
function displacedBy(slots: Record<string, string | null>, itemId: string): string | null {
  const next = placeIn(slots, itemId);
  if (next === slots) return null;
  const slot = Object.keys(next).find((k) => next[k] !== slots[k]);
  return slot ? (slots[slot] ?? null) : null;
}

/**
 * The Croc tab: the croc's lagoon, which the user decorates with what they bought or unlocked,
 * the croc's growth towards its next stage, the weekly goal, and the collection of scales.
 */
export function HabitatScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const feedback = useFeedback();
  const crocName = useProfile((s) => s.settings.crocName) ?? t('croc.defaultName');
  const pendingSeconds = useProfile((s) => pendingGains(s.sessions, appContentMeta).seconds);
  const summary = useGamification((s) => s.summary);
  const slots = useGamification((s) => s.habitat.slots);
  const purchasing = useGamification((s) => s.purchasing);
  const actions = useGamification((s) => s);
  const { balance, pending } = usePoints();
  const weekly = useWeeklyGoal();
  const [message, setMessage] = useState<{ key: CopyKey; itemId: string } | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const contentWidth = Math.min(width, 720) - space.lg * 2;
  const sceneHeight = Math.round(Math.min(Math.max(contentWidth * 0.68, 230), 380));
  // The scene stays in view while the list scrolls: it folds to a band with the croc's head and the
  // water line, so buying or placing something is always seen happening.
  const compactHeight = Math.round(Math.max(118, sceneHeight * (height < 760 ? 0.4 : 0.5)));
  const collapse = Math.max(1, sceneHeight - compactHeight);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const sceneFrame = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, collapse], [sceneHeight, compactHeight], Extrapolation.CLAMP),
  }));
  const sceneShift = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(scrollY.value, [0, collapse], [0, -collapse * 0.42], Extrapolation.CLAMP),
      },
    ],
  }));
  const growth = growthProgress(summary.calmSeconds + pendingSeconds);
  const owned = new Set(summary.owned.map((o) => o.itemId));
  const earned = new Map(summary.badges.map((b) => [b.id, b.at]));
  const placed = new Set(Object.values(slots).filter((v): v is string => !!v));
  const itemCols = columnsFor(contentWidth, 156);
  const badgeCols = columnsFor(contentWidth, 104);
  const itemWidth = (contentWidth - space.sm * (itemCols - 1)) / itemCols;
  const badgeWidth = (contentWidth - space.sm * (badgeCols - 1)) / badgeCols;

  const buy = async (item: DecorationDef) => {
    setMessage(null);
    const result = await actions.purchase(item.id);
    if (result === 'ok') {
      feedback.sound('hatch');
      feedback.haptic('success');
      await actions.place(item.id);
      setCelebrate(false);
      setTimeout(() => setCelebrate(true), 0);
    } else {
      setMessage({ key: PURCHASE_MESSAGE[result], itemId: item.id });
    }
  };

  const action = (item: DecorationDef) => {
    const name = itemName(item.id);
    const swap = placed.has(item.id) ? null : displacedBy(slots, item.id);
    const swapHint = swap ? (
      <Text variant="caption" tone="secondary" align="center" numberOfLines={2} placeholder>
        {t('gamification.habitat.willSwap', { item: itemName(swap) })}
      </Text>
    ) : null;
    if (owned.has(item.id)) {
      const isPlaced = placed.has(item.id);
      return (
        <View style={styles.action}>
          <Button
            label={isPlaced ? t('gamification.habitat.remove') : t('gamification.habitat.place')}
            variant={isPlaced ? 'ghost' : 'secondary'}
            size="sm"
            fullWidth
            onPress={() => {
              feedback.haptic('select');
              void (isPlaced ? actions.remove(item.id) : actions.place(item.id));
            }}
            accessibilityLabel={`${isPlaced ? t('gamification.habitat.remove') : t('gamification.habitat.place')}: ${name}`}
            testID={`item-${item.id}-${isPlaced ? 'remove' : 'place'}`}
          />
          {swapHint}
        </View>
      );
    }
    const lockedBy = item.requires && !earned.has(item.requires) ? item.requires : null;
    if (lockedBy) {
      return (
        <Text variant="caption" tone="secondary" align="center" placeholder>
          {t('gamification.habitat.unlockBy', { badge: badgeName(lockedBy) })}
        </Text>
      );
    }
    const affordable = balance >= item.cost;
    return (
      <View style={styles.action}>
        <Button
          label={
            item.cost === 0
              ? t('gamification.habitat.unlockFree')
              : t('gamification.habitat.buy', { n: item.cost })
          }
          size="sm"
          icon={item.cost === 0 ? 'sparkle' : 'drop'}
          fullWidth
          disabled={!affordable || !!purchasing}
          loading={purchasing === item.id}
          onPress={() => void buy(item)}
          accessibilityLabel={
            affordable
              ? `${name}: ${t('gamification.habitat.buy', { n: item.cost })}`
              : `${name}: ${t('gamification.habitat.buy', { n: item.cost })}, ${t('gamification.habitat.morePoints', { n: item.cost - balance })}`
          }
          testID={`item-${item.id}-buy`}
        />
        {!affordable ? (
          <Text
            variant="caption"
            tone="secondary"
            align="center"
            placeholder
            testID={`item-${item.id}-missing`}
          >
            {t('gamification.habitat.morePoints', { n: item.cost - balance })}
          </Text>
        ) : affordable ? (
          swapHint
        ) : null}
      </View>
    );
  };

  return (
    <Screen padded={false} edges={[]} scroll={false} testID="croc-screen">
      <View style={[styles.top, { paddingTop: insets.top + space.md }]}>
        <View style={styles.header}>
          <Text
            variant="title"
            heading
            numberOfLines={1}
            style={styles.title}
            testID="habitat-name"
          >
            {crocName}
          </Text>
          <Chip
            label={
              pending > 0
                ? t('gamification.pointsWithPending', { n: balance, pending })
                : t('points.amount', { n: balance })
            }
            tone="points"
            accessibilityLabel={
              pending > 0
                ? t('gamification.a11yPointsPending', { n: balance, pending })
                : t('a11y.points', { n: balance })
            }
            testID="habitat-points"
          />
        </View>

        <Animated.View
          style={[styles.scene, sceneFrame]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('gamification.habitat.a11yScene', {
            name: crocName,
            count: placed.size,
          })}
        >
          <Animated.View style={sceneShift}>
            <HabitatScene
              width={contentWidth}
              height={sceneHeight}
              stage={growth.stage}
              slots={slots}
              crocName={crocName}
              celebrate={celebrate}
              testID="habitat-scene"
            />
          </Animated.View>
        </Animated.View>
      </View>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card padding="md" testID="habitat-growth">
          <View style={styles.rowBetween}>
            <Chip
              label={t(`croc.stages.${growth.stage}`)}
              tone="celebrate"
              placeholder
              testID="habitat-stage"
            />
            <Text variant="caption" tone="secondary" placeholder testID="habitat-calm">
              {t('gamification.habitat.calm', { n: growth.minutes })}
            </Text>
          </View>
          <ProgressBar
            progress={growth.fraction}
            tone="water"
            style={styles.bar}
            accessibilityLabel={
              growth.next && growth.nextAt !== null
                ? t('gamification.habitat.nextStage', {
                    n: growth.nextAt - growth.minutes,
                    stage: t(`croc.stages.${growth.next}`),
                  })
                : t('gamification.habitat.fullGrown')
            }
          />
          <Text variant="caption" tone="secondary" placeholder>
            {growth.next && growth.nextAt !== null
              ? t('gamification.habitat.nextStage', {
                  n: growth.nextAt - growth.minutes,
                  stage: t(`croc.stages.${growth.next}`),
                })
              : t('gamification.habitat.fullGrown')}
          </Text>
        </Card>

        <Card padding="md" testID="habitat-weekly">
          <Text variant="subheading">{t('gamification.weekly.title')}</Text>
          <Text variant="caption" tone="secondary" placeholder testID="habitat-weekly-progress">
            {t('gamification.weekly.progress', { done: weekly.days, total: weekly.target })}
          </Text>
          <View style={styles.stepper}>
            <IconButton
              icon="minus"
              variant="filled"
              accessibilityLabel={t('gamification.weekly.less')}
              disabled={weekly.target <= WEEKLY_TARGET_MIN}
              onPress={() => void actions.stepWeeklyTarget(-1)}
              testID="weekly-less"
            />
            <Text variant="body" placeholder style={styles.stepperValue} testID="weekly-target">
              {t('gamification.weekly.days', { n: weekly.target })}
            </Text>
            <IconButton
              icon="plus"
              variant="filled"
              accessibilityLabel={t('gamification.weekly.more')}
              disabled={weekly.target >= WEEKLY_TARGET_MAX}
              onPress={() => void actions.stepWeeklyTarget(1)}
              testID="weekly-more"
            />
          </View>
        </Card>

        <Text variant="heading" heading placeholder>
          {t('gamification.habitat.decorations')}
        </Text>
        {message ? (
          <Notice
            tone={message.key === 'gamification.habitat.error' ? 'error' : 'info'}
            message={t(message.key)}
            testID="habitat-message"
          />
        ) : null}
        <View style={styles.grid}>
          {DECORATIONS.map((item) => {
            const isOwned = owned.has(item.id);
            const locked = !isOwned && !!item.requires && !earned.has(item.requires);
            return (
              <View
                key={item.id}
                style={[styles.item, { width: itemWidth }, isOwned && styles.itemOwned]}
                testID={`item-${item.id}`}
              >
                <View
                  accessible
                  accessibilityLabel={t('gamification.habitat.a11yItem', {
                    name: itemName(item.id),
                    state: isOwned
                      ? t('gamification.habitat.owned')
                      : locked
                        ? t('gamification.habitat.locked')
                        : t('gamification.habitat.buy', { n: item.cost }),
                  })}
                  style={styles.itemTop}
                >
                  <Decoration id={item.id} size={64} muted={locked} />
                  <Text variant="label" align="center" numberOfLines={2} placeholder>
                    {itemName(item.id)}
                  </Text>
                </View>
                {action(item)}
              </View>
            );
          })}
        </View>

        <Text variant="heading" heading placeholder>
          {t('gamification.habitat.badges')}
        </Text>
        <View style={styles.grid} testID="badges">
          {BADGE_IDS.map((id, i) => {
            const has = earned.has(id);
            return (
              <View
                key={id}
                style={[styles.badge, { width: badgeWidth }]}
                accessible
                accessibilityLabel={t('gamification.habitat.a11yBadge', {
                  name: badgeName(id),
                  state: has
                    ? t('gamification.habitat.earned')
                    : t('gamification.habitat.notEarned'),
                })}
                testID={`badge-${id}${has ? '-earned' : ''}`}
              >
                <BadgeScale earned={has} size={52} mark={i} />
                <Text
                  variant="caption"
                  align="center"
                  numberOfLines={2}
                  tone={has ? 'primary' : 'secondary'}
                  placeholder
                >
                  {badgeName(id)}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    gap: space.sm,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.xxl,
    gap: space.md,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1 },
  scene: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: palette.white,
    backgroundColor: palette.shallows,
  },
  action: { gap: space.xxs },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  bar: { marginVertical: space.sm },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  stepperValue: { flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  item: {
    padding: space.sm,
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: palette.mistLight,
    borderWidth: 2,
    borderColor: palette.mistDeep,
    justifyContent: 'space-between',
  },
  itemOwned: { borderColor: palette.leaf },
  itemTop: { alignItems: 'center', gap: space.xxs },
  badge: { alignItems: 'center', gap: space.xxs, paddingVertical: space.xs },
});
