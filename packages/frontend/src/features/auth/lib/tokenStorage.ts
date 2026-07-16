/**
 * Auth token storage adapter (NAV-10 / D-33 prep).
 * Web: localStorage with the same keys as authSlice.
 * Native Secure Storage is wired in plan 08-10 — interface stays mockable here.
 */

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

export type CreateTokenStorageOptions = {
  isNative?: boolean;
  /** Injected native impl for tests / future Capacitor Secure Storage (08-10). */
  nativeStorage?: TokenStorage | null;
};

/**
 * Factory for platform storage. Native without an impl returns null
 * (placeholder until Capacitor Secure Storage lands in 08-10).
 */
export function createTokenStorage(
  options: CreateTokenStorageOptions = {},
): TokenStorage | null {
  if (options.isNative) {
    return options.nativeStorage ?? null;
  }
  return new LocalStorageTokenStorage();
}
