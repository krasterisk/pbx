import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authReducer, logout, clearError } from './authSlice';
import type { AuthState } from './authSlice';

describe('authSlice', () => {
  const initialState: AuthState = {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it('should return initial state', () => {
    expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle logout', () => {
    const state: AuthState = {
      ...initialState,
      user: { id: 1, currentTenant: { id: 1 } } as any,
      accessToken: 'token',
      refreshToken: 'refresh',
      isAuthenticated: true,
    };
    const nextState = authReducer(state, logout());
    expect(nextState.user).toBeNull();
    expect(nextState.accessToken).toBeNull();
    expect(nextState.isAuthenticated).toBe(false);
  });

  it('should handle clearError', () => {
    const state: AuthState = { ...initialState, error: 'some error' };
    const nextState = authReducer(state, clearError());
    expect(nextState.error).toBeNull();
  });
});
