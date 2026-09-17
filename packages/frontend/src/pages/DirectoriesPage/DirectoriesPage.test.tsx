import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'directories/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
  useAppSelector: () => false,
}));

vi.mock('@/features/directories', () => ({
  DirectoriesTable: () => <div data-testid="directories-table-stub">directories</div>,
  DirectoryFormModal: () => null,
  directoriesActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

vi.mock('@/features/directories/model/selectors/directoriesSelectors', () => ({
  getDirectoriesModalOpen: () => false,
}));

import { DirectoriesPage } from './DirectoriesPage';

describe('DirectoriesPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<DirectoriesPage />);

    expect(screen.getByTestId('directories-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'directories.title' })).toBeInTheDocument();
    expect(screen.getByText('directories.subtitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /directories.add/i })).toBeInTheDocument();
    expect(screen.getByTestId('directories-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<DirectoriesPage />);

    await user.click(screen.getByRole('button', { name: /directories.add/i }));

    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'directories/openCreateModal' });
  });
});
