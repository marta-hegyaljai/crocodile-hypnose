import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Lagoon, type CrocExpression } from '@/illustration';
import { space } from '@/theme';
import { Screen, Text } from '@/ui';

/** A tab that arrives in a later step: the lagoon with the croc and a placeholder line. */
export function TabPlaceholder({
  title,
  message,
  expression = 'calm',
  testID,
  children,
}: {
  title: string;
  message: string;
  expression?: CrocExpression;
  testID: string;
  children?: React.ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Screen
      padded={false}
      edges={[]}
      testID={testID}
      background={
        <Lagoon
          width={width}
          height={height}
          stage="hatchling"
          expression={expression}
          waterTop={0.5}
          crocX={0.5}
          crocWidth={Math.min(Math.round(width * 0.5), 300)}
          farReeds={false}
        />
      }
    >
      <View style={[styles.content, { paddingTop: insets.top + space.xxl }]}>
        <Text variant="title" heading align="center">
          {title}
        </Text>
        <Text variant="body" tone="secondary" align="center">
          {message}
        </Text>
        {children}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.md,
    alignItems: 'stretch',
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
});
