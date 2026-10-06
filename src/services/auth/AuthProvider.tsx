import React, { createContext, useContext } from 'react';
import { useStore } from 'zustand';

import type { AuthState, AuthStore } from './authStore';

const AuthStoreContext = createContext<AuthStore | null>(null);

/** Makes an auth store available to screens. The app passes the singleton; tests pass their own. */
export function AuthProvider({ store, children }: { store: AuthStore; children: React.ReactNode }) {
  return <AuthStoreContext.Provider value={store}>{children}</AuthStoreContext.Provider>;
}

export function useAuthStore(): AuthStore {
  const store = useContext(AuthStoreContext);
  if (!store) throw new Error('useAuth must be used inside an AuthProvider');
  return store;
}

/** Selects from the auth state, re-rendering only when the selected value changes. */
export function useAuth<T>(selector: (state: AuthState) => T): T {
  return useStore(useAuthStore(), selector);
}
