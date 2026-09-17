import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'endpoints/openCreateModal' }));
const openBulkModal = vi.fn(() => ({ type: 'endpoints/openBulkModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('@/features/endpoints', () => ({
  EndpointsTable: () => <div data-testid="endpoints-table-stub">endpoints</div>,
  EndpointFormModal: () => null,
  BulkCreateModal: () => null,
  SipCredentialsModal: () => null,
  endpointsPageActions: {
    openCreateModal: () => openCreateModal(),
    openBulkModal: () => openBulkModal(),
  },
}));

import { EndpointsPage } from './EndpointsPage';

describe('EndpointsPage', () => {
  it('renders title, subtitle, CTAs and table', () => {
    render(<EndpointsPage />);

    expect(screen.getByTestId('endpoints-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Абоненты' })).toBeInTheDocument();
    expect(screen.getByText('Внутренние номера и устройства')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Создать диапазон/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Добавить абонента/i })).toBeInTheDocument();
    expect(screen.getByTestId('endpoints-table-stub')).toBeInTheDocument();
  });

  it('exposes hybrid-table overflow marker at page level', () => {
    render(<EndpointsPage />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
  });

  it('opens create and bulk modals from page CTAs', async () => {
    const user = userEvent.setup();
    render(<EndpointsPage />);

    await user.click(screen.getByRole('button', { name: /Добавить абонента/i }));
    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'endpoints/openCreateModal' });

    await user.click(screen.getByRole('button', { name: /Создать диапазон/i }));
    expect(openBulkModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'endpoints/openBulkModal' });
  });
});
