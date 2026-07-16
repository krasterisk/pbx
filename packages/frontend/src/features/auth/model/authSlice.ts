import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { ILoginResponse } from '@krasterisk/shared';
import {
  TOKEN_STORAGE_KEYS,
  getTokenStorage,
} from '@/features/auth/lib/tokenStorage';
import { isNativePlatform } from '@/shared/lib/capacitor/isNative';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface AuthState {
  user: ILoginResponse['user'] | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;
}

function readWebInitialState(): Pick<
  AuthState,
  'user' | 'accessToken' | 'refreshToken' | 'isAuthenticated' | 'isHydrated'
> {
  // Native: empty until hydrateAuthFromStorage (async Secure Storage).
  if (isNativePlatform()) {
    return {
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isHydrated: false,
    };
  }
  return {
    user: JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEYS.user) || 'null'),
    accessToken: localStorage.getItem(TOKEN_STORAGE_KEYS.accessToken),
    refreshToken: localStorage.getItem(TOKEN_STORAGE_KEYS.refreshToken),
    isAuthenticated: !!localStorage.getItem(TOKEN_STORAGE_KEYS.accessToken),
    isHydrated: true,
  };
}

const initialState: AuthState = {
  ...readWebInitialState(),
  isLoading: false,
  error: null,
};

async function persistSession(
  accessToken: string,
  refreshToken: string,
  user: ILoginResponse['user'],
): Promise<void> {
  const storage = getTokenStorage();
  await storage.set(TOKEN_STORAGE_KEYS.accessToken, accessToken);
  await storage.set(TOKEN_STORAGE_KEYS.refreshToken, refreshToken);
  await storage.set(TOKEN_STORAGE_KEYS.user, JSON.stringify(user));
}

async function clearPersistedSession(): Promise<void> {
  const storage = getTokenStorage();
  await storage.remove(TOKEN_STORAGE_KEYS.accessToken);
  await storage.remove(TOKEN_STORAGE_KEYS.refreshToken);
  await storage.remove(TOKEN_STORAGE_KEYS.user);
}

/** Native boot: load tokens from Secure Storage into Redux. */
export const hydrateAuthFromStorage = createAsyncThunk(
  'auth/hydrateFromStorage',
  async () => {
    const storage = getTokenStorage();
    const accessToken = await storage.get(TOKEN_STORAGE_KEYS.accessToken);
    const refreshToken = await storage.get(TOKEN_STORAGE_KEYS.refreshToken);
    const userRaw = await storage.get(TOKEN_STORAGE_KEYS.user);
    let user: ILoginResponse['user'] | null = null;
    if (userRaw) {
      try {
        user = JSON.parse(userRaw) as ILoginResponse['user'];
      } catch {
        user = null;
      }
    }
    return { accessToken, refreshToken, user };
  },
);

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { login: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!response.ok) {
        const err = await response.json();
        return rejectWithValue(err.message || 'Ошибка авторизации');
      }
      const data: ILoginResponse & { refreshToken: string } = await response.json();
      await persistSession(data.accessToken, data.refreshToken, data.user);
      return data;
    } catch {
      return rejectWithValue('Ошибка соединения с сервером');
    }
  },
);

export const authLogout = createAsyncThunk('auth/logout', async () => {
  try {
    const storage = getTokenStorage();
    const refreshToken = await storage.get(TOKEN_STORAGE_KEYS.refreshToken);
    if (refreshToken) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch (e) {
    console.error('Logout error', e);
  } finally {
    await clearPersistedSession();
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
      void clearPersistedSession();
    },
    setToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
      state.isAuthenticated = true;
      void getTokenStorage().set(TOKEN_STORAGE_KEYS.accessToken, action.payload);
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        login.fulfilled,
        (state, action: PayloadAction<ILoginResponse & { refreshToken: string }>) => {
          state.isLoading = false;
          state.isAuthenticated = true;
          state.isHydrated = true;
          state.accessToken = action.payload.accessToken;
          state.refreshToken = action.payload.refreshToken;
          state.user = action.payload.user;
        },
      )
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(authLogout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(hydrateAuthFromStorage.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.user = action.payload.user;
        state.isAuthenticated = !!action.payload.accessToken;
        state.isHydrated = true;
      })
      .addCase(hydrateAuthFromStorage.rejected, (state) => {
        state.isHydrated = true;
      });
  },
});

export const { logout, clearError, setToken } = authSlice.actions;
export const authReducer = authSlice.reducer;
