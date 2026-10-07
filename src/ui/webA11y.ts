import { Platform } from 'react-native';

/**
 * Web keyboard behaviour that react-native-web does not give for free: arrow keys inside a radio
 * group, Escape and a focus trap inside a dialog. The helpers take minimal DOM-like shapes so
 * they can be unit tested without a browser; on native they do nothing (no hardware keyboard
 * to speak of, and screen readers have their own gestures).
 */

export interface FocusableLike {
  focus: () => void;
  click?: () => void;
  getAttribute?: (name: string) => string | null;
  disabled?: boolean;
  closest?: (selector: string) => FocusableLike | null;
  offsetParent?: unknown;
  getClientRects?: () => { length: number };
}

export interface RootLike {
  querySelectorAll: (selector: string) => ArrayLike<FocusableLike>;
  focus?: () => void;
  contains?: (el: unknown) => boolean;
}

export interface KeyEventLike {
  key: string;
  shiftKey?: boolean;
  target?: unknown;
  currentTarget?: unknown;
  preventDefault: () => void;
  stopPropagation?: () => void;
}

const FOCUSABLE =
  'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),[role="button"],[role="radio"],[role="checkbox"],[role="tab"]';

const isDisabled = (el: FocusableLike) =>
  el.disabled === true || el.getAttribute?.('aria-disabled') === 'true';

/** A control a keyboard user can land on (not disabled, not out of tab order, not hidden). */
export function tabbables(root: RootLike): FocusableLike[] {
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => {
    if (isDisabled(el)) return false;
    if (el.getAttribute?.('tabindex') === '-1') return false;
    // Hidden by display: none (no layout boxes); skipped when the engine cannot say.
    if (el.getClientRects && el.getClientRects().length === 0) return false;
    return true;
  });
}

/** Arrow keys, Home and End move between the radios of a group and pick the one reached (unless `select` is off). */
export function radioKey(e: KeyEventLike, root: RootLike | null, select = true): boolean {
  if (!root) return false;
  const forward = e.key === 'ArrowDown' || e.key === 'ArrowRight';
  const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
  const home = e.key === 'Home';
  const end = e.key === 'End';
  if (!forward && !back && !home && !end) return false;
  const radios = Array.from(root.querySelectorAll('[role="radio"]')).filter((r) => !isDisabled(r));
  const from = (e.target as FocusableLike | undefined)?.closest?.('[role="radio"]') ?? null;
  const at = from ? radios.indexOf(from) : -1;
  if (at < 0 || radios.length === 0) return false;
  const next = home
    ? 0
    : end
      ? radios.length - 1
      : (at + (forward ? 1 : -1) + radios.length) % radios.length;
  e.preventDefault();
  const target = radios[next]!;
  target.focus();
  // Moving to a radio selects it, as native radio groups do.
  if (select && next !== at) target.click?.();
  return true;
}

/**
 * Escape asks the dialog to close; with `trap`, Tab and Shift+Tab wrap inside it. Returns true
 * when the key was handled.
 */
export function dialogKey(
  e: KeyEventLike,
  root: RootLike | null,
  opts: { onClose?: () => void; trap?: boolean },
  activeElement: unknown,
): boolean {
  if (e.key === 'Escape' && opts.onClose) {
    e.preventDefault();
    e.stopPropagation?.();
    opts.onClose();
    return true;
  }
  if (e.key === 'Tab' && opts.trap && root) {
    const items = tabbables(root);
    if (items.length === 0) {
      e.preventDefault();
      root.focus?.();
      return true;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const inside = items.includes(activeElement as FocusableLike);
    if (e.shiftKey && (activeElement === first || !inside)) {
      e.preventDefault();
      last.focus();
      return true;
    }
    if (!e.shiftKey && (activeElement === last || !inside)) {
      e.preventDefault();
      first.focus();
      return true;
    }
  }
  return false;
}

export const isWeb = Platform.OS === 'web';

export const activeElement = (): unknown =>
  typeof document === 'undefined' ? null : document.activeElement;
