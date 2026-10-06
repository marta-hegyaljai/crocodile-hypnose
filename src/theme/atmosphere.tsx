import React, { createContext, useContext, useMemo, useState } from 'react';

import { themes, type Atmosphere, type Theme } from './themes';

interface AtmosphereContextValue {
  atmosphere: Atmosphere;
  theme: Theme;
  setAtmosphere: (next: Atmosphere) => void;
}

const AtmosphereContext = createContext<AtmosphereContextValue | null>(null);

export interface AtmosphereProviderProps {
  /** Controlled atmosphere. When given, `setAtmosphere` calls `onChange` instead of local state. */
  atmosphere?: Atmosphere;
  initialAtmosphere?: Atmosphere;
  onChange?: (next: Atmosphere) => void;
  children: React.ReactNode;
}

/**
 * Provides the current atmosphere (Daylight Riverbank or Night River) and the resolved theme.
 * Nest providers to switch atmosphere for a subtree (e.g. a trance screen inside a daylight app).
 */
export function AtmosphereProvider({
  atmosphere: controlled,
  initialAtmosphere = 'daylight',
  onChange,
  children,
}: AtmosphereProviderProps) {
  const [uncontrolled, setUncontrolled] = useState<Atmosphere>(initialAtmosphere);
  const atmosphere = controlled ?? uncontrolled;

  const value = useMemo<AtmosphereContextValue>(
    () => ({
      atmosphere,
      theme: themes[atmosphere],
      setAtmosphere: (next) => {
        onChange?.(next);
        if (controlled === undefined) setUncontrolled(next);
      },
    }),
    [atmosphere, controlled, onChange],
  );

  return <AtmosphereContext.Provider value={value}>{children}</AtmosphereContext.Provider>;
}

/** Current atmosphere and a setter. Falls back to Daylight outside a provider so components stay usable in isolation. */
export function useAtmosphere(): AtmosphereContextValue {
  const ctx = useContext(AtmosphereContext);
  if (ctx) return ctx;
  return {
    atmosphere: 'daylight',
    theme: themes.daylight,
    setAtmosphere: () => {
      if (__DEV__) console.warn('setAtmosphere called outside an AtmosphereProvider');
    },
  };
}

/** The resolved theme for the current atmosphere. */
export function useTheme(): Theme {
  return useAtmosphere().theme;
}
