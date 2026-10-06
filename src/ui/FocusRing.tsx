import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/** Keyboard/assistive focus indicator drawn just outside a control. Render only while focused. */
export function FocusRing({ radius, offset = 3 }: { radius: number; offset?: number }) {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          margin: -offset,
          borderRadius: radius + offset,
          borderWidth: 3,
          borderColor: colors.focusRing,
        },
      ]}
    />
  );
}

/** Web browsers draw their own outline on focused Pressables; we draw our own ring instead. */
export const noNativeOutline = { outlineWidth: 0 } as const;
