import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { tenantsPageReducer } from '../../model/slice/tenantsPageSlice';
import { TenantFormModal } from './TenantFormModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('@/shared/api/endpoints/cloudAdminApi', () => ({
  useGetSellersQuery: () => ({
    data: [
      {
        id: 5,
        name: 'Default Seller',
        isDefault: true,
        inn: '',
        kpp: '',
        ogrn: '',
        address: '',
        bankName: '',
        bankBik: '',
        bankAccount: '',
        corrAccount: '',
        serviceDescription: '',
        serviceCode: '',
      },
    ],
    isLoading: false,
  }),
  useCreateTenantMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateTenantMutation: () => [vi.fn(), { isLoading: false }],
}));

describe('TenantFormModal', () => {
  it('requires seller select and preselects default on create', () => {
    const store = configureStore({
      reducer: { tenantsPage: tenantsPageReducer },
      preloadedState: {
        tenantsPage: {
          isModalOpen: true,
          modalMode: 'create' as const,
          selectedTenant: null,
          searchQuery: '',
          statusFilter: '',
        },
      },
    });

    render(
      <Provider store={store}>
        <TenantFormModal />
      </Provider>,
    );

    const select = screen.getByTestId('tenant-seller-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('5');
  });
});
