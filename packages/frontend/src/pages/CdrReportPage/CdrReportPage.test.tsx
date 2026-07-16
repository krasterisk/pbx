import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('@/shared/api/endpoints/cdrApi', () => ({
  useGetCdrListQuery: () => ({ data: { rows: [], count: 0 }, isLoading: false, isFetching: false }),
  useGetCdrStatsQuery: () => ({ data: undefined, isLoading: false }),
  useLazyExportCdrQuery: () => [vi.fn(), { isFetching: false }],
}));

vi.mock('@/features/cdr', () => ({
  CdrFilter: () => <div data-testid="cdr-filter-stub">filter</div>,
  CdrStats: () => <div data-testid="cdr-stats-stub">stats</div>,
  CdrTable: () => <div data-testid="cdr-table-stub">table</div>,
  CdrLegsModal: () => null,
  CdrDrilldownModal: () => null,
  CdrCharts: () => <div data-testid="cdr-charts-stub">charts</div>,
}));

vi.mock('@/features/cdr/model/lib/cdrFiltersToParams', () => ({
  filtersToQueryParams: () => ({}),
  parseFiltersFromSearchParams: () => ({}),
}));

import CdrReportPage from './CdrReportPage';

describe('CdrReportPage hybrid overflow (D-29 / D-27 wave E)', () => {
  it('exposes hybrid-table overflow marker at page level', () => {
    render(<CdrReportPage />);
    expect(screen.getByTestId('cdr-report-page-responsive')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(hybrid.className).toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('cdr-table-stub')).toBeInTheDocument();
  });
});
