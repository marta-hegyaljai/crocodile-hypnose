import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space, tapTarget, useTheme } from '@/theme';

import { FocusRing, noNativeOutline } from './FocusRing';
import { Text } from './Text';
import { useFocusRing } from './useFocusRing';
import { spaceActivates } from './webKeys';

export interface ToggleRowProps {
  label: string;
  detail?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  placeholder?: boolean;
  testID?: string;
}

/**
 * A labelled on/off setting. The whole row is the switch (one big target, one spoken name), the
 * visual switch on the right only shows the state.
 */
export function ToggleRow({
  label,
  detail,
  value,
  onValueChange,
  disabled = false,
  placeholder,
  testID,
}: ToggleRowProps) {
  const { colors } = useTheme();
  const focus = useFocusRing();
  const toggle = () => {
    if (!disabled) onValueChange(!value);
  };
  return (
    <Pressable
      onPress={toggle}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityState={{ checked: value, disabled }}
      aria-checked={value}
      testID={testID}
      style={[styles.row, noNativeOutline, disabled && styles.disabled]}
      {...spaceActivates(toggle)}
    >
      {focus.focused && <FocusRing radius={radius.md} />}
      <View style={styles.text}>
        <Text variant="bodyStrong" placeholder={placeholder}>
          {label}
        </Text>
        {detail ? (
          <Text variant="caption" tone="secondary">
            {detail}
          </Text>
        ) : null}
      </View>
      {/* Drawn here (not a platform switch) so only the row takes focus. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.track,
          { backgroundColor: value ? colors.primary : colors.border },
          value ? styles.trackOn : styles.trackOff,
        ]}
      >
        <View style={[styles.thumb, { backgroundColor: colors.surfaceRaised }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: tapTarget + space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.xs,
  },
  text: { flex: 1, gap: space.xxs },
  disabled: { opacity: 0.5 },
  track: { width: 52, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center' },
  trackOn: { alignItems: 'flex-end' },
  trackOff: { alignItems: 'flex-start' },
  thumb: { width: 24, height: 24, borderRadius: 12 },
});
