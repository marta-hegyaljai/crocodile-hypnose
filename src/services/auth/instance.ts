import { apiUrl, authClientId } from '@/config/env';

import { createAuthStore } from './authStore';
import { createHttpAuthClient } from './httpAuthClient';
import { createRefreshLock } from './lock';
import { secureStorage } from './secureStorage';
import { createSessionManager } from './sessionManager';
import { createSessionStore } from './storage';

/** The app's auth wiring: dev HTTP client, platform secure storage, one store. */
export const authClient = createHttpAuthClient({ baseUrl: apiUrl, clientId: authClientId });
export const sessionManager = createSessionManager({
  client: authClient,
  store: createSessionStore(secureStorage),
  lock: createRefreshLock(),
});
export const appAuthStore = createAuthStore({ client: authClient, session: sessionManager });
