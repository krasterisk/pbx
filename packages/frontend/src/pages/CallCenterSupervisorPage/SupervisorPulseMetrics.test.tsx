import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SupervisorKpiStrip } from './SupervisorKpiStrip';
import { SupervisorMetricSheet } from './SupervisorMetricSheet';
import { rollupSupervisorKpis } from '@/features/callcenter/lib/supervisorKpiRollup';
import type { IQueueStats } from '@/features/callcenter/model/types/callCenterSchema';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
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
    expect(screen.getAllByText(/businessDay/)).toHaveLength(3);
    expect(within(screen.getByTestId('supervisor-metric-waiting')).getByText(/pulse.now/)).toBeInTheDocument();
    expect(screen.getByTestId('supervisor-metric-sla')).toHaveTextContent('83.3%');
    fireEvent.click(screen.getByTestId('supervisor-metric-sla'));
    expect(onSelect).toHaveBeenCalledWith('sla');
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
