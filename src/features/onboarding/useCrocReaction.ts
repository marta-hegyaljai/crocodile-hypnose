import { useCallback, useEffect, useRef, useState } from 'react';

import type { CrocExpression } from '@/illustration';

/**
 * The croc (or the egg) reacts to an answer for a moment and settles back. Returns the current
 * expression and a function to trigger a reaction.
 */
export function useCrocReaction(rest: CrocExpression = 'calm', holdMs = 1400) {
  const [expression, setExpression] = useState<CrocExpression>(rest);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const react = useCallback(
    (to: CrocExpression = 'happy') => {
      setExpression(to);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setExpression(rest), holdMs);
    },
    [rest, holdMs],
  );

  return [expression, react] as const;
}
