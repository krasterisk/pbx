import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
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
}));

vi.mock('../../model/slice/callGroupsPageSlice', () => ({
  callGroupsPageActions: {
    openCreateModal: () => ({ type: 'callGroups/openCreateModal' }),
  },
}));

vi.mock('../CallGroupsTable/CallGroupsTable', () => ({
  CallGroupsTable: () => <div data-testid="call-groups-table-stub">call-groups</div>,
}));

vi.mock('../CallGroupFormModal/CallGroupFormModal', () => ({
  CallGroupFormModal: () => null,
}));

import { CallGroupsPage } from './CallGroupsPage';

describe('CallGroupsPage hybrid overflow (D-29 / D-27 wave C)', () => {
  it('exposes hybrid-table overflow marker at page level', () => {
    render(<CallGroupsPage />);
    expect(screen.getByTestId('call-groups-page-responsive')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(hybrid.className).toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('call-groups-table-stub')).toBeInTheDocument();
  });
});
