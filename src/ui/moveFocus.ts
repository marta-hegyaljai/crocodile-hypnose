import { AccessibilityInfo, Platform, type Text, type View } from 'react-native';

/**
 * Moves keyboard (web) or screen-reader (native) focus to an element, e.g. into a confirmation
 * that just appeared or back to the control that opened it. Web targets that are not controls need
 * `tabIndex={-1}`.
 */
export function moveFocus(target: View | Text | null | undefined) {
  if (!target) return;
  if (Platform.OS === 'web') {
    (target as unknown as { focus?: () => void }).focus?.();
  } else {
    AccessibilityInfo.sendAccessibilityEvent(target, 'focus');
  }
}
