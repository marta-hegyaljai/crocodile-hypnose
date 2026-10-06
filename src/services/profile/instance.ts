import { AppState, Platform } from 'react-native';

import { apiUrl } from '@/config/env';
import { appAuthStore, sessionManager } from '@/services/auth/instance';

import { appStorage } from './asyncStorage';
import { createHttpProfileClient } from './profileClient';
import { createProfileStore, followAuth } from './profileStore';

/** The app's profile wiring: dev HTTP client, device storage, one store that follows the account. */
export const profileClient = createHttpProfileClient({ baseUrl: apiUrl });
export const appProfileStore = createProfileStore({
  client: profileClient,
  session: sessionManager,
  storage: appStorage,
});

followAuth(appProfileStore, appAuthStore);

// A read or write that failed is retried as soon as the browser is back online (web) and whenever
// the user comes back to the app (native and web).
if (Platform.OS === 'web' && typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('online', () => void appProfileStore.getState().flush());
}
AppState.addEventListener('change', (state) => {
  if (state === 'active') void appProfileStore.getState().flush();
});
