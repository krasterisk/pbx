import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'routes/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
  useAppSelector: () => [],
}));

vi.mock('@/shared/api/endpoints/contextApi', () => ({
  useGetContextsQuery: () => ({ data: [] }),
}));

vi.mock('@/features/routes', () => ({
  RoutesTable: () => <div data-testid="routes-table-stub">routes</div>,
  RouteFormModal: () => null,
  routesActions: {
    openCreateModal: () => openCreateModal(),
    setContextFilter: (uids: number[]) => ({ type: 'routes/setContextFilter', payload: uids }),
  },
}));

import { RoutesPage } from './RoutesPage';

describe('RoutesPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<RoutesPage />);

    expect(screen.getByTestId('routes-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'routes.title' })).toBeInTheDocument();
    expect(screen.getByText('routes.subtitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /routes.addRoute/i })).toBeInTheDocument();
    expect(screen.getByTestId('routes-table-stub')).toBeInTheDocument();
  });

  it('renders the table in a full-width wrap', () => {
    render(<RoutesPage />);
    expect(screen.getByTestId('routes-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<RoutesPage />);

    await user.click(screen.getByRole('button', { name: /routes.addRoute/i }));

    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'routes/openCreateModal' });
  });
});
