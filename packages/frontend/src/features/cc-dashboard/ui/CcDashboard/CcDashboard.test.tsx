import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import type { CcDashboardOverview, CcServiceKpis, CcDashboardSeriesPoint } from '@krasterisk/shared';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg?: string | Record<string, unknown>) => {
      if (typeof arg === 'string') return arg;
      const template = String(arg?.defaultValue ?? key);
      return template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(arg?.[name] ?? ''));
    },
  }),
}));

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  refetch: vi.fn(),
  navigate: vi.fn(),
  state: {} as Record<string, unknown>,
  chart: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/shared/api/endpoints/callCenterDashboardApi', () => ({
  useGetCcDashboardOverviewQuery: (params: unknown, options: unknown) => {
    mocks.query(params, options);
    return { refetch: mocks.refetch, ...mocks.state };
  },
}));

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetTenantSettingsQuery: () => ({ data: undefined }),
}));

vi.mock('@/features/callcenter/ui/IntradayChart', () => ({
  IntradayChart: (props: { points: unknown[]; showPrevious: boolean }) => {
    mocks.chart(props);
    return <p data-testid="chart-stub">{props.points.length}|{String(props.showPrevious)}</p>;
  },
}));

vi.mock('@/features/dashboard/ui/DashboardSource', () => ({
  DashboardSource: ({ source }: { source: { state: string } }) => <span data-testid="source-badge">{source.state}</span>,
}));

import { CC_DASHBOARD_POLL_MS, CcDashboard } from './CcDashboard';

const kpis = (partial: Partial<CcServiceKpis> = {}): CcServiceKpis => ({
  offered: 100,
  handled: 90,
  abandoned: 10,
  shortAbandoned: 0,
  transferred: 0,
  sla: 85,
  asr: 90,
  asa: 14,
  aht: 245,
  abandonRate: 10,
  maxWait: 60,
  ...partial,
});

const point = (at: string, partial: Partial<CcDashboardSeriesPoint> = {}): CcDashboardSeriesPoint => ({
  at,
  offered: 5,
  handled: 4,
  abandoned: 1,
  shortAbandoned: 0,
  sla: 80,
  abandonRate: 20,
  asa: 10,
  aht: 100,
  cumulativeSla: 80,
  hasTraffic: true,
  ...partial,
});

const window = { dateFrom: '2026-07-15', dateTo: '2026-07-15', from: '2026-07-14T17:00:00.000Z', to: '2026-07-15T08:00:00.000Z' };

const overview = (partial: Partial<CcDashboardOverview> = {}): CcDashboardOverview => ({
  version: 1,
  generatedAt: '2026-07-15T08:00:00.000Z',
  period: { ...window, preset: 'today', timezone: 'Asia/Bangkok', days: 1, includesToday: true, previous: window },
  queues: [],
  availableQueues: ['sales', 'support'],
  now: {
    source: { state: 'ok', updatedAt: null },
    data: { waiting: 2, longestWaitSec: 74, agents: { ready: 3, busy: 4, paused: 1, wrapup: 0, offline: 2 }, slaLast30: 90, offeredLast30: 12 },
  },
  service: { source: { state: 'ok', updatedAt: null }, data: { current: kpis(), previous: kpis({ sla: 80, offered: 90 }) } },
  series: {
    source: { state: 'ok', updatedAt: null },
    data: { granularity: 'halfHour', points: [point('2026-07-15T01:00:00.000Z'), point('2026-07-15T01:30:00.000Z')], previous: [point('2026-07-08T01:00:00.000Z'), point('2026-07-08T01:30:00.000Z')] },
  },
  queueTable: {
    source: { state: 'ok', updatedAt: null },
    data: [
      { queueName: 'support', current: kpis({ sla: 60 }), previous: kpis({ sla: 70 }) },
      { queueName: 'sales', current: kpis({ sla: 95 }), previous: null },
    ],
  },
  losses: {
    source: { state: 'ok', updatedAt: null },
    data: {
      total: 20,
      previousTotal: 25,
      recoveredByAgent: 10,
      recoveredWithin15: 5,
      recoveredWithin60: 8,
      clientCalledBack: 2,
      pending: 8,
      waitBuckets: { upTo5: 2, upTo20: 8, upTo60: 6, over60: 4 },
    },
  },
  pauses: {
    source: { state: 'ok', updatedAt: null },
    data: {
      count: 3,
      totalSec: 1800,
      paidSec: 900,
      unpaidSec: 600,
      unknownSec: 300,
      reasons: [{ reason: 'Lunch', count: 1, totalSec: 900, isPaid: false }],
      previousTotalSec: 1500,
    },
  },
  operators: {
    source: { state: 'ok', updatedAt: null },
    data: {
      evaluated: 5,
      medianAhtSec: 200,
      medianPauseSharePct: 10,
      outliers: [
        { agentInterface: 'PJSIP/105', agentUserUid: 5, callsHandled: 14, ahtSec: 480, pauseSharePct: 41.5, loggedInSec: 28800, flags: ['highAht', 'highPause'] },
      ],
    },
  },
  ...partial,
});

