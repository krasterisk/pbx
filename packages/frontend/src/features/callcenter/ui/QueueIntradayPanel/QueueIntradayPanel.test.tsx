import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

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
  state: {} as Record<string, unknown>,
  chart: vi.fn(),
}));

vi.mock('@/shared/api/endpoints/callCenterReportsApi', () => ({
  useGetQueueIntervalsQuery: (params: unknown, options: unknown) => {
    mocks.query(params, options);
    return { refetch: mocks.refetch, ...mocks.state };
  },
}));

vi.mock('../IntradayChart', () => ({
  IntradayChart: (props: { points: { label: string }[]; showPrevious: boolean }) => {
    mocks.chart(props);
    return <p data-testid="chart-stub">{props.points.map((p) => p.label).join(',')}|{String(props.showPrevious)}</p>;
  },
}));

import type { QueueIntervalPoint, QueueIntervalsResult } from '@/shared/api/endpoints/callCenterReportsApi';
import { INTRADAY_POLL_MS, QueueIntradayPanel } from './QueueIntradayPanel';

const point = (start: string, partial: Partial<QueueIntervalPoint> = {}): QueueIntervalPoint => ({
  start,
  offered: 0,
  answered: 0,
  abandoned: 0,
  shortAbandoned: 0,
  transferred: 0,
  sla: 0,
  asr: 0,
  asa: 0,
  aht: 0,
  abandonRate: 0,
  maxWait: 0,
  cumulativeOffered: 0,
  cumulativeSla: 0,
  ...partial,
});

const busyDay: QueueIntervalsResult = {
  timezone: 'Asia/Bangkok',
  granularityMin: 30,
  from: '2026-07-14T17:00:00.000Z',
  to: '2026-07-15T17:00:00.000Z',
  rows: [
    point('2026-07-15T02:00:00.000Z', { offered: 3, answered: 2, abandoned: 1, cumulativeOffered: 3, cumulativeSla: 66.7 }),
    point('2026-07-15T02:30:00.000Z', { offered: 7, answered: 7, cumulativeOffered: 10, cumulativeSla: 80 }),
  ],
};

describe('QueueIntradayPanel', () => {
  beforeEach(() => {
    mocks.query.mockClear();
    mocks.refetch.mockClear();
    mocks.chart.mockClear();
    mocks.state = { data: undefined, isLoading: false, isError: false };
  });

  it('asks for the 30-minute series of all queues, polling once a minute', () => {
    render(<QueueIntradayPanel />);
    expect(mocks.query).toHaveBeenLastCalledWith({ granularityMin: 30 }, expect.objectContaining({ pollingInterval: INTRADAY_POLL_MS }));
    expect(INTRADAY_POLL_MS).toBe(60_000);
  });

  it('shows a skeleton and no chart while loading', () => {
    mocks.state = { data: undefined, isLoading: true, isError: false };
    render(<QueueIntradayPanel />);
    expect(screen.queryByTestId('intraday-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chart-stub')).not.toBeInTheDocument();
    expect(screen.queryByTestId('intraday-empty')).not.toBeInTheDocument();
  });

  it('shows an error with retry when nothing was loaded', () => {
    mocks.state = { data: undefined, isLoading: false, isError: true };
    render(<QueueIntradayPanel />);
    expect(screen.getByTestId('intraday-error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps showing the last data when a background refresh fails', () => {
    mocks.state = { data: busyDay, isLoading: false, isError: true };
    render(<QueueIntradayPanel />);
    expect(screen.queryByTestId('intraday-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('chart-stub')).toBeInTheDocument();
  });

  it('says so when there were no queue calls today instead of drawing an empty chart', () => {
    mocks.state = { data: { ...busyDay, rows: [point('2026-07-15T02:00:00.000Z')] }, isLoading: false, isError: false };
    render(<QueueIntradayPanel />);
    expect(screen.getByTestId('intraday-empty')).toHaveTextContent('No queue calls yet today');
    expect(screen.queryByTestId('chart-stub')).not.toBeInTheDocument();
    expect(screen.queryByTestId('intraday-summary')).not.toBeInTheDocument();
  });

  it('renders tenant-timezone labels, the day summary with SLA and the peak interval', () => {
    mocks.state = { data: busyDay, isLoading: false, isError: false };
    render(<QueueIntradayPanel />);
    expect(screen.getByTestId('chart-stub')).toHaveTextContent('09:00,09:30|false');
    expect(screen.getByTestId('intraday-summary')).toHaveTextContent(
      'Offered 10 · handled 9 · abandoned 1 · SLA 80% · peak 09:30 (7)',
    );
  });

  it('switches the interval length and the week-ago overlay through the query params', () => {
    mocks.state = { data: busyDay, isLoading: false, isError: false };
    render(<QueueIntradayPanel />);

    fireEvent.click(screen.getByRole('tab', { name: '60 min' }));
    expect(mocks.query).toHaveBeenLastCalledWith({ granularityMin: 60 }, expect.anything());

    fireEvent.click(screen.getByTestId('intraday-compare'));
    expect(mocks.query).toHaveBeenLastCalledWith({ granularityMin: 60, compare: 'weekAgo' }, expect.anything());
    expect(screen.getByTestId('intraday-compare')).toHaveAttribute('aria-pressed', 'true');
    expect(mocks.chart).toHaveBeenLastCalledWith(expect.objectContaining({ showPrevious: true }));
  });

  it('charts a single queue when one is given and names it in the title', () => {
    mocks.state = { data: busyDay, isLoading: false, isError: false };
    render(<QueueIntradayPanel queueName="sales" queueLabel="Sales desk" />);
    expect(mocks.query).toHaveBeenLastCalledWith({ granularityMin: 30, queueName: 'sales' }, expect.anything());
    expect(screen.getByText(/Today by time of day · Sales desk/)).toBeInTheDocument();
  });
});
