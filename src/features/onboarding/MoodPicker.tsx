import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { t } from '@/copy';
import type { MoodValue } from '@/services/profile/types';
import { radius, space, tapTarget, useTheme } from '@/theme';
import { FocusRing, Text, spaceActivates } from '@/ui';
import { noNativeOutline } from '@/ui/FocusRing';
import { useFocusRing } from '@/ui/useFocusRing';

export interface MoodPickerProps {
  value: MoodValue | null;
  onChange: (value: MoodValue) => void;
  testID?: string;
}

const MOODS: MoodValue[] = [1, 2, 3, 4, 5];

/** The water for a mood: still at 1, choppy at 5. */
function wavePath(mood: MoodValue): string {
  const amp = (mood - 1) * 2.4;
  const n = 4 + mood;
  const step = 56 / n;
  let d = `M 2 20`;
  for (let i = 0; i < n; i++) {
    const x0 = 2 + i * step;
    const up = i % 2 === 0 ? -amp : amp;
    d += ` Q ${x0 + step / 2} ${20 + up} ${x0 + step} 20`;
  }
  return d;
}

function MoodOption({
  mood,
  selected,
  onPress,
  testID,
}: {
  mood: MoodValue;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, atmosphere } = useTheme();
  const focus = useFocusRing();
  const night = atmosphere === 'night';
  const label = t(`mood.labels.${mood}`);
  return (
    <Pressable
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      testID={testID}
      {...spaceActivates(onPress)}
      style={[
        styles.option,
        noNativeOutline,
        {
          backgroundColor: selected
            ? night
              ? colors.accentSoft
              : colors.primarySoft
            : colors.surfaceRaised,
          borderColor: selected ? (night ? colors.accent : colors.primary) : colors.border,
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      {focus.focused && <FocusRing radius={radius.md} />}
      <Svg width={48} height={34} viewBox="0 0 60 40" aria-hidden>
        <Path
          d={`${wavePath(mood)} L 58 38 L 2 38 Z`}
          fill={colors.water}
          opacity={night ? 0.7 : 0.35}
        />
        <Path
          d={wavePath(mood)}
          stroke={night ? colors.waterLight : colors.water}
          strokeWidth={2.2}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
      <Text
        variant="caption"
        tone={selected ? 'primary' : 'secondary'}
        align="center"
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Five water states from still to rough, with placeholder labels. One can be picked. */
export function MoodPicker({ value, onChange, testID }: MoodPickerProps) {
  return (
    <View
      style={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('mood.question')}
      testID={testID}
    >
      {MOODS.map((mood) => (
        <MoodOption
          key={mood}
          mood={mood}
          selected={value === mood}
          onPress={() => onChange(mood)}
          testID={testID ? `${testID}-${mood}` : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  option: {
    minWidth: 52,
    flexGrow: 1,
    flexBasis: 52,
    maxWidth: 96,
    minHeight: tapTarget + 24,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
  },
});
