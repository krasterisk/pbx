import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsView } from './ReportsView';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ state: { error: true, cached: false }, listeners: new Set<() => void>(), refetch: vi.fn(), detail: null as null | Array<Record<string, unknown>> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ru' } }) }));
vi.mock('./ReportBreakdown', () => ({ ReportBreakdown: () => null }));
vi.mock('./AttemptInspector', () => ({ AttemptInspector: () => null }));
vi.mock('@/shared/api/endpoints/autodialApi', async () => {
  const { useSyncExternalStore } = await import('react');
  const useReport = () => {
    const state = useSyncExternalStore((listener) => { mocks.listeners.add(listener); return () => { mocks.listeners.delete(listener); }; }, () => mocks.state);
    return { currentData: state.cached ? [] : undefined, isError: state.error, isFetching: false, refetch: mocks.refetch };
  };
  return {
  useGetAutodialCampaignsQuery: () => ({ data: [] }),
  useGetAutodialReportContextQuery: () => ({ currentData: { timezone: 'UTC', detail_limit: 50000 } }),
  useGetAutodialSummaryQuery: useReport,
  useGetAutodialDailyQuery: useReport,
  useGetAutodialDetailQuery: () => { const state = useReport(); return { ...state, currentData: mocks.detail ?? state.currentData }; },
  useDownloadAutodialReportMutation: () => [vi.fn(), { isLoading: false, reset: vi.fn() }],
  };
});
beforeEach(() => { mocks.detail = null; mocks.state = { error: true, cached: false }; vi.clearAllMocks(); });

describe('report errors and empty results', () => {
  it('shows admitted labels, goal and destination instead of rewritten customer data', () => {
    mocks.state = { error: false, cached: true };
    mocks.detail = [{ attempt_uid: 7, campaign_uid: 1, contact_uid: 1, external_id: 'synthetic-1',
      phone: '99999999', dialled_phone: '00991419', started_at: '2026-10-18T12:00:00Z', attempt_no: 1,
      disposition: 'answered_short', billsec: 15, scenario_result: { business_outcome: 'visit_confirmed',
        business_outcome_label: 'Historical confirmation', business_goal_relation: 'achieved' } }];
    render(<MemoryRouter initialEntries={['/autodial/reports?ac_report=detail']}><ReportsView /></MemoryRouter>);
    expect(screen.getByText('Historical confirmation')).toBeInTheDocument();
    expect(screen.getByText('autodial.workspace.outcomeDefinition.relations.achieved')).toBeInTheDocument();
    expect(screen.getByText('00991419')).toBeInTheDocument();
    expect(screen.queryByText('99999999')).not.toBeInTheDocument();
    expect(screen.queryByText('visit_confirmed')).not.toBeInTheDocument();
  });

  it('shows a retryable error instead of claiming the result is empty and preserves filters', () => {
    render(<MemoryRouter><ReportsView /></MemoryRouter>);
    const from = screen.getByLabelText('autodial.reports.from') as HTMLInputElement;
    fireEvent.change(from, { target: { value: '2026-10-01' } });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('autodial.reports.noData')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'autodial.common.retry' }));
    expect(mocks.refetch).toHaveBeenCalledTimes(3);
    expect(from).toHaveValue('2026-10-01');
  });
  it('marks cached data as stale and distinguishes a successful empty response', () => {
    mocks.state = { error: true, cached: true };
    render(<MemoryRouter><ReportsView /></MemoryRouter>);
    expect(screen.getByText('autodial.workspace.reportStale')).toBeInTheDocument();
    act(() => { mocks.state = { ...mocks.state, error: false }; for (const notify of mocks.listeners) notify(); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('autodial.workspace.reportStale')).not.toBeInTheDocument();
    expect(screen.getByText('autodial.reports.noData')).toBeInTheDocument();
  });
});
