/**
 * Auth token storage adapter (NAV-10 / D-33).
 * Web: localStorage with the same keys as authSlice.
 * Native: @aparajita/capacitor-secure-storage (Keystore/Keychain).
 */

import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { isNativePlatform } from '@/shared/lib/capacitor/isNative';

export const TOKEN_STORAGE_KEYS = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  user: 'user',
} as const;

export type TokenStorageKey =
  (typeof TOKEN_STORAGE_KEYS)[keyof typeof TOKEN_STORAGE_KEYS];

export interface TokenStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Sync localStorage wrapper matching authSlice key names. */
export class LocalStorageTokenStorage implements TokenStorage {
  async get(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async set(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}

/** Native Secure Storage (Keystore/Keychain) — never log token values. */
export class SecureStorageTokenStorage implements TokenStorage {
  async get(key: string): Promise<string | null> {
    try {
      const value = await SecureStorage.get(key);
      if (value == null) return null;
      return typeof value === 'string' ? value : String(value);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    await SecureStorage.set(key, value);
  }

  async remove(key: string): Promise<void> {
    try {
      await SecureStorage.remove(key);
    } catch {
      // key missing is fine
    }
  }
}

export type CreateTokenStorageOptions = {
  isNative?: boolean;
  /** Injected native impl for tests. */
  nativeStorage?: TokenStorage | null;
};

/**
 * Factory for platform storage.
 * Native → SecureStorageTokenStorage (or injected mock); web → localStorage.
 */
export function createTokenStorage(
  options: CreateTokenStorageOptions = {},
): TokenStorage {
  const native = options.isNative ?? isNativePlatform();
  if (native) {
    return options.nativeStorage ?? new SecureStorageTokenStorage();
  }
  return new LocalStorageTokenStorage();
}

let defaultStorage: TokenStorage | null = null;

/** Shared adapter instance for authSlice (web localStorage / native Secure Storage). */
export function getTokenStorage(): TokenStorage {
  if (!defaultStorage) {
    defaultStorage = createTokenStorage();
  }
  return defaultStorage;
}

/** Test helper — reset singleton between suites. */
export function __resetTokenStorageForTests(storage?: TokenStorage | null): void {
  defaultStorage = storage ?? null;
}
