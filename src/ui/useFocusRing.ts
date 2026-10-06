import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Tracks whether the last input came from the keyboard (web only). Mirrors `:focus-visible`:
 * the ring shows for keyboard / assistive focus, not for the focus a click or tap leaves behind.
 * Programmatic focus with no prior pointer input counts as keyboard.
 */
let lastInputWasKeyboard = true;

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener(
    'keydown',
    () => {
      lastInputWasKeyboard = true;
    },
    true,
  );
  for (const type of ['pointerdown', 'mousedown', 'touchstart'] as const) {
    document.addEventListener(
      type,
      () => {
        lastInputWasKeyboard = false;
      },
      true,
    );
  }
}

export function useFocusRing() {
  const [focused, setFocused] = useState(false);
  const onFocus = useCallback(() => {
    if (lastInputWasKeyboard) setFocused(true);
  }, []);
  const onBlur = useCallback(() => setFocused(false), []);
  return { focused, onFocus, onBlur };
}
