import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => false,
}));

vi.mock('@/features/timeGroups', () => ({
  TimeGroupsTable: () => <div data-testid="timegroups-table-stub">timegroups</div>,
  TimeGroupFormModal: () => null,
  timeGroupsActions: { openCreateModal: () => ({ type: 'timeGroups/openCreateModal' }) },
}));

vi.mock('@/features/timeGroups/model/selectors/timeGroupsSelectors', () => ({
  getTimeGroupsModalOpen: () => false,
}));

import { TimeGroupsPage } from './TimeGroupsPage';

describe('TimeGroupsPage hybrid overflow (D-29 / D-27 wave B)', () => {
  it('exposes hybrid-table overflow marker at page level', () => {
    render(<TimeGroupsPage />);
    expect(screen.getByTestId('timegroups-page-responsive')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(hybrid.className).toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('timegroups-table-stub')).toBeInTheDocument();
  });
});
