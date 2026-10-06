import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { KeyValueStorage } from '@/services/auth/storage';

/**
 * Plain app data (not secrets): AsyncStorage on native, localStorage on web. On web, other tabs
 * of the same browser can be followed through the `storage` event (one tab finishing onboarding
 * is seen by a tab still sitting on an earlier step).
 */
export const appStorage: KeyValueStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
  subscribe(key, listener) {
    if (
      Platform.OS !== 'web' ||
      typeof window === 'undefined' ||
      typeof window.addEventListener !== 'function'
    ) {
      return () => undefined;
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      listener(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  },
};
