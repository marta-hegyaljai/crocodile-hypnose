import React, { createContext, useContext } from 'react';
import { useStore } from 'zustand';

import type { ProfileState, ProfileStore } from './profileStore';

const ProfileStoreContext = createContext<ProfileStore | null>(null);

/** Makes the profile store available to screens. The app passes the singleton; tests their own. */
export function ProfileProvider({
  store,
  children,
}: {
  store: ProfileStore;
  children: React.ReactNode;
}) {
  return <ProfileStoreContext.Provider value={store}>{children}</ProfileStoreContext.Provider>;
}

export function useProfileStore(): ProfileStore {
  const store = useContext(ProfileStoreContext);
  if (!store) throw new Error('useProfile must be used inside a ProfileProvider');
  return store;
}

/** Selects from the profile state, re-rendering only when the selected value changes. */
export function useProfile<T>(selector: (state: ProfileState) => T): T {
  return useStore(useProfileStore(), selector);
}
