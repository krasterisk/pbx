import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ITenant } from '@/entities/tenant';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { tenantsPageReducer } from '../../model/slice/tenantsPageSlice';
import { TenantFormModal } from './TenantFormModal';

const mutations = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue: string }) => typeof fallback === 'object' ? fallback.defaultValue : fallback || key,
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
  useCreateTenantMutation: () => [mutations.create, { isLoading: false }],
  useUpdateTenantMutation: () => [mutations.update, { isLoading: false }],
}));

describe('TenantFormModal', () => {
  beforeEach(() => {
    mutations.create.mockReset().mockReturnValue({ unwrap: () => Promise.resolve({}) });
    mutations.update.mockReset().mockReturnValue({ unwrap: () => Promise.resolve({}) });
  });
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
  it('edits PBX tariff, nullable concurrency and organization timezone with validation', async () => {
    const tenant = { id: 7, name: 'Organization', email: 'admin@example.test', max_extensions: 10000,
      max_trunks: 10, max_queues: 10, seller_id: 5, plan_name: 'Pro', max_concurrent_calls: null,
      plan_expires_at: null, timezone: 'Asia/Krasnoyarsk' } as ITenant;
    const store = configureStore({ reducer: { tenantsPage: tenantsPageReducer }, preloadedState: {
      tenantsPage: { isModalOpen: true, modalMode: 'edit' as const, selectedTenant: tenant, searchQuery: '', statusFilter: '' },
    } });
    render(<Provider store={store}><TenantFormModal /></Provider>);
    fireEvent.click(screen.getByRole('tab', { name: 'Лимиты' }));
    const timezone = screen.getByLabelText('Часовой пояс организации (IANA)');
    expect(timezone).toHaveValue('Asia/Krasnoyarsk');
    expect(screen.getByLabelText('Макс. одновременных звонков')).toHaveValue(null);
    fireEvent.change(timezone, { target: { value: 'invalid/zone' } });
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    fireEvent.change(timezone, { target: { value: 'Europe/Berlin' } });
    fireEvent.change(screen.getByLabelText('Название тарифа АТС'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Макс. одновременных звонков'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(mutations.update).toHaveBeenCalledWith(expect.objectContaining({ id: 7,
      data: expect.objectContaining({ timezone: 'Europe/Berlin', max_concurrent_calls: 0, plan_name: null, plan_expires_at: null }) })));
  });
});
