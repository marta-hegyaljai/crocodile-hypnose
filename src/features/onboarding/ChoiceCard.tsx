import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/motion/MotionProvider';
import { t } from '@/copy';
import { radius, space, tapTarget, useTheme } from '@/theme';
import { FocusRing, Icon, Text, spaceActivates } from '@/ui';
import { noNativeOutline } from '@/ui/FocusRing';
import { useFocusRing } from '@/ui/useFocusRing';
import { usePressDepth } from '@/ui/usePressDepth';

export interface ChoiceCardProps {
  label: string;
  detail?: string;
  /** Illustration or icon shown before the label (left in a row, on top in a tile). */
  icon?: React.ReactNode;
  selected: boolean;
  onPress: () => void;
  /** Several may be picked (checkbox) or exactly one (radio). */
  role?: 'checkbox' | 'radio';
  /** A square-ish tile for grids instead of a full-width row. */
  tile?: boolean;
  disabled?: boolean;
  /** Bump to make the card shake its head (a refused pick). */
  nudge?: number;
  placeholder?: boolean;
  detailPlaceholder?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const EDGE = 3;

/**
 * A selectable pebble for onboarding answers. Selected cards turn leaf-green with a check badge;
 * pressing sinks the card onto its edge like the buttons.
 */
export function ChoiceCard({
  label,
  detail,
  icon,
  selected,
  onPress,
  role = 'checkbox',
  tile = false,
  disabled = false,
  nudge = 0,
  placeholder,
  detailPlaceholder,
  testID,
  style,
}: ChoiceCardProps) {
  const theme = useTheme();
  const { colors } = theme;
  const focus = useFocusRing();
  const press = usePressDepth();
  const night = theme.atmosphere === 'night';

  const face = selected ? colors.primarySoft : colors.surfaceRaised;
  const border = selected ? colors.primary : colors.border;
  const edge = selected ? colors.primaryDeep : colors.border;
  const reducedMotion = useReducedMotion();
  const shake = useSharedValue(0);
  useEffect(() => {
    if (!nudge || reducedMotion) return;
    shake.value = withSequence(
      withTiming(1, { duration: 50 }),
      withTiming(-1, { duration: 70 }),
      withTiming(0.6, { duration: 60 }),
      withTiming(0, { duration: 80 }),
    );
  }, [nudge, reducedMotion, shake]);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: press.pressed.value * EDGE }, { translateX: shake.value * 6 }],
  }));

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : press.onPressIn}
      onPressOut={disabled ? undefined : press.onPressOut}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      testID={testID}
      style={[styles.root, tile && styles.tileRoot, noNativeOutline, style]}
      {...spaceActivates(() => {
        if (!disabled) onPress();
      })}
    >
      <View
        pointerEvents="none"
        style={[styles.edge, { top: EDGE, backgroundColor: edge }, !night && theme.shadow.card]}
      />
      <Animated.View
        style={[
          styles.face,
          tile ? styles.tileFace : styles.rowFace,
          { backgroundColor: face, borderColor: border, borderWidth: selected ? 2 : 1 },
          disabled && styles.disabled,
          faceStyle,
        ]}
      >
        {focus.focused && <FocusRing radius={radius.lg} />}
        {icon ? <View style={tile ? styles.tileIcon : styles.rowIcon}>{icon}</View> : null}
        <View style={[styles.text, tile && styles.tileText]}>
          <Text
            variant={tile ? 'label' : 'bodyStrong'}
            align={tile ? 'center' : undefined}
            placeholder={placeholder}
            numberOfLines={tile ? 2 : undefined}
          >
            {label}
          </Text>
          {detail ? (
            <Text
              variant="caption"
              tone="secondary"
              align={tile ? 'center' : undefined}
              placeholder={detailPlaceholder}
            >
              {detail}
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.badge,
            tile && styles.tileBadge,
            {
              backgroundColor: selected ? colors.primary : 'transparent',
              borderColor: selected ? colors.primaryDeep : colors.inputBorder,
            },
          ]}
          accessibilityLabel={selected ? t('a11y.selected') : undefined}
        >
          {selected ? <Icon name="check" size={16} color={colors.textOnPrimary} /> : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: EDGE, alignSelf: 'stretch' },
  tileRoot: { flexGrow: 1, flexBasis: 140, maxWidth: 220 },
  edge: { position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: radius.lg },
  face: { borderRadius: radius.lg, overflow: 'visible' },
  rowFace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingVertical: space.md,
    paddingLeft: space.md,
    paddingRight: space.md,
  },
  tileFace: {
    alignItems: 'center',
    gap: space.sm,
    minHeight: 112,
    paddingTop: space.lg,
    paddingBottom: space.md,
    paddingHorizontal: space.md,
  },
  disabled: { opacity: 0.55 },
  rowIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tileIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: space.xxs, minHeight: tapTarget - 2 * space.md, justifyContent: 'center' },
  tileText: { flex: 0, alignItems: 'center' },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBadge: { position: 'absolute', top: space.sm, right: space.sm },
});
