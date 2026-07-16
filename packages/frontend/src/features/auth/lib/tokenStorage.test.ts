import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LocalStorageTokenStorage,
  SecureStorageTokenStorage,
  TOKEN_STORAGE_KEYS,
  createTokenStorage,
} from './tokenStorage';

const secureStore = new Map<string, string>();

vi.mock('@aparajita/capacitor-secure-storage', () => ({
  SecureStorage: {
    get: vi.fn(async (key: string) => secureStore.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      secureStore.set(key, String(value));
    }),
    remove: vi.fn(async (key: string) => {
      const existed = secureStore.has(key);
      secureStore.delete(key);
      return existed;
    }),
  },
}));

describe('TokenStorage (NAV-10)', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    secureStore.clear();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
      }),
    });
  });

  it('LocalStorageTokenStorage round-trips accessToken, refreshToken, and user', async () => {
    const storage = new LocalStorageTokenStorage();

    await storage.set(TOKEN_STORAGE_KEYS.accessToken, 'access-1');
    await storage.set(TOKEN_STORAGE_KEYS.refreshToken, 'refresh-1');
    await storage.set(TOKEN_STORAGE_KEYS.user, JSON.stringify({ id: 1 }));

    expect(await storage.get(TOKEN_STORAGE_KEYS.accessToken)).toBe('access-1');
    expect(await storage.get(TOKEN_STORAGE_KEYS.refreshToken)).toBe('refresh-1');
    expect(await storage.get(TOKEN_STORAGE_KEYS.user)).toBe(JSON.stringify({ id: 1 }));

    await storage.remove(TOKEN_STORAGE_KEYS.accessToken);
    await storage.remove(TOKEN_STORAGE_KEYS.refreshToken);
    await storage.remove(TOKEN_STORAGE_KEYS.user);

    expect(await storage.get(TOKEN_STORAGE_KEYS.accessToken)).toBeNull();
    expect(await storage.get(TOKEN_STORAGE_KEYS.refreshToken)).toBeNull();
    expect(await storage.get(TOKEN_STORAGE_KEYS.user)).toBeNull();
  });

  it('uses the same key names as authSlice (accessToken/refreshToken/user)', () => {
    expect(TOKEN_STORAGE_KEYS.accessToken).toBe('accessToken');
    expect(TOKEN_STORAGE_KEYS.refreshToken).toBe('refreshToken');
    expect(TOKEN_STORAGE_KEYS.user).toBe('user');
  });

  it('createTokenStorage returns LocalStorageTokenStorage for web (non-native)', () => {
    const storage = createTokenStorage({ isNative: false });
    expect(storage).toBeInstanceOf(LocalStorageTokenStorage);
  });

  it('createTokenStorage native path is mockable without Capacitor', () => {
    const native = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };
    const storage = createTokenStorage({ isNative: true, nativeStorage: native });
    expect(storage).toBe(native);
  });

  it('createTokenStorage native without inject uses SecureStorageTokenStorage', () => {
    const storage = createTokenStorage({ isNative: true });
    expect(storage).toBeInstanceOf(SecureStorageTokenStorage);
  });

  it('SecureStorageTokenStorage round-trips via SecureStorage mock', async () => {
    const storage = new SecureStorageTokenStorage();
    await storage.set(TOKEN_STORAGE_KEYS.accessToken, 'nat-access');
    await storage.set(TOKEN_STORAGE_KEYS.refreshToken, 'nat-refresh');
    expect(await storage.get(TOKEN_STORAGE_KEYS.accessToken)).toBe('nat-access');
    expect(await storage.get(TOKEN_STORAGE_KEYS.refreshToken)).toBe('nat-refresh');
    await storage.remove(TOKEN_STORAGE_KEYS.accessToken);
    expect(await storage.get(TOKEN_STORAGE_KEYS.accessToken)).toBeNull();
  });
});
