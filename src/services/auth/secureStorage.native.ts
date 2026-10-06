/** iOS Keychain / Android Keystore via expo-secure-store. */
import * as SecureStore from 'expo-secure-store';

import type { KeyValueStorage } from './storage';

const options: SecureStore.SecureStoreOptions = {
  // Readable after the first unlock, so a background refresh works; never synced to other devices.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const secureStorage: KeyValueStorage = {
  getItem: (key) => SecureStore.getItemAsync(key, options),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
  removeItem: (key) => SecureStore.deleteItemAsync(key, options),
};
