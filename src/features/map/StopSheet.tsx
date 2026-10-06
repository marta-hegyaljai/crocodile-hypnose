import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import type { LockReason, StopView } from '@/content/journey';
import { useReducedMotion } from '@/motion/MotionProvider';
import { palette, radius, space, useTheme } from '@/theme';
import { Button, Chip, Icon, Text, moveFocus } from '@/ui';

import { StopGlyph } from './StopGlyph';
import { durationLabel, statusLabel, typeLabel } from './stopLabels';

export interface StopSheetProps {
  /** The stop to show; null hides the sheet. */
  view: StopView | null;
  zoneTitle: string;
  onStart: (view: StopView) => void;
  onClose: () => void;
}

function lockText(reason: LockReason): string {
  switch (reason.kind) {
    case 'previous':
      return t('map.sheet.lockedPrevious', { title: t(reason.stop.titleKey) });
    case 'zone':
      return t('map.sheet.lockedZone', { zone: t(reason.zone.titleKey) });
    case 'comingSoon':
      return t('map.sheet.lockedComingSoon');
  }
}

/**
 * The bottom sheet for a tapped stop: its type, length and state, and Start (or why it is
 * locked). Focus moves into it when it opens; Escape, the backdrop and Close dismiss it.
 */
export function StopSheet({ view, zoneTitle, onStart, onClose }: StopSheetProps) {
  const { colors, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const titleRef = useRef<View>(null);
  // Keep the last stop while the sheet animates out.
  const [shown, setShown] = useState<StopView | null>(view);
  if (view && view !== shown) setShown(view);

  useEffect(() => {
    if (!view) return;
    const id = setTimeout(() => moveFocus(titleRef.current), 50);
    return () => clearTimeout(id);
  }, [view]);

  if (!shown) return null;
  const { stop, status, lockReason } = shown;
  const playable = status === 'available' || status === 'inProgress' || status === 'done';
  const startLabel =
    status === 'done'
      ? t('map.sheet.replay')
      : status === 'inProgress'
        ? t('map.sheet.resume')
        : t('map.sheet.start');
  const message =
    status === 'locked' && lockReason
      ? lockText(lockReason)
      : status === 'caution'
        ? t('map.sheet.caution')
        : status === 'done'
          ? t('map.sheet.done')
          : null;
  const long = stop.type === 'longTrance';

  return (
    <Modal
      visible={!!view}
      transparent
      animationType={reduced ? 'none' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
          onPress={onClose}
          accessibilityLabel={t('common.close')}
          testID="stop-sheet-backdrop"
        />
        <View
          style={[
            styles.sheet,
            shadow.raised,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, space.lg) + space.sm,
            },
          ]}
          accessibilityViewIsModal
          testID="stop-sheet"
        >
          <View style={styles.handle} />
          <View style={styles.row}>
            <View
              style={[
                styles.badge,
                { backgroundColor: long ? palette.tealDeep : palette.leafLight },
              ]}
            >
              {status === 'locked' ? (
                <Icon
                  name="lock"
                  size={26}
                  color={long ? palette.amberGlow : palette.crocGreenDark}
                />
              ) : (
                <StopGlyph
                  type={stop.type}
                  size={28}
                  color={long ? palette.amberGlow : palette.crocGreenDark}
                />
              )}
            </View>
            <View style={styles.meta}>
              <Text variant="caption" tone="secondary" numberOfLines={1} testID="stop-sheet-zone">
                {zoneTitle}
              </Text>
              <View ref={titleRef} tabIndex={-1} style={styles.focusTarget}>
                <Text variant="heading" heading testID="stop-sheet-title">
                  {t(stop.titleKey)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.chips}>
            <Chip
              label={typeLabel(stop.type)}
              tone="goal"
              icon="sparkle"
              testID="stop-sheet-type"
            />
            <Chip
              label={durationLabel(stop.durationSec)}
              tone="neutral"
              testID="stop-sheet-duration"
            />
            <Chip
              label={statusLabel(status)}
              tone={status === 'done' ? 'points' : 'neutral'}
              icon={status === 'done' ? 'check' : status === 'locked' ? 'lock' : undefined}
              testID="stop-sheet-status"
            />
          </View>
          {message ? (
            <Text variant="body" tone="secondary" testID="stop-sheet-message">
              {message}
            </Text>
          ) : null}
          {playable ? (
            <Button
              label={startLabel}
              icon="play"
              size="lg"
              fullWidth
              onPress={() => onStart(shown)}
              testID="stop-sheet-start"
            />
          ) : null}
          <Button
            label={t('common.close')}
            variant={playable ? 'ghost' : 'secondary'}
            fullWidth
            onPress={onClose}
            testID="stop-sheet-close"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    gap: space.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.mistDeep,
    marginBottom: space.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  focusTarget: { outlineWidth: 0 } as object,
});
