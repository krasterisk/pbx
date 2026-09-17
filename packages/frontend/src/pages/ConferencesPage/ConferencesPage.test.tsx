import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'conferencesPage/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('@/features/conferences/model/slice/conferencesPageSlice', () => ({
  conferencesPageActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

vi.mock('@/features/conferences/ui/ConferencesTable', () => ({
  ConferencesTable: () => <div data-testid="conferences-table-stub">conferences</div>,
}));

vi.mock('@/features/conferences/ui/ConferenceRoomFormModal', () => ({
  ConferenceRoomFormModal: () => null,
}));

import { ConferencesPage } from './ConferencesPage';

describe('ConferencesPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<ConferencesPage />);

    expect(screen.getByTestId('conferences-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'conferences.title' })).toBeInTheDocument();
    expect(screen.getByText('conferences.subtitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /conferences.addRoom/i })).toBeInTheDocument();
    expect(screen.getByTestId('conferences-table-stub')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('renders the table in a full-width wrap', () => {
    render(<ConferencesPage />);
    expect(screen.getByTestId('conferences-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<ConferencesPage />);

    await user.click(screen.getByRole('button', { name: /conferences.addRoom/i }));

    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'conferencesPage/openCreateModal' });
  });
});
