import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import type { ITenant } from '@/entities/tenant';
import { tenantsPageReducer } from '../../model/slice/tenantsPageSlice';
import { TenantDrawer } from './TenantDrawer';

const enableHub = vi.fn();
const disableHub = vi.fn();
const grantHub = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: string | Record<string, unknown>) =>
      typeof fallbackOrOpts === 'string' ? fallbackOrOpts : key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/shared/api/endpoints/cloudAdminApi', () => ({
  useGetTenantBalanceQuery: () => ({ data: undefined, isLoading: false }),
  useGetTenantTransactionsQuery: () => ({ data: { rows: [] }, isLoading: false }),
  useGetTenantHubCatalogQuery: () => ({
    data: [
      { code: 'ai', name: 'AI', kind: 'market', sort_order: 20, licenseStatus: 'active', pages: [] },
      { code: 'analytics', name: 'Analytics', kind: 'market', sort_order: 30, licenseStatus: 'locked', pages: [] },
      {
        code: 'speech_analytics',
        name: 'Speech analytics',
        kind: 'market',
        sort_order: 80,
        licenseStatus: 'locked',
        pages: [],
      },
    ],
    isLoading: false,
  }),
  useDepositBalanceMutation: () => [vi.fn(), { isLoading: false }],
  useImpersonateTenantMutation: () => [vi.fn(), { isLoading: false }],
  useEnableTenantHubModuleMutation: () => [enableHub, { isLoading: false }],
  useDisableTenantHubModuleMutation: () => [disableHub, { isLoading: false }],
  useGrantTenantHubModuleMutation: () => [grantHub, { isLoading: false }],
  useGetSellersQuery: () => ({
    data: [{ id: 1, name: 'Default Seller', isDefault: true }],
    isLoading: false,
  }),
  useUpdateTenantMutation: () => [vi.fn(), { isLoading: false }],
}));

const tenant = {
  id: 12,
  uid: 'acme',
  name: 'Acme',
  slug: 'acme',
  owner_user_id: 4,
  vpbx_user_uid: 8,
  status: 'active',
  trial_ends_at: null,
  email: null,
  phone: null,
  company_inn: null,
  seller_id: 1,
  seller: { id: 1, name: 'Default Seller' },
  max_extensions: 10,
  max_trunks: 2,
  max_queues: 1,
  created_by: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
} as ITenant;

function renderDrawer() {
  const store = configureStore({
    reducer: { tenantsPage: tenantsPageReducer },
    preloadedState: {
      tenantsPage: {
        isModalOpen: false,
        modalMode: 'create' as const,
        selectedTenant: tenant,
        searchQuery: '',
        statusFilter: '',
      },
    },
  });
  return render(
    <Provider store={store}>
      <TenantDrawer />
    </Provider>,
  );
}

describe('TenantDrawer hub entitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enableHub.mockResolvedValue({});
    disableHub.mockResolvedValue({});
    grantHub.mockResolvedValue({});
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('disables and grants the selected cabinet, not the marketplace JWT', () => {
    renderDrawer();
    fireEvent.click(screen.getByText('Модули'));
    fireEvent.click(screen.getByLabelText('AI Acme'));
    expect(disableHub).toHaveBeenCalledWith({ tenantId: 12, code: 'ai' });
    fireEvent.click(screen.getByTestId('platform-tenant-grant-analytics'));
    expect(grantHub).toHaveBeenCalledWith({ tenantId: 12, code: 'analytics', access: 'open', trialDays: undefined });
  });

  it('opens a locked AI product and can start a trial', () => {
    renderDrawer();
    fireEvent.click(screen.getByText('Модули'));
    expect(screen.getByTestId('platform-tenant-module-speech_analytics')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('platform-tenant-grant-speech_analytics'));
    expect(grantHub).toHaveBeenCalledWith({
      tenantId: 12, code: 'speech_analytics', access: 'open', trialDays: undefined,
    });
    fireEvent.change(screen.getByTestId('platform-tenant-trial-days-speech_analytics'), {
      target: { value: '21' },
    });
    fireEvent.click(screen.getByTestId('platform-tenant-trial-speech_analytics'));
    expect(grantHub).toHaveBeenCalledWith({
      tenantId: 12, code: 'speech_analytics', access: 'trial', trialDays: 21,
    });
    expect(enableHub).not.toHaveBeenCalledWith({ tenantId: 12, code: 'speech_analytics' });
  });
});
