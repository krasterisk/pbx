import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('@/features/cloud-admin', () => ({
  TenantsTable: () => <div data-testid="tenants-table-stub">tenants</div>,
  TenantFormModal: () => null,
}));

vi.mock('@/features/cloud-admin/ui/SellerSettingsForm/SellerSettingsForm', () => ({
  SellerSettingsForm: () => <div data-testid="seller-settings-stub">settings</div>,
}));

import { PlatformTenantsPage } from './PlatformTenantsPage';

describe('PlatformTenantsPage', () => {
  it('renders title, subtitle and tenants table', () => {
    render(<PlatformTenantsPage />);

    expect(screen.getByTestId('platform-tenants-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'platform.tenantsTitle' })).toBeInTheDocument();
    expect(screen.getByText('platform.tenantsSubtitle')).toBeInTheDocument();
    expect(screen.getByTestId('tenants-table-stub')).toBeInTheDocument();
  });
});
