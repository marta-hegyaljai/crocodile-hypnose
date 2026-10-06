import { Platform } from 'react-native';

/**
 * Browsers only activate `role="button"` with Space; checkboxes, radios and tabs need Space too
 * (it is the key screen-reader users press in forms mode). Spread the result onto a Pressable.
 */
export function spaceActivates(onPress: () => void) {
  if (Platform.OS !== 'web') return {};
  return {
    onKeyDown: (e: { key: string; preventDefault: () => void }) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        onPress();
      }
    },
  };
}
