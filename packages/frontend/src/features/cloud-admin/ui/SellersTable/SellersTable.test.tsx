import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import type { IBillingSeller } from '@/entities/tenant';
import { SellersTable } from './SellersTable';

const sellers: IBillingSeller[] = [
  {
    id: 1,
    name: 'Default Seller',
    inn: '7700000000',
    kpp: '',
    ogrn: '',
    address: '',
    bankName: '',
    bankBik: '',
    bankAccount: '',
    corrAccount: '',
    serviceDescription: '',
    serviceCode: '',
    isDefault: true,
  },
  {
    id: 2,
    name: 'Alt Seller',
    inn: '7800000000',
    kpp: '',
    ogrn: '',
    address: '',
    bankName: '',
    bankBik: '',
    bankAccount: '',
    corrAccount: '',
    serviceDescription: '',
    serviceCode: '',
    isDefault: false,
  },
];

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('@/shared/api/endpoints/cloudAdminApi', () => ({
  useGetSellersQuery: () => ({ data: sellers, isLoading: false }),
  useDeleteSellerMutation: () => [vi.fn(), { isLoading: false }],
  useSetDefaultSellerMutation: () => [vi.fn(), { isLoading: false }],
  useCreateSellerMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateSellerMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('../SellerFormModal/SellerFormModal', () => ({
  SellerFormModal: () => null,
}));

function renderTable() {
  const store = configureStore({ reducer: { _: (s = {}) => s } });
  return render(
    <Provider store={store}>
      <SellersTable />
    </Provider>,
  );
}

describe('SellersTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sellers and default badge', () => {
    renderTable();
    expect(screen.getByTestId('sellers-table')).toBeInTheDocument();
    expect(screen.getByText('Default Seller')).toBeInTheDocument();
    expect(screen.getByText('Alt Seller')).toBeInTheDocument();
    expect(screen.getByTestId('seller-default-1')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-chat-usage')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-chat-default-model')).not.toBeInTheDocument();
  });
});
