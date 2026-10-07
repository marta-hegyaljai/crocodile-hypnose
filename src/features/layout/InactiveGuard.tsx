import { useIsFocused } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Wraps a tab's screen. The tab navigator keeps inactive tabs mounted (they keep their state and
 * scroll), but on the web they stay in the tab order and the accessibility tree. While the tab is
 * not the visible one, its content is hidden from focus and screen readers (`visibility: hidden`
 * does both and keeps layout and scroll position).
 */
export function InactiveGuard({ children }: { children: React.ReactNode }) {
  const focused = useIsFocused();
  return (
    <View
      style={focused ? styles.root : styles.hidden}
      aria-hidden={!focused}
      importantForAccessibility={focused ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!focused}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // `visibility` is not in React Native's style types; react-native-web passes it through.
  hidden: { flex: 1, ...({ visibility: 'hidden' } as object) },
});
