/* eslint-disable @typescript-eslint/no-require-imports */
import type { KeyValueStorage } from './storage';

jest.mock('expo-secure-store', () => {
  const data = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDevice',
    getItemAsync: jest.fn(async (key: string) => data.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      data.delete(key);
    }),
  };
});

describe('native secure storage', () => {
  it('uses the keychain with this-device-only access', async () => {
    const SecureStore = require('expo-secure-store');
    const { secureStorage } = require('./secureStorage.native') as {
      secureStorage: KeyValueStorage;
    };
    await secureStorage.setItem('k', 'v');
    expect(await secureStorage.getItem('k')).toBe('v');
    await secureStorage.removeItem('k');
    expect(await secureStorage.getItem('k')).toBeNull();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('k', 'v', {
      keychainAccessible: 'afterFirstUnlockThisDevice',
    });
  });
});

describe('web storage fallback', () => {
  const load = () =>
    (require('./secureStorage.ts') as { secureStorage: KeyValueStorage }).secureStorage;
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');

  afterEach(() => {
    if (original) Object.defineProperty(window, 'localStorage', original);
    jest.resetModules();
  });

  function fakeLocalStorage() {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  }

  it('persists in localStorage', async () => {
    const ls = fakeLocalStorage();
    Object.defineProperty(window, 'localStorage', { value: ls, configurable: true });
    const storage = load();
    await storage.setItem('k', 'v');
    expect(ls.data.get('k')).toBe('v');
    expect(await storage.getItem('k')).toBe('v');
    await storage.removeItem('k');
    expect(ls.data.has('k')).toBe(false);
  });

  it('falls back to memory when localStorage is blocked', async () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    const storage = load();
    await storage.setItem('k', 'v');
    expect(await storage.getItem('k')).toBe('v');
    await storage.removeItem('k');
    expect(await storage.getItem('k')).toBeNull();
  });
});
