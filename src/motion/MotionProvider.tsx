import React, { createContext, useContext, useMemo, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * One shared subscription to the platform "reduce motion" setting (iOS, Android, and
 * `prefers-reduced-motion` on web), read synchronously by every consumer.
 */
const listeners = new Set<() => void>();
let systemReduced: boolean =
  Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
let subscribed = false;

function setSystemReduced(value: boolean) {
  if (value === systemReduced) return;
  systemReduced = value;
  listeners.forEach((l) => l());
}

function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then((value) => setSystemReduced(Boolean(value)))
    .catch(() => undefined);
  AccessibilityInfo.addEventListener('reduceMotionChanged', (value) =>
    setSystemReduced(Boolean(value)),
  );
}

function subscribe(listener: () => void) {
  ensureSubscribed();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => systemReduced;

/** The raw system setting. */
export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Test hook: reset the store between tests. */
export function __resetReducedMotionStoreForTests(value = false) {
  systemReduced = value;
  subscribed = false;
  listeners.clear();
}

interface MotionContextValue {
  /** True when animations should be minimal (system setting, or forced). */
  reducedMotion: boolean;
  /** The raw system setting. */
  systemReducedMotion: boolean;
  /** Dev / QA override: `true` forces reduced motion, `false` forces full motion, `null` follows the system. */
  override: boolean | null;
  setOverride: (value: boolean | null) => void;
}

const MotionContext = createContext<MotionContextValue | null>(null);

export function MotionProvider({
  children,
  initialOverride = null,
}: {
  children: React.ReactNode;
  initialOverride?: boolean | null;
}) {
  const systemReducedMotion = useSystemReducedMotion();
  const [override, setOverride] = useState<boolean | null>(initialOverride);
  const value = useMemo<MotionContextValue>(
    () => ({
      reducedMotion: override ?? systemReducedMotion,
      systemReducedMotion,
      override,
      setOverride,
    }),
    [override, systemReducedMotion],
  );
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

/** Whether to skip or simplify animations. Safe to call outside a provider (falls back to the system setting). */
export function useReducedMotion(): boolean {
  const ctx = useContext(MotionContext);
  const system = useSystemReducedMotion();
  return ctx ? ctx.reducedMotion : system;
}

export function useMotionSettings(): MotionContextValue {
  const ctx = useContext(MotionContext);
  if (!ctx) throw new Error('useMotionSettings must be used inside a MotionProvider');
  return ctx;
}
