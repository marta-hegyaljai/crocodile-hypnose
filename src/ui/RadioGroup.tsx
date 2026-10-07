import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { isWeb, radioKey, type KeyEventLike, type RootLike } from './webA11y';

export interface RadioGroupProps {
  /** The group's accessible name (usually the visible question or section title). */
  label: string;
  children: React.ReactNode;
  /** Arrow keys also pick the radio they reach (default). Off when picking has a side effect. */
  selectOnMove?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A named radio group. On the web the arrow keys, Home and End move between its radios and pick
 * the one reached; screen readers get the group role and name everywhere.
 */
export function RadioGroup({
  label,
  children,
  selectOnMove = true,
  style,
  testID,
}: RadioGroupProps) {
  const keys = isWeb
    ? {
        onKeyDown: (e: KeyEventLike) => {
          radioKey(e, (e.currentTarget as RootLike | undefined) ?? null, selectOnMove);
        },
      }
    : {};
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={style}
      testID={testID}
      {...keys}
    >
      {children}
    </View>
  );
}
