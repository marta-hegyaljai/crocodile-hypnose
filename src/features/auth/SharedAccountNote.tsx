import React from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/copy';
import { radius, space, useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

export interface SharedAccountNoteProps {
  /** A quiet one-liner under a form's button instead of the full card (Welcome has the card). */
  compact?: boolean;
  testID?: string;
}

/** Explains that the account is the same one MHP Coaching uses. */
export function SharedAccountNote({ compact = false, testID }: SharedAccountNoteProps) {
  const { colors } = useTheme();

  if (compact) {
    return (
      <View style={styles.compact} testID={testID}>
        <View style={[styles.badgeSmall, { backgroundColor: colors.primarySoft }]}>
          <Icon name="profile" size={14} color={colors.primaryDeep} />
        </View>
        <Text variant="caption" tone="secondary" style={styles.compactText}>
          {t('auth.sharedAccountNote')}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.root, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
      testID={testID}
    >
      <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
        <Icon name="profile" size={20} color={colors.primaryDeep} />
      </View>
      <View style={styles.text}>
        <Text variant="label" tone="secondary">
          {t('auth.mhpAccount')}
        </Text>
        <Text variant="caption" tone="secondary">
          {t('auth.sharedAccountNote')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: space.xxs },
  compact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingHorizontal: space.xs,
  },
  badgeSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    // Centred on the first caption line (18px line height).
    marginTop: -2,
  },
  compactText: { flex: 1 },
});
