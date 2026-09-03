import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

const { setSearchParams, getSearchParams, setCurrentSearch } = vi.hoisted(() => {
  let params = new URLSearchParams();
  const setSearchParams = vi.fn((next: URLSearchParams) => {
    params = new URLSearchParams(next);
  });
  return {
    setSearchParams,
    getSearchParams: () => params,
    setCurrentSearch: (init: string) => {
      params = new URLSearchParams(init);
    },
  };
});

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [getSearchParams(), setSearchParams],
}));

vi.mock('@/shared/api/endpoints/cdrApi', () => ({
  useGetCdrListQuery: () => ({ data: { rows: [], count: 0 }, isLoading: false, isFetching: false }),
  useGetCdrStatsQuery: () => ({ data: undefined, isLoading: false }),
  useLazyExportCdrQuery: () => [vi.fn(), { isFetching: false }],
}));

vi.mock('@/shared/api/endpoints/voicemailApi', () => ({
  useGetVoicemailMessagesQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/features/cdr', () => ({
  CdrFilter: () => <div data-testid="cdr-filter-stub">filter</div>,
  CdrStats: () => <div data-testid="cdr-stats-stub">stats</div>,
  CdrTable: () => <div data-testid="cdr-table-stub">table</div>,
  CdrLegsModal: () => null,
  CdrDrilldownModal: () => null,
  CdrCharts: () => <div data-testid="cdr-charts-stub">charts</div>,
}));

import CdrReportPage from './CdrReportPage';
import { useGetVoicemailMessagesQuery } from '@/shared/api/endpoints/voicemailApi';

describe('CdrReportPage hybrid overflow (D-29 / D-27 wave E)', () => {
  beforeEach(() => {
    setCurrentSearch('');
    setSearchParams.mockClear();
  });

  it('exposes hybrid-table overflow marker at page level', () => {
    render(<CdrReportPage />);
    expect(screen.getByTestId('cdr-report-page-responsive')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(hybrid.className).toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('cdr-table-stub')).toBeInTheDocument();
  });
});

describe('CdrReportPage voicemail tab (D-58)', () => {
  beforeEach(() => {
    setCurrentSearch('');
    setSearchParams.mockClear();
    vi.mocked(useGetVoicemailMessagesQuery).mockClear();
  });

  it('renders a third tab named Голосовые сообщения', () => {
    render(<CdrReportPage />);
    expect(screen.getByRole('button', { name: 'Голосовые сообщения' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Журнал' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Аналитика' })).toBeInTheDocument();
  });

  it('clicking the voicemail tab writes voicemail=1 to search params', () => {
    render(<CdrReportPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Голосовые сообщения' }));
    expect(setSearchParams).toHaveBeenCalled();
    const next = setSearchParams.mock.calls.at(-1)?.[0] as URLSearchParams;
    expect(next.get('voicemail')).toBe('1');
  });

  it('clicking journal or analytics clears the voicemail field', () => {
    setCurrentSearch('voicemail=1');
    render(<CdrReportPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Журнал' }));
    const afterJournal = setSearchParams.mock.calls.at(-1)?.[0] as URLSearchParams;
    expect(afterJournal.get('voicemail')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Аналитика' }));
    const afterAnalytics = setSearchParams.mock.calls.at(-1)?.[0] as URLSearchParams;
    expect(afterAnalytics.get('voicemail')).toBeNull();
  });

  it('calls useGetVoicemailMessagesQuery when voicemail=1', () => {
    setCurrentSearch('voicemail=1');
    render(<CdrReportPage />);
    expect(useGetVoicemailMessagesQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ skip: false }),
    );
  });
});
