import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async submit at most once at a time (rapid taps and Enter presses are ignored while
 * one is running) and never sets state after unmount.
 */
export function useSubmit<A extends unknown[]>(action: (...args: A) => Promise<void>) {
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);
  const latest = useRef(action);

  useEffect(() => {
    latest.current = action;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args: A) => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    try {
      await latest.current(...args);
    } finally {
      running.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);

  return { run, pending };
}
