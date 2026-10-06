import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

const ShieldContext = createContext<(ms?: number) => void>(() => undefined);

/** Default length of the shield: longer than a double tap, shorter than a deliberate next tap. */
export const SHIELD_MS = 450;

/**
 * Swallows taps for a moment after a screen swap (sign-in, sign-out, Get started), so the second
 * tap of a double tap never lands on whatever the new screen has under the finger. Invisible.
 */
export function TapShieldProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shield = useCallback((ms = SHIELD_MS) => {
    if (timer.current) clearTimeout(timer.current);
    setActive(true);
    timer.current = setTimeout(() => setActive(false), ms);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ShieldContext.Provider value={shield}>
      <View style={styles.root}>
        {children}
        {active ? <View style={styles.shield} testID="tap-shield" /> : null}
      </View>
    </ShieldContext.Provider>
  );
}

/** Starts the tap shield (e.g. right before navigating away on a tap). */
export function useTapShield() {
  return useContext(ShieldContext);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  shield: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
});
