import { useEffect, useRef } from 'react';
import type { View } from 'react-native';

import {
  activeElement,
  dialogKey,
  isWeb,
  tabbables,
  type KeyEventLike,
  type RootLike,
} from './webA11y';

/**
 * Keyboard behaviour for an in-page dialog (a confirmation, a pause card): Escape closes it, Tab
 * stays inside it (`trap`), focus moves into it when it opens (`autoFocus`) and back to where it
 * was when it closes. Spread `props` and attach `ref` to the dialog's outermost View. On native it
 * does nothing.
 */
export function useDialog({
  onClose,
  trap = false,
  autoFocus = true,
}: {
  onClose?: () => void;
  trap?: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<View>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!isWeb) return;
    const before = activeElement() as { focus?: () => void; isConnected?: boolean } | null;
    const root = ref.current as unknown as (RootLike & { focus: () => void }) | null;
    if (autoFocus && root) {
      const first = tabbables(root)[0];
      if (first) first.focus();
      else root.focus();
    }
    return () => {
      // Back to the control that opened it, unless focus already went somewhere on purpose.
      const now = activeElement() as { tagName?: string } | null;
      const stranded = !now || now.tagName === 'BODY' || (root?.contains?.(now) ?? false);
      if (stranded && before?.isConnected && before.focus) before.focus();
    };
  }, [autoFocus]);

  const props = isWeb
    ? {
        tabIndex: -1 as const,
        onKeyDown: (e: KeyEventLike) => {
          const root = (e.currentTarget as RootLike | undefined) ?? null;
          dialogKey(
            e,
            root,
            { onClose: close.current ? () => close.current?.() : undefined, trap },
            activeElement(),
          );
        },
      }
    : {};
  return { ref, props };
}
