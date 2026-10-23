import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CallsOverview } from './CallsOverview';
const state = vi.hoisted(() => ({
  data: undefined as unknown,
  error: false,
  fetching: false,
  refetch: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ru' } }),
}));
vi.mock('@/shared/api/endpoints/callsApi', () => ({
  useGetCompanyCallsOverviewQuery: () => ({
    currentData: state.data,
    isError: state.error,
    isFetching: state.fetching,
    refetch: state.refetch,
  }),
}));
describe('calls overview drill down', () => {
  it('refreshes preparing history and cancels its timer when closed', () => {
    vi.useFakeTimers();
    try {
      state.error=false;state.fetching=false;
      state.refetch.mockClear();
      state.data={source:{state:'stale',message:'historyBackfillInProgress'}};
      const view=render(<MemoryRouter><CallsOverview query={{}} periodHref={()=>''}/></MemoryRouter>);
      act(()=>vi.advanceTimersByTime(15000));
      expect(state.refetch).toHaveBeenCalledTimes(1);
      view.unmount();
      act(()=>vi.advanceTimersByTime(15000));
      expect(state.refetch).toHaveBeenCalledTimes(1);
    } finally {vi.useRealTimers();}
  });
  it('opens the exact half-open interval and disables empty intervals', () => {
    const periodHref = (from: string, to: string) =>
      `/reports/calls?from=${from}&to=${to}&employees=101`;
    state.data = {
      summary: { total: 2, human: 1, missed: 1, unknown: 0 },
      previous: { total: 0, human: 0, missed: 0, unknown: 0 },
      period: { from: '2026-10-18T00:00:00Z', to: '2026-10-18T02:00:00Z' },
      previousPeriod: {
        from: '2026-10-17T22:00:00Z',
        to: '2026-10-18T00:00:00Z',
      },
      buckets: [
        {
          from: '2026-10-18T00:00:00Z',
          to: '2026-10-18T01:00:00Z',
          total: 2,
          human: 1,
          missed: 1,
          unknown: 0,
        },
        {
          from: '2026-10-18T01:00:00Z',
          to: '2026-10-18T02:00:00Z',
          total: 0,
          human: 0,
          missed: 0,
          unknown: 0,
        },
      ],
      timezone: 'UTC',
      dataAsOf: null,
      projectionVersion: '2:1',
      source: { state: 'ok', message: null, progress: null },
    };
    const view = render(
      <MemoryRouter>
        <CallsOverview query={{ employees: ['101'] }} periodHref={periodHref} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button',{name:'calls.tables'}));
    expect(screen.getAllByRole('link').find(link=>link.getAttribute('href')===periodHref('2026-10-18T00:00:00Z','2026-10-18T01:00:00Z'))).toHaveAttribute(
      'href',
      '/reports/calls?from=2026-10-18T00:00:00Z&to=2026-10-18T01:00:00Z&employees=101',
    );
    expect(
      screen.getAllByRole('button').find((b) => b.hasAttribute('disabled')),
    ).toBeDisabled();
    state.data = {
      ...(state.data as object),
      source: { state: 'stale', message: 'historyStale' },
    };
    view.rerender(
      <MemoryRouter>
        <CallsOverview query={{ employees: ['101'] }} periodHref={periodHref} />
      </MemoryRouter>,
    );
    expect(screen.getByText('calls.historyUnavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('calls-overview')).not.toBeInTheDocument();
    expect(screen.queryByText('calls.historyStale')).not.toBeInTheDocument();
  });
  it('does not show old aggregates after a failed query', () => {
    state.error = true;
    render(
      <MemoryRouter>
        <CallsOverview query={{}} periodHref={() => ''} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('calls-overview')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    state.error = false;
  });
  it('keeps repeated local hours linked to distinct intervals without showing timezone labels', () => {
    state.data = {
      summary: {total:3,human:3,missed:0,unknown:0}, previous: {total:0,human:0,missed:0,unknown:0},
      period: {from:'2026-11-01T05:00:00Z',to:'2026-11-01T07:00:00Z'},
      previousPeriod: {from:'2026-11-01T03:00:00Z',to:'2026-11-01T05:00:00Z'},
      timezone:'America/New_York',source:{state:'ok'},dataAsOf:null,
      buckets:[{from:'2026-11-01T05:00:00Z',to:'2026-11-01T06:00:00Z',total:1,human:1,missed:0,unknown:0},{from:'2026-11-01T06:00:00Z',to:'2026-11-01T07:00:00Z',total:2,human:2,missed:0,unknown:0}],
    };
    render(<MemoryRouter><CallsOverview query={{}} periodHref={(from,to)=>`/reports/calls?from=${from}&to=${to}`} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'calls.tables'}));
    const first = screen.getAllByRole('link').find(link=>link.getAttribute('href')?.includes('from=2026-11-01T05:00:00Z'))!;
    const second = screen.getAllByRole('link').find(link=>link.getAttribute('href')?.includes('from=2026-11-01T06:00:00Z'))!;
    expect(first).not.toHaveTextContent(/GMT|UTC/); expect(first).toHaveTextContent('01:00');
    expect(second).not.toHaveTextContent(/GMT|UTC/); expect(second).toHaveTextContent('01:00');
  });
});
