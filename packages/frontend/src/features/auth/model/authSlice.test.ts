import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authReducer, logout, clearError, setSession } from './authSlice';
import type { AuthState } from './authSlice';

describe('authSlice', () => {
  const initialState: AuthState = {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
    isHydrated: true,
    error: null,
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it('should return initial state', () => {
    const state = authReducer(undefined, { type: 'unknown' });
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.isHydrated).toBe(true);
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

  it('setSession updates tokens after refresh', () => {
    const user = { id: 1, login: 'agent' } as any;
    const next = authReducer(
      { ...initialState, accessToken: 'expired', isAuthenticated: true },
      setSession({ accessToken: 'new-access', refreshToken: 'new-refresh', user }),
    );
    expect(next.accessToken).toBe('new-access');
    expect(next.refreshToken).toBe('new-refresh');
    expect(next.user).toEqual(user);
    expect(next.isAuthenticated).toBe(true);
  });
});
