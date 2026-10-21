import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { BASELINE_MODULES } from '@/features/modules/lib/moduleRegistry';
import { LOGIN_RETURN_KEY, rememberLoginReturn } from '@/shared/lib/auth/loginReturn';
import type { ReactNode } from 'react';
const mocks = vi.hoisted(() => ({ level: 3, allowed: true }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, fallback?: string | { year?: number }) => typeof fallback === 'string' ? fallback : key, i18n: { language: 'ru', changeLanguage: vi.fn() } }) }));
vi.mock('@/shared/api/endpoints/authApi', () => ({ useGetAuthConfigQuery: () => ({ data: { registrationEnabled: false } }) }));
vi.mock('@/shared/api/endpoints/cloudAdminApi', () => ({ useGetRoleStartQuery: () => ({ data: { path: '/callcenter/supervisor' }, isFetching: false }) }));
vi.mock('@/features/modules/hooks/useHubModules', () => ({ ModuleNavProvider: ({ children }: { children: ReactNode }) => children,
  useHubModules: () => ({ navigation: BASELINE_MODULES.map((m) => ({ ...m, licenseStatus: m.code === 'autodial' && !mocks.allowed ? 'locked' : 'active' })), active: [], marketplace: [], isLoading: false, isError: false }) }));
vi.mock('@/widgets/ModuleShell', () => ({ ModuleShell: ({ children }: { children: ReactNode }) => children }));
// Login navigation uses an auth-only store; the phone owner's API and transport have their own integration tests.
vi.mock('@/features/phone/PhoneSessionHost', () => ({ PhoneSessionHost: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/widgets/MobileBottomBar', () => ({ MobileBottomBar: () => null }));
vi.mock('@/features/tenant-settings/ui/TablePageSizeProvider/TablePageSizeProvider', () => ({ TablePageSizeProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/shared/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
import { authReducer } from '@/features/auth/model/authSlice';
import { AppLayout } from '@/app/layouts/AppLayout';
import { AuthLogin } from './AuthLogin';
function Address() { const location = useLocation(); return <output data-testid="address">{location.pathname + location.search + location.hash}</output>; }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); mocks.level = 3; mocks.allowed = true;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ accessToken: 'unit-access', refreshToken: 'unit-refresh', user: { uniqueid: 4, vpbx_user_uid: 0, level: mocks.level, login: 'supervisor' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
});
afterEach(() => vi.unstubAllGlobals());
async function signIn() {
  fireEvent.change(await screen.findByLabelText('auth.loginPlaceholder'), { target: { value: 'supervisor' } });
  fireEvent.change(screen.getByLabelText('auth.passwordPlaceholder'), { target: { value: 'unit-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'auth.signIn' }));
}
function open(path: string, base: string) {
  const store = configureStore({ reducer: { auth: authReducer }, preloadedState: { auth: { user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isHydrated: true, isLoading: false, error: null } } });
  return render(<Provider store={store}><MemoryRouter basename={base} initialEntries={[path]}><Routes>
    <Route path="/login" element={<AuthLogin />} />
    <Route path="/platform" element={<Address />} />
    <Route path="/" element={<AppLayout />}><Route path="*" element={<Address />} /></Route>
  </Routes></MemoryRouter></Provider>);
}
describe('real Router and Redux login return', () => {
  it.each(['/', '/v4'])('preserves a cold deep link through login at basename %s', async (base) => {
    open((base === '/' ? '' : base) + '/autodial/campaigns/18?tab=scenario#speech', base);
    await signIn();
    await waitFor(() => expect(screen.getByTestId('address')).toHaveTextContent('/autodial/campaigns/18?tab=scenario#speech'));
    expect(sessionStorage.getItem(LOGIN_RETURN_KEY)).toBeNull();
  });
  it('falls back to the role when the module is unavailable', async () => {
    mocks.allowed = false; open('/v4/autodial/campaigns/18', '/v4'); await signIn();
    await waitFor(() => expect(screen.getByTestId('address')).toHaveTextContent('/callcenter/supervisor'));
    expect(sessionStorage.getItem(LOGIN_RETURN_KEY)).toBeNull();
  });
  it('keeps normal login without a saved page', async () => {
    open('/v4/login', '/v4'); await signIn(); await waitFor(() => expect(screen.getByTestId('address')).toHaveTextContent('/callcenter/supervisor'));
  });
  it('keeps SuperAdmin on platform and clears tenant pending state', async () => {
    mocks.level = 0; rememberLoginReturn('/autodial/campaigns/18'); open('/v4/login', '/v4'); await signIn();
    await waitFor(() => expect(screen.getByTestId('address')).toHaveTextContent('/platform')); expect(sessionStorage.getItem(LOGIN_RETURN_KEY)).toBeNull();
  });
});
