import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiProductLandingPage } from './AiProductLandingPage';
import { resolveAiProductLandingState } from './resolveAiProductLandingState';

const authState = vi.hoisted(() => ({ superAdmin: false }));
const entitleCurrent = vi.hoisted(() => vi.fn());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/features/modules/hooks/useHubModules', () => ({
  useHubModules: () => ({
    active: [],
    marketplace: [{ code: 'speech_analytics', licenseStatus: 'locked' }],
    isLoading: false,
  }),
}));

vi.mock('@/shared/api/endpoints/aiAgentsApi', () => ({
  useGetAiProvidersQuery: () => ({ data: [] }),
}));

vi.mock('@/shared/api/endpoints/cloudAdminApi', () => ({
  useGetAiProductsStatusQuery: () => ({
    data: [{ product: 'speech_analytics', allowed: false, reason: 'not_entitled' }],
    isLoading: false,
  }),
  useEntitleCurrentAiProductMutation: () => [entitleCurrent, { isLoading: false }],
}));

vi.mock('@/shared/api/endpoints/integrationsApi', () => ({
  useSetProductActivationMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('@/entities/User', () => ({
  selectIsSuperAdmin: () => authState.superAdmin,
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (sel: () => unknown) => sel(),
}));

describe('resolveAiProductLandingState', () => {
  it('maps locked, expired, not installed and unavailable without flashing ready', () => {
    expect(resolveAiProductLandingState({ loading: true, configured: true, allowed: true }))
      .toBe('pending');
    expect(resolveAiProductLandingState({
      loading: false, configured: true, allowed: false, reason: 'not_entitled', licenseStatus: 'locked',
    })).toBe('locked');
    expect(resolveAiProductLandingState({
      loading: false, configured: true, allowed: false, reason: 'entitlement_expired',
    })).toBe('expired');
    expect(resolveAiProductLandingState({
      loading: false, configured: true, allowed: false, reason: 'package_missing',
    })).toBe('notInstalled');
    expect(resolveAiProductLandingState({
      loading: false, configured: true, allowed: false, reason: 'runtime_unavailable',
    })).toBe('unavailable');
    expect(resolveAiProductLandingState({
      loading: false, configured: false, allowed: true,
    })).toBe('notConfigured');
    expect(resolveAiProductLandingState({
      loading: false, configured: true, allowed: true,
    })).toBe('ready');
  });
});

describe('AiProductLandingPage', () => {
  beforeEach(() => {
    authState.superAdmin = false;
    entitleCurrent.mockReset();
    entitleCurrent.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  });

  it('shows locked state without flashing project UI', () => {
    render(
      <MemoryRouter>
        <AiProductLandingPage product="speech_analytics" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('ai-product-landing-speech_analytics')).toBeInTheDocument();
    expect(screen.getByText('aiProducts.states.locked.title')).toBeInTheDocument();
    expect(screen.queryByText('aiProducts.openConnections')).not.toBeInTheDocument();
    expect(screen.queryByText('aiProducts.entitleCurrent')).not.toBeInTheDocument();
  });

  it('lets SuperAdmin grant the JWT cabinet or open tenants', () => {
    authState.superAdmin = true;
    render(
      <MemoryRouter>
        <AiProductLandingPage product="speech_analytics" />
      </MemoryRouter>,
    );
    expect(screen.getByText('aiProducts.states.locked.superadminHint')).toBeInTheDocument();
    fireEvent.click(screen.getByText('aiProducts.entitleCurrent'));
    expect(entitleCurrent).toHaveBeenCalledWith({ code: 'speech_analytics' });
    expect(screen.getByText('aiProducts.openTenants')).toBeInTheDocument();
  });
});
