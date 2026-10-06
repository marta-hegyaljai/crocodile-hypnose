import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { AtmosphereProvider, space, useTheme, type Atmosphere } from '@/theme';

export interface ScreenProps {
  children: React.ReactNode;
  /** Switch this screen (and everything inside) to an atmosphere. Omit to inherit. */
  atmosphere?: Atmosphere;
  /** Scrollable content (default) or a fixed layout. */
  scroll?: boolean;
  /** Horizontal gutter. */
  padded?: boolean;
  /** Full-bleed layers behind the content (scenes, washes). */
  background?: React.ReactNode;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

function ScreenBody({
  children,
  scroll = true,
  padded = true,
  background,
  edges = ['top', 'bottom', 'left', 'right'],
  contentStyle,
  testID,
}: Omit<ScreenProps, 'atmosphere'>) {
  const { colors, atmosphere } = useTheme();
  const content = [padded && styles.padded, contentStyle];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID={testID}>
      <StatusBar style={atmosphere === 'night' ? 'light' : 'dark'} />
      {background && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {background}
        </View>
      )}
      <SafeAreaView edges={edges} style={styles.safe}>
        {scroll ? (
          <ScrollView
            style={styles.safe}
            contentContainerStyle={[styles.scrollContent, content]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.safe, content]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

/** Screen scaffold: background, safe areas, status bar style and optional atmosphere switch. */
export function Screen({ atmosphere, ...rest }: ScreenProps) {
  if (atmosphere) {
    return (
      <AtmosphereProvider atmosphere={atmosphere}>
        <ScreenBody {...rest} />
      </AtmosphereProvider>
    );
  }
  return <ScreenBody {...rest} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  padded: { paddingHorizontal: space.lg },
  scrollContent: { flexGrow: 1, paddingBottom: space.xxl },
});
