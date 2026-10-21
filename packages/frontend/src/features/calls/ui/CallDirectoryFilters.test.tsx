import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CallsFacets } from '@krasterisk/shared';
import { CallDirectoryFilters } from './CallDirectoryFilters';
const state = vi.hoisted(() => ({
  data: undefined as CallsFacets | undefined,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/shared/api/endpoints/callsApi', () => ({
  useGetCompanyCallFacetsQuery: () => ({
    currentData: state.data,
    data: state.data,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
describe('selected directory labels', () => {
  it('preserves a known selection through an empty result, and clears it when access context changes', () => {
    state.data = {
      contextKey: 'tenant-a:scope-a',
      options: {
        employee: [{ value: '101', label: 'Анна', count: 2 }],
        department: [],
        companyNumber: [],
        queue: [],
        robot: [],
      },
      truncated: {},
      analyticsAllowed: false,
      dataAsOf: null,
    };
    const props = {
      query: { employees: ['101'] },
      patch: vi.fn(),
      advanced: false,
    };
    const view = render(<CallDirectoryFilters {...props} />);
    expect(
      screen.getByRole('button', { name: 'calls.removeFilter: Анна' }),
    ).toBeInTheDocument();
    state.data = {
      ...state.data,
      options: { ...state.data.options, employee: [] },
    };
    view.rerender(<CallDirectoryFilters {...props} />);
    expect(
      screen.getByRole('button', { name: 'calls.removeFilter: Анна' }),
    ).toBeInTheDocument();
    state.data = { ...state.data, contextKey: 'tenant-b:scope-b' };
    view.rerender(<CallDirectoryFilters {...props} />);
    expect(
      screen.queryByRole('button', { name: 'calls.removeFilter: Анна' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'calls.removeFilter: 101' }),
    ).toBeInTheDocument();
  });
});
