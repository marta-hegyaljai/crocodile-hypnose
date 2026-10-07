import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { space, useTheme } from '@/theme';
import { Card, Text } from '@/ui';

/**
 * A titled group of settings: a level-2 heading (the page title is level 1) over one pebble card,
 * so the profile reads as a short list of calm, scannable groups rather than one long column.
 */
export function Section({
  title,
  children,
  testID,
  style,
}: {
  title: string;
  children: React.ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]} testID={testID}>
      <Text variant="subheading" heading={2} style={styles.title}>
        {title}
      </Text>
      <Card tone="surface" padding="md">
        <View style={styles.body}>{children}</View>
      </Card>
    </View>
  );
}

/** Toggle rows inside a Section, separated by hairlines so each setting reads as its own line. */
export function Rows({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View>
      {items.map((child, i) => (
        <View
          key={i}
          style={i > 0 ? [styles.rowAfter, { borderTopColor: colors.border }] : undefined}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  title: { paddingHorizontal: space.xs },
  body: { gap: space.sm },
  rowAfter: { borderTopWidth: StyleSheet.hairlineWidth },
});
