import { AppState, Platform } from 'react-native';

import { apiUrl } from '@/config/env';
import { appAuthStore, sessionManager } from '@/services/auth/instance';
import { appStorage } from '@/services/profile/asyncStorage';
import { appProfileStore } from '@/services/profile/instance';

import { createHttpGamificationClient } from './client';
import { createGamificationStore, followAuthForGamification } from './store';

/** The app's gamification wiring: dev HTTP client, device storage, follows the account. */
export const gamificationClient = createHttpGamificationClient({ baseUrl: apiUrl });
export const appGamificationStore = createGamificationStore({
  client: gamificationClient,
  session: sessionManager,
  storage: appStorage,
  profile: appProfileStore,
});

followAuthForGamification(appGamificationStore, appAuthStore);

if (Platform.OS === 'web' && typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('online', () => void appGamificationStore.getState().flush());
}
AppState.addEventListener('change', (state) => {
  if (state === 'active') void appGamificationStore.getState().flush();
});
