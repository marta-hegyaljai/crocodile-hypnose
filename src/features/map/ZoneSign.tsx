import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/copy';
import type { ZoneState } from '@/content/journey';
import { palette, radius, space } from '@/theme';
import { Icon, Text } from '@/ui';

export interface ZoneSignProps {
  title: string;
  state: ZoneState;
  done: number;
  total: number;
  top: number;
  width: number;
}

/** The wooden sign at the start of each region: its name and how far the user got. */
export const ZoneSign = memo(function ZoneSign({
  title,
  state,
  done,
  total,
  top,
  width,
}: ZoneSignProps) {
  const open = state === 'open';
  const label =
    state === 'comingSoon'
      ? t('map.zoneComingSoon', { zone: title })
      : state === 'locked'
        ? t('map.zoneLocked', { zone: title })
        : t('map.zoneProgressA11y', { zone: title, done, total });
  return (
    <View style={[styles.wrap, { top: top + 18, width }]} pointerEvents="box-none">
      <View
        style={[styles.post, !open && styles.postMuted]}
        accessible
        accessibilityRole="header"
        accessibilityLabel={label}
        testID={`zone-sign-${title}`}
      >
        <View style={[styles.board, !open && styles.boardMuted]}>
          <View pointerEvents="none" style={styles.grain} />
          {!open ? <Icon name="lock" size={16} color={palette.mistLight} /> : null}
          <Text variant="heading" color={palette.mistLight} numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <View style={[styles.count, !open && styles.countMuted]}>
            <Text variant="label" color={open ? palette.amberInk : palette.mistText}>
              {state === 'comingSoon'
                ? t('common.comingSoon')
                : t('map.zoneProgress', { done, total })}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, alignItems: 'center' },
  post: {
    borderRadius: radius.md,
    backgroundColor: palette.mudDark,
    paddingBottom: 5,
    maxWidth: '86%',
  },
  postMuted: { backgroundColor: '#55625A' },
  board: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: palette.riverbankMud,
    overflow: 'hidden',
  },
  boardMuted: { backgroundColor: '#748378' },
  grain: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  title: { flexShrink: 1 },
  count: {
    backgroundColor: palette.amberGlow,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  countMuted: { backgroundColor: palette.mistLight },
});
