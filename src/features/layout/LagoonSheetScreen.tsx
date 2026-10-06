import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Lagoon, fitPeekCroc, type CrocExpression, type CrocStage } from '@/illustration';
import { AtmosphereProvider, radius, space, useTheme, type Atmosphere } from '@/theme';
import { Reveal, Screen } from '@/ui';

const Arrive = Platform.OS === 'web' ? Reveal : View;

export interface LagoonLayoutInfo {
  landscape: boolean;
  /** Size of the corner foliage: content on the sky should start below it. */
  leafSize: number;
}

export interface LagoonSheetScreenProps {
  /** Top content on the sky (back button, greeting). */
  header: React.ReactNode | ((info: LagoonLayoutInfo) => React.ReactNode);
  /** The sheet resting on the water: the screen's actions. */
  sheet: React.ReactNode;
  expression: CrocExpression;
  /** The user's croc (defaults to the juvenile shown before anyone is signed in). */
  stage?: CrocStage;
  crocName?: string;
  /** Petals and sparkles burst from the croc while true. */
  celebrating?: boolean;
  /** A bigger burst (the reward moment). */
  celebrationScale?: number;
  /** A splash where the croc lands on the water while true. */
  splash?: boolean;
  /** Draw the croc (off while it is swimming in another scene underneath, e.g. the dive). */
  showCroc?: boolean;
  /** The croc's vertical offset on the UI thread (negative lifts it: a hop). */
  crocOffsetY?: SharedValue<number>;
  /** The Night River version of the same screen (a long trance begins at dusk). */
  atmosphere?: Atmosphere;
  testID?: string;
}

/**
 * Daylight screen with the croc peeking out of the river between a header and a sheet. The croc is
 * sized and placed in the free band between them, so it never runs into the text; in landscape the
 * content takes the left column and the croc the right. Content scrolls when it does not fit.
 */
export function LagoonSheetScreen({ atmosphere, ...rest }: LagoonSheetScreenProps) {
  // The switch wraps the whole screen, so the sheet's own colours follow it too.
  if (atmosphere) {
    return (
      <AtmosphereProvider atmosphere={atmosphere}>
        <LagoonSheetBody {...rest} />
      </AtmosphereProvider>
    );
  }
  return <LagoonSheetBody {...rest} />;
}

function LagoonSheetBody({
  header,
  sheet,
  expression,
  stage = 'juvenile',
  crocName,
  celebrating = false,
  celebrationScale = 1,
  splash = false,
  showCroc = true,
  crocOffsetY,
  testID,
}: Omit<LagoonSheetScreenProps, 'atmosphere'>) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [headerBottom, setHeaderBottom] = useState<number | null>(null);
  const [sheetTop, setSheetTop] = useState<number | null>(null);

  const landscape = width > height;
  const leafSize = landscape
    ? Math.min(Math.round(width * 0.16), Math.round(height * 0.24))
    : Math.min(Math.round(width * 0.24), Math.round(height * 0.18));
  const columnWidth = landscape ? Math.min(480, Math.round(width * 0.52)) : width;

  let crocWidth: number;
  let waterTop: number;
  if (landscape) {
    crocWidth = Math.min(Math.round(width * 0.4), 420);
    waterTop = 0.5;
  } else {
    // Sized with a fixed expression, so a change of mood never resizes the croc.
    const fit = fitPeekCroc({
      stage,
      expression: 'calm',
      top: headerBottom ?? Math.round(height * 0.2),
      bottom: sheetTop ?? Math.round(height * 0.6),
      maxWidth: Math.min(Math.round(width * 0.8), 460),
      minWidth: Math.min(Math.round(width * 0.5), 180),
    });
    crocWidth = fit.crocWidth;
    waterTop = Math.min(0.85, fit.waterY / height);
  }

  return (
    <Screen
      scroll={false}
      padded={false}
      edges={[]}
      testID={testID}
      background={
        <Lagoon
          width={width}
          height={height}
          stage={stage}
          expression={expression}
          waterTop={waterTop}
          crocX={landscape ? 0.77 : 0.5}
          crocWidth={crocWidth}
          leafSize={leafSize}
          farReeds={!landscape}
          celebrate={celebrating}
          celebrationScale={celebrationScale}
          splash={splash}
          showCroc={showCroc}
          crocOffsetY={crocOffsetY}
          crocName={crocName}
        />
      }
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, landscape && { width: columnWidth }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + space.md,
              paddingLeft: insets.left + space.md,
            },
          ]}
          onLayout={(e) => setHeaderBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
        >
          {typeof header === 'function' ? header({ landscape, leafSize }) : header}
        </View>
        <View style={styles.flex} />
        {/* Web has no screen transition: the sheet arrives on its own (native stacks animate the screen). */}
        <Arrive offset={18} onLayout={(e) => setSheetTop(e.nativeEvent.layout.y)}>
          <View
            style={[
              styles.sheet,
              theme.shadow.raised,
              {
                backgroundColor: theme.colors.surface,
                paddingBottom: insets.bottom + space.xl,
              },
              landscape && { marginLeft: insets.left + space.md },
            ]}
          >
            <View style={styles.column}>{sheet}</View>
          </View>
        </Arrive>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  header: { paddingRight: space.md },
  sheet: {
    marginTop: space.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.xl,
    paddingHorizontal: space.xl,
  },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center' },
});
