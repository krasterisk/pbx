import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rtkApi } from './rtkApi';
import { consumeLoginReturn, LOGIN_RETURN_KEY } from '@/shared/lib/auth/loginReturn';

const flags = vi.hoisted(() => ({ impersonating: false }));
vi.mock('@/features/auth/model/authSlice', () => ({ setSession: (payload: unknown) => ({ type: 'auth/setSession', payload }) }));
vi.mock('@/features/auth/lib/impersonationSession', () => ({ accessTokenIsImpersonation: () => flags.impersonating }));

const probe = rtkApi.injectEndpoints({ endpoints: (builder) => ({
  auditLoginRedirectProbe: builder.query<unknown, void>({ query: () => '/audit-login-redirect-probe' }),
}) });
let resetStore: (() => void) | undefined;

beforeEach(() => {
  flags.impersonating = false;
  localStorage.clear();
  sessionStorage.clear();
  vi.stubEnv('VITE_API_URL', 'https://pbx.example/api');
  vi.stubEnv('VITE_VPBX_STANDALONE', 'false');
  vi.stubEnv('BASE_URL', '/v4/');
});
afterEach(() => {
  resetStore?.(); resetStore = undefined;
  localStorage.clear();
  vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

function setup(refresh: boolean) {
  const location = { href: 'https://pbx.example/v4/autodial/campaigns/18', pathname: '/v4/autodial/campaigns/18', search: '?tab=scenario', hash: '#speech' };
  const storage = localStorage;
  vi.stubGlobal('window', { location, localStorage: storage });
  localStorage.setItem('accessToken', 'expired-access');
  localStorage.setItem('user', JSON.stringify({ uniqueid: 4, vpbx_user_uid: 0 }));
  if (refresh) localStorage.setItem('refreshToken', 'rejected-refresh');
  const fetch = vi.fn(async () => new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetch);
  const store = configureStore({ reducer: { api: rtkApi.reducer, auth: () => ({ accessToken: 'expired-access' }) },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(rtkApi.middleware) });
  resetStore = () => { store.dispatch(rtkApi.util.resetApiState()); };
  return { location, fetch, run: () => store.dispatch(probe.endpoints.auditLoginRedirectProbe.initiate(undefined, { subscribe: false })) };
}

describe('authentication redirect after actual RTK unauthorized responses', () => {
  it.each([true, false])('retains the original URL and expired identity before clearing tokens (refresh=%s)', async (refresh) => {
    const test = setup(refresh); await test.run();
    expect(test.location.href).toBe('/v4/login');
    expect(consumeLoginReturn({ uniqueid: 4, vpbx_user_uid: 0 })).toBe('/autodial/campaigns/18?tab=scenario#speech');
    expect(consumeLoginReturn({ uniqueid: 4, vpbx_user_uid: 0 })).toBeNull();
  });
  it.each([
    { base: '/', refresh: false, expected: '/login' },
    { base: '/v4/', refresh: false, expected: '/v4/login' },
    { base: '/v4/', refresh: true, expected: '/v4/login' },
    { base: '/nested/pbx', refresh: true, expected: '/nested/pbx/login' },
    { base: '//external.invalid/', refresh: false, expected: '/login' },
    { base: 'https://external.invalid/pbx/', refresh: false, expected: '/login' },
    { base: '/\n/external.invalid/', refresh: false, expected: '/login' },
  ])('returns to the app login for $base / refresh=$refresh', async ({ base, refresh, expected }) => {
    vi.stubEnv('BASE_URL', base);
    const test = setup(refresh);
    expect((await test.run()).error).toMatchObject({ status: 401 });
    expect(test.fetch).toHaveBeenCalledTimes(refresh ? 2 : 1);
    expect(test.location.href).toBe(expected);
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it.each(['standalone', 'impersonation'] as const)('retains the existing %s session behavior', async (mode) => {
    if (mode === 'standalone') vi.stubEnv('VITE_VPBX_STANDALONE', 'true');
    else flags.impersonating = true;
    const test = setup(true);
    await test.run();
    expect(test.location.href).toBe('https://pbx.example/v4/autodial/campaigns/18');
    expect(test.fetch).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('accessToken')).toBe('expired-access');
    expect(sessionStorage.getItem(LOGIN_RETURN_KEY)).toBeNull();
  });
});
