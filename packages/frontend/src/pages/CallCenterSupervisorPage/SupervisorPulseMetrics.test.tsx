import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SupervisorKpiStrip } from './SupervisorKpiStrip';
import { SupervisorMetricSheet } from './SupervisorMetricSheet';
import { rollupSupervisorKpis } from '@/features/callcenter/lib/supervisorKpiRollup';
import type { ICall, IQueueStats } from '@/features/callcenter/model/types/callCenterSchema';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: { time?: string }) => options?.time ? `${key} ${options.time}` : key }) }));
vi.mock('@/features/callcenter/lib/useNowTick', () => ({ useNowTick: () => 100_000 }));
const queues = [
  { name: 'sales', displayName: 'Sales', waiting: 2, talking: 1, sla: 90,
    calls: { total: 12, shortAbandoned: 2, answered: 9, abandoned: 1 } },
  { name: 'support', displayName: 'Support', waiting: 0, talking: 0, sla: 50,
    calls: { total: 2, shortAbandoned: 0, answered: 1, abandoned: 1 } },
] as IQueueStats[];
const rollup = rollupSupervisorKpis([], queues);
const periodMeta = { mode: 'business_day' as const, boundaryTime: '06:00' };

describe('Pulse metric drilldown', () => {
  it('shows four metrics, distinguishes the reporting day from now, and opens the selected metric', () => {
    const onSelect = vi.fn();
    render(<SupervisorKpiStrip rollup={rollup} periodMeta={periodMeta} onSelect={onSelect} />);
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getAllByText(/reportingDay/)).toHaveLength(3);
    expect(within(screen.getByTestId('supervisor-metric-waiting')).getByText(/pulse.now/)).toBeInTheDocument();
    expect(screen.getByTestId('supervisor-metric-sla')).toHaveTextContent('83.3%');
    fireEvent.click(screen.getByTestId('supervisor-metric-sla'));
    expect(onSelect).toHaveBeenCalledWith('sla');
  });

  it('includes ringing callers in the live maximum wait, matching the waiting counter', () => {
    const calls = [{ status: 'RINGING', enterTime: new Date(70_000).toISOString() }] as ICall[];
    render(<SupervisorKpiStrip rollup={rollup} periodMeta={periodMeta} calls={calls} />);
    expect(screen.getByTestId('supervisor-metric-waiting')).toHaveTextContent('maximumWait 0:30');
  });

  it('uses semantic accents and retains the minimum sample guard for low SLA', () => {
    const view = render(<SupervisorKpiStrip rollup={rollup} periodMeta={periodMeta} thresholds={{ slaCriticalPct: 90 }} />);
    expect(screen.getByTestId('supervisor-metric-sla')).toHaveAttribute('data-tone', 'warning');
    expect(screen.getByTestId('supervisor-metric-answered')).toHaveAttribute('data-tone', 'neutral');
    expect(screen.getByTestId('supervisor-metric-abandoned')).toHaveAttribute('data-tone', 'danger');
    expect(screen.getByTestId('supervisor-metric-waiting')).toHaveAttribute('data-tone', 'info');
    view.rerender(<SupervisorKpiStrip rollup={{ ...rollup, period: { ...rollup.period, effectiveOffered: 2 } }} periodMeta={periodMeta} thresholds={{ slaCriticalPct: 90 }} />);
    expect(screen.getByTestId('supervisor-metric-sla')).toHaveAttribute('data-tone', 'info');
    view.rerender(<SupervisorKpiStrip rollup={{ ...rollup, live: { ...rollup.live, waiting: 4 } }} periodMeta={periodMeta} thresholds={{ slaCriticalPct: 80, waitingWarning: 2 }} />);
    expect(screen.getByTestId('supervisor-metric-sla')).toHaveAttribute('data-tone', 'success');
    expect(screen.getByTestId('supervisor-metric-waiting')).toHaveAttribute('data-tone', 'warning');
  });

  it('keeps answered neutral at zero and explains the empty queue without a 0:00 duration', () => {
    render(<SupervisorKpiStrip rollup={{ ...rollup, period: { ...rollup.period, answered: 0 }, live: { ...rollup.live, waiting: 0 } }} periodMeta={periodMeta} />);
    expect(screen.getByTestId('supervisor-metric-answered')).toHaveAttribute('data-tone', 'neutral');
    expect(screen.getByTestId('supervisor-metric-waiting')).toHaveTextContent('pulse.noWaiting');
    expect(screen.getByTestId('supervisor-metric-waiting')).not.toHaveTextContent('maximumWait');
  });

  it('uses effective offered counts in the SLA breakdown and links to the journal', () => {
    const onHistory = vi.fn();
    render(<SupervisorMetricSheet metric="sla" rollup={rollup} periodMeta={periodMeta} queues={queues} onClose={vi.fn()} onHistory={onHistory} />);
    expect(screen.getByRole('columnheader', { name: /slaCount/ })).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getAllByRole('cell')[2]).toHaveTextContent('10');
    expect(within(rows[2]).getAllByRole('cell')[2]).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('button', { name: /pulse.history/ }));
    expect(onHistory).toHaveBeenCalledOnce();
  });
});
