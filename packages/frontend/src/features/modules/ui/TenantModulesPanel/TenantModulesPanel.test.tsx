import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { UserLevel } from '@krasterisk/shared';
import { TenantModulesPanel } from './TenantModulesPanel';

const enableModule = vi.fn();
const disableModule = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: string | Record<string, unknown>) =>
      typeof fallbackOrOpts === 'string' ? fallbackOrOpts : key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/shared/api/endpoints/cloudAdminApi', () => ({
  useGetHubCatalogQuery: () => ({
    data: [
      {
        code: 'core',
        name: 'Core',
        kind: 'base',
        sort_order: 10,
        requires_cloud: false,
        licenseStatus: 'active',
        pages: [{ page_code: 'endpoints', path: '/endpoints', sort_order: 10 }],
      },
      {
        code: 'ai',
        name: 'AI',
        kind: 'market',
        sort_order: 20,
        requires_cloud: false,
        licenseStatus: 'disabled',
        pages: [{ page_code: 'ai_agents', path: '/ai-agents', sort_order: 10 }],
      },
      {
        code: 'analytics',
        name: 'Analytics',
        kind: 'market',
        sort_order: 30,
        requires_cloud: false,
        licenseStatus: 'locked',
        pages: [{ page_code: 'cdr', path: '/reports/cdr', sort_order: 10 }],
      },
    ],
    isLoading: false,
  }),
  useEnableHubModuleMutation: () => [enableModule, { isLoading: false }],
  useDisableHubModuleMutation: () => [disableModule, { isLoading: false }],
  usePurchaseModuleMutation: () => [vi.fn(), { isLoading: false }],
}));

function renderPanel(level: UserLevel = UserLevel.ADMIN) {
  const store = configureStore({
    reducer: {
      auth: () => ({ isAuthenticated: true, user: { level } }),
    },
  });
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <TenantModulesPanel />
      </MemoryRouter>
    </Provider>,
  );
}

describe('TenantModulesPanel (D-22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('renders System Modules rows without membership editor controls', () => {
    renderPanel();
    expect(screen.getByTestId('tenant-modules-panel')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-no-membership-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('platform-membership-editor')).not.toBeInTheDocument();
    expect(screen.queryByText('platform.saveMembership')).not.toBeInTheDocument();
    expect(screen.getByTestId('tenant-module-pages-core')).toHaveTextContent('endpoints');
  });

  it('enable/disable calls tenant Hub APIs only', async () => {
    enableModule.mockResolvedValue({});
    renderPanel();
    const toggle = screen.getByLabelText(/AI/);
    fireEvent.click(toggle);
    expect(enableModule).toHaveBeenCalledWith('ai');
    expect(disableModule).not.toHaveBeenCalled();
  });

  it('Buy for locked opens CheckoutSheet', () => {
    renderPanel();
    fireEvent.click(screen.getByText('Buy'));
    expect(screen.getByTestId('checkout-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-step-plan')).toBeInTheDocument();
  });
});
