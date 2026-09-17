import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'notificationsPage/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('../../model/slice/notificationsPageSlice', () => ({
  notificationsPageActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

vi.mock('../NotificationIntegrationsTable', () => ({
  NotificationIntegrationsTable: () => (
    <div data-testid="notifications-table-stub">notifications</div>
  ),
}));

vi.mock('../NotificationIntegrationFormModal/NotificationIntegrationFormModal', () => ({
  NotificationIntegrationFormModal: () => null,
}));

import { NotificationIntegrationsPage } from './NotificationIntegrationsPage';

describe('NotificationIntegrationsPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<NotificationIntegrationsPage />);

    expect(screen.getByTestId('notifications-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Интеграции уведомлений' })).toBeInTheDocument();
    expect(screen.getByText('Каналы доставки уведомлений из маршрутов')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Создать интеграцию/i })).toBeInTheDocument();
    expect(screen.getByTestId('notifications-table-stub')).toBeInTheDocument();
  });

  it('renders the table in a full-width wrap', () => {
    render(<NotificationIntegrationsPage />);
    expect(screen.getByTestId('notifications-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<NotificationIntegrationsPage />);

    await user.click(screen.getByRole('button', { name: /Создать интеграцию/i }));

    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'notificationsPage/openCreateModal' });
  });
});
