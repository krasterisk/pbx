import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { UserLevel } from '@krasterisk/shared';
import { rememberLoginReturn, LOGIN_RETURN_KEY } from '@/shared/lib/auth/loginReturn';
import { BASELINE_MODULES } from '../lib/moduleRegistry';
import type { HubModuleRow } from '../types';
const mocks = vi.hoisted(() => ({ navigate: vi.fn(), user: { uniqueid: 4, vpbx_user_uid: 0, level: 3 },
  location: { pathname: '/callcenter/supervisor', search: '', hash: '' },
  query: { data: { path: '/callcenter/supervisor' }, isFetching: false },
  hub: { navigation: [] as HubModuleRow[], active: [] as HubModuleRow[], marketplace: [], isLoading: false, isError: false } }));
vi.mock('react-router-dom', () => ({ useLocation: () => mocks.location, useNavigate: () => mocks.navigate }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppSelector: (selector: (s: { auth: { user: typeof mocks.user } }) => unknown) => selector({ auth: { user: mocks.user } }) }));
vi.mock('@/shared/api/endpoints/cloudAdminApi', () => ({ useGetRoleStartQuery: () => mocks.query }));
vi.mock('./useHubModules', () => ({ useHubModules: () => mocks.hub }));
import { ROLE_START_PENDING_KEY, useRoleStartRedirect } from './useRoleStartRedirect';

beforeEach(() => {
  sessionStorage.clear(); sessionStorage.setItem(ROLE_START_PENDING_KEY, '1'); mocks.navigate.mockReset();
  mocks.user = { uniqueid: 4, vpbx_user_uid: 0, level: UserLevel.SUPERVISOR };
  mocks.location = { pathname: '/callcenter/supervisor', search: '', hash: '' };
  mocks.query.isFetching = false;
  mocks.hub = { navigation: BASELINE_MODULES.map((m) => ({ ...m, licenseStatus: 'active', favorite: false })), active: [], marketplace: [], isLoading: false, isError: false };
});
describe('one-time authorized login return', () => {
  it('returns to the campaign with query/hash before role start and never overrides later navigation', () => {
    rememberLoginReturn('/autodial/campaigns/18?tab=scenario#speech', mocks.user);
    const view = renderHook(useRoleStartRedirect);
    expect(mocks.navigate).toHaveBeenCalledWith('/autodial/campaigns/18?tab=scenario#speech', { replace: true });
    expect(sessionStorage.getItem(LOGIN_RETURN_KEY)).toBeNull();
    expect(sessionStorage.getItem(ROLE_START_PENDING_KEY)).toBeNull();
    mocks.location.pathname = '/autodial/bases'; view.rerender(); expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });
  it('waits for both catalog and configured start without consuming the target', () => {
    rememberLoginReturn('/autodial/bases?base=12&tab=fields'); mocks.hub.isLoading = true;
    const view = renderHook(useRoleStartRedirect); expect(mocks.navigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(LOGIN_RETURN_KEY)).not.toBeNull();
    mocks.hub.isLoading = false; mocks.query.isFetching = true; view.rerender(); expect(mocks.navigate).not.toHaveBeenCalled();
    mocks.query.isFetching = false; view.rerender();
    expect(mocks.navigate).toHaveBeenCalledWith('/autodial/bases?base=12&tab=fields', { replace: true });
  });
  it.each(['locked', 'disabled', 'hidden', 'off', 'missing', 'catalog-error', 'wrong-role', 'different-user', 'different-tenant', 'stale'])('uses existing role/Hub fallback for %s', (mode) => {
    let path = '/autodial/campaigns/18';
    if (mode === 'wrong-role') path = '/callcenter/settings/queues';
    rememberLoginReturn(path, mocks.user, '/', mode === 'stale' ? Date.now() - 16 * 60_000 : Date.now());
    mocks.hub.navigation = mocks.hub.navigation.map((m) => m.code !== 'autodial' ? m : { ...m,
      ...(mode === 'locked' || mode === 'disabled' ? { licenseStatus: mode } : {}),
      ...(mode === 'hidden' ? { tenantVisible: false } : {}), ...(mode === 'off' ? { kind: 'off' } : {}) });
    if (mode === 'missing') mocks.hub.navigation = mocks.hub.navigation.filter((m) => m.code !== 'autodial');
    if (mode === 'catalog-error') mocks.hub.isError = true;
    if (mode === 'different-user') mocks.user.uniqueid = 5;
    if (mode === 'different-tenant') mocks.user.vpbx_user_uid = 9;
    renderHook(useRoleStartRedirect);
    expect(mocks.navigate).not.toHaveBeenCalledWith(path, { replace: true });
    expect(sessionStorage.getItem(LOGIN_RETURN_KEY)).toBeNull();
    expect(sessionStorage.getItem(ROLE_START_PENDING_KEY)).toBeNull();
    if (mode === 'catalog-error') expect(mocks.navigate).toHaveBeenCalledWith('/modules', { replace: true });
  });
  it('keeps SuperAdmin on platform and discards tenant return', () => {
    rememberLoginReturn('/autodial/campaigns/18'); mocks.user.level = UserLevel.SUPERADMIN; mocks.hub.isLoading = true;
    renderHook(useRoleStartRedirect); expect(mocks.navigate).toHaveBeenCalledWith('/platform', { replace: true });
    expect(sessionStorage.getItem(LOGIN_RETURN_KEY)).toBeNull();
  });
});
