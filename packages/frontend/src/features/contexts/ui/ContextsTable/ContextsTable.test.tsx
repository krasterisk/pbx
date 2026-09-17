import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ContextsTable } from './ContextsTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { count?: number; defaultValue?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && fallback.defaultValue) {
        return fallback.defaultValue;
      }
      return key;
    },
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/shared/api/api', () => ({
  useGetContextsQuery: () => ({
    data: [
      { uid: 1, name: 'from-internal', comment: 'Internal routing' },
    ],
    isLoading: false,
  }),
  useBulkDeleteContextsMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteContextMutation: () => [vi.fn()],
}));

describe('ContextsTable', () => {
  it('uses TableRowActions with title and aria-label', () => {
    render(<ContextsTable />);

    const edit = screen.getByRole('button', { name: 'common.edit' });
    const del = screen.getByRole('button', { name: 'common.delete' });

    expect(edit).toHaveAttribute('title');
    expect(edit).toHaveAttribute('aria-label');
    expect(del).toHaveAttribute('title');
    expect(del).toHaveAttribute('aria-label');
  });
});