const renderAt = (url = '/callcenter/dashboard') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <CcDashboard />
    </MemoryRouter>,
  );

describe('CcDashboard', () => {
  beforeEach(() => {
    mocks.query.mockClear();
    mocks.refetch.mockClear();
    mocks.navigate.mockClear();
    mocks.chart.mockClear();
    mocks.state = { data: undefined, isLoading: false, isError: false };
  });

  it('asks for today with comparison on, polling once a minute', () => {
    renderAt();
    expect(mocks.query).toHaveBeenLastCalledWith(
      { period: 'today', from: undefined, to: undefined, compare: true, queues: [] },
      expect.objectContaining({ skip: false, pollingInterval: CC_DASHBOARD_POLL_MS }),
    );
    expect(CC_DASHBOARD_POLL_MS).toBe(60_000);
  });

  it('does not poll a finished day and does not ask for an incomplete custom range', () => {
    renderAt('/callcenter/dashboard?period=yesterday');
    expect(mocks.query).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ pollingInterval: 0 }));
    renderAt('/callcenter/dashboard?period=custom&from=2026-07-01');
    expect(mocks.query).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ skip: true }));
    expect(screen.getByTestId('cc-dashboard-incomplete')).toBeInTheDocument();
    expect(screen.getByTestId('cc-dashboard-custom')).toBeInTheDocument();
  });

  it('shows skeletons while loading', () => {
    mocks.state = { data: undefined, isLoading: true, isError: false };
    renderAt();
    expect(screen.getByTestId('cc-dashboard-loading')).toBeInTheDocument();
  });

  it('shows an error with retry when nothing was ever loaded', () => {
    mocks.state = { data: undefined, isLoading: false, isError: true };
    renderAt();
    expect(screen.getByTestId('cc-dashboard-error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it('renders now strip, KPI cards, chart and queue table from one response', () => {
    mocks.state = { data: overview(), isLoading: false, isError: false };
    renderAt();
    expect(screen.getByTestId('cc-now-waiting')).toHaveTextContent('2');
    expect(screen.getByTestId('cc-kpi-offered-value')).toHaveTextContent('100');
    expect(screen.getByTestId('cc-kpi-sla-value')).toHaveTextContent('85');
    expect(screen.getByTestId('cc-kpi-sla-delta')).toBeInTheDocument();
    expect(screen.getByTestId('chart-stub')).toHaveTextContent('2|true');
    expect(screen.getByTestId('cc-queue-row-support')).toBeInTheDocument();
    expect(screen.getByTestId('cc-queue-row-sales')).toBeInTheDocument();
    expect(screen.getAllByTestId('source-badge')[0]).toHaveTextContent('ok');
    expect(screen.getByTestId('cc-losses-pending')).toHaveTextContent('8');
    expect(screen.getByTestId('cc-pauses-total')).toHaveTextContent('30 min');
  });

  it('lists the operators who stand out and opens their report', () => {
    mocks.state = { data: overview(), isLoading: false, isError: false };
    renderAt();
    expect(screen.getByTestId('cc-operators-row-0')).toHaveTextContent('105');
    fireEvent.click(screen.getByTestId('cc-operators-row-0'));
    expect(mocks.navigate).toHaveBeenLastCalledWith('/callcenter/reports?report=operator-stats&from=2026-07-15&to=2026-07-15&agent=PJSIP%2F105');
    fireEvent.click(screen.getByTestId('cc-operators-open'));
    expect(mocks.navigate).toHaveBeenLastCalledWith('/callcenter/reports?report=operator-stats&from=2026-07-15&to=2026-07-15');
  });

  it('a failing operators section does not hide the rest of the page', () => {
    mocks.state = {
      data: overview({ operators: { source: { state: 'error', updatedAt: null, message: 'operators_unavailable' }, data: null } }),
      isLoading: false,
      isError: false,
    };
    renderAt();
    expect(screen.getByTestId('cc-operators-note')).toHaveTextContent('temporarily unavailable');
    expect(screen.getByTestId('cc-pauses')).toBeInTheDocument();
  });

  it('a failing pauses section does not hide the rest of the page', () => {
    mocks.state = {
      data: overview({ pauses: { source: { state: 'error', updatedAt: null, message: 'pauses_unavailable' }, data: null } }),
      isLoading: false,
      isError: false,
    };
    renderAt();
    expect(screen.getByTestId('cc-pauses-note')).toHaveTextContent('temporarily unavailable');
    expect(screen.getByTestId('cc-losses')).toBeInTheDocument();
  });

  it('a failing losses section does not hide the rest of the page', () => {
    mocks.state = {
      data: overview({ losses: { source: { state: 'error', updatedAt: null, message: 'losses_unavailable' }, data: null } }),
      isLoading: false,
      isError: false,
    };
    renderAt();
    expect(screen.getByTestId('cc-losses-note')).toHaveTextContent('temporarily unavailable');
    expect(screen.getByTestId('cc-kpi-grid')).toBeInTheDocument();
    expect(screen.getAllByTestId('source-badge')[0]).toHaveTextContent('unavailable');
  });

  it('has no now strip for a finished period', () => {
    mocks.state = { data: overview({ now: null }), isLoading: false, isError: false };
    renderAt('/callcenter/dashboard?period=yesterday');
    expect(screen.queryByTestId('cc-now-strip')).not.toBeInTheDocument();
    expect(screen.getByTestId('cc-kpi-grid')).toBeInTheDocument();
  });

  it('tells which section is unavailable instead of showing zeros', () => {
    mocks.state = {
      data: overview({
        service: { source: { state: 'error', updatedAt: null, message: 'x' }, data: null },
        queueTable: { source: { state: 'notConfigured', updatedAt: null }, data: null },
      }),
      isLoading: false,
      isError: false,
    };
    renderAt();
    expect(screen.queryByTestId('cc-kpi-grid')).not.toBeInTheDocument();
    expect(screen.getByTestId('cc-service-note')).toHaveTextContent('temporarily unavailable');
    expect(screen.getByTestId('cc-queues-note')).toHaveTextContent('not configured');
    expect(screen.getAllByTestId('source-badge')[0]).toHaveTextContent('unavailable');
  });

  it('says there were no calls instead of drawing an empty chart', () => {
    const empty = kpis({ offered: 0, handled: 0, abandoned: 0, sla: 0, abandonRate: 0 });
    mocks.state = {
      data: overview({ service: { source: { state: 'ok', updatedAt: null }, data: { current: empty, previous: null } } }),
      isLoading: false,
      isError: false,
    };
    renderAt();
    expect(screen.getByTestId('cc-chart-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-stub')).not.toBeInTheDocument();
  });

  it('drills into profile reports from each KPI card and into supervisor for today queues or report for past queues (U4.2, U4.3)', () => {
    mocks.state = { data: overview(), isLoading: false, isError: false };
    const { unmount } = renderAt();
    expect(screen.getByTestId('cc-kpi-sla-target')).toHaveTextContent('70%');
    expect(screen.getByTestId('cc-kpi-sla-help')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cc-kpi-sla'));
    expect(mocks.navigate).toHaveBeenLastCalledWith('/callcenter/reports?from=2026-07-15&to=2026-07-15');
    fireEvent.click(screen.getByTestId('cc-kpi-abandon'));
    expect(mocks.navigate).toHaveBeenLastCalledWith('/callcenter/reports?report=missed-callback&from=2026-07-15&to=2026-07-15');
    fireEvent.click(screen.getByTestId('cc-kpi-aht'));
    expect(mocks.navigate).toHaveBeenLastCalledWith('/callcenter/reports?report=operator-stats&from=2026-07-15&to=2026-07-15');
    fireEvent.click(screen.getByTestId('cc-queue-row-support'));
    expect(mocks.navigate).toHaveBeenLastCalledWith('/callcenter/supervisor?q=support');
    fireEvent.click(screen.getByTestId('cc-losses-open'));
    expect(mocks.navigate).toHaveBeenLastCalledWith('/callcenter/reports?report=missed-callback&from=2026-07-15&to=2026-07-15');
    fireEvent.click(screen.getByTestId('cc-pauses-open'));
    expect(mocks.navigate).toHaveBeenLastCalledWith('/callcenter/reports?report=pause-report&from=2026-07-15&to=2026-07-15');
    fireEvent.click(screen.getByTestId('cc-now-strip'));
    expect(mocks.navigate).toHaveBeenLastCalledWith('/callcenter/supervisor');
    unmount();

    mocks.state = {
      data: overview({ period: { ...window, preset: 'yesterday', timezone: 'Asia/Bangkok', days: 1, includesToday: false, previous: window } }),
      isLoading: false,
      isError: false,
    };
    renderAt('/callcenter/dashboard?period=yesterday');
    fireEvent.click(screen.getByTestId('cc-queue-row-support'));
    expect(mocks.navigate).toHaveBeenLastCalledWith('/callcenter/reports?from=2026-07-15&to=2026-07-15&queue=support');
  });

  it('passes a single selected queue on to the report, but not several', () => {
    mocks.state = { data: overview(), isLoading: false, isError: false };
    const { unmount } = renderAt('/callcenter/dashboard?queues=sales');
    fireEvent.click(screen.getByTestId('cc-losses-open'));
    expect(mocks.navigate).toHaveBeenLastCalledWith('/callcenter/reports?report=missed-callback&from=2026-07-15&to=2026-07-15&queue=sales');
    unmount();
    renderAt('/callcenter/dashboard?queues=sales,support');
    fireEvent.click(screen.getByTestId('cc-losses-open'));
    expect(mocks.navigate).toHaveBeenLastCalledWith('/callcenter/reports?report=missed-callback&from=2026-07-15&to=2026-07-15');
  });

  it('switching the period asks for it again', () => {
    mocks.state = { data: overview(), isLoading: false, isError: false };
    renderAt();
    fireEvent.click(screen.getByRole('tab', { name: '7d' }));
    expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ period: '7d' }), expect.anything());
  });

  it('turning comparison off drops the overlay and says so on the cards', () => {
    mocks.state = { data: overview(), isLoading: false, isError: false };
    renderAt('/callcenter/dashboard?compare=0');
    expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ compare: false }), expect.anything());
  });
});
