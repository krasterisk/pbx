import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ReportColumn } from '@/shared/api/endpoints/callCenterReportsApi';
import type { ReportCellContext } from '../../lib/reportCells';
import { resolveKpiThresholds } from '../../lib/kpiThresholds';
import { Button } from '@/shared/ui';
import { ReportTable } from './ReportTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

const ctx: ReportCellContext = {
  locale: 'en',
  t: ((key: string, fallback?: string) => fallback ?? key) as ReportCellContext['t'],
  agentLabel: (i) => i,
  queueLabel: (q) => `Queue ${q}`,
  thresholds: resolveKpiThresholds(undefined),
};

const COLUMNS: ReportColumn[] = [
  { key: 'queueName', header: 'Queue', type: 'queue' },
  { key: 'totalCalls', header: 'Total calls', type: 'count', total: 'sum' },
  { key: 'slaPct', header: 'SLA', type: 'percent', total: 'weighted', weightKey: 'totalCalls' },
  { key: 'ahtSec', header: 'AHT', type: 'duration', total: 'weighted', weightKey: 'totalCalls' },
];

const ROWS = [
  { queueName: 'q1', totalCalls: 100, slaPct: 90, ahtSec: 60 },
  { queueName: 'q2', totalCalls: 300, slaPct: 50, ahtSec: 120 },
];

const base = {
  reportId: 'queue-summary' as const,
  columns: COLUMNS,
  rows: ROWS,
  ctx,
  aggregate: true,
  mobile: false,
  emptyText: 'Nothing',
};

describe('ReportTable (cc-ux U3.3-U3.6)', () => {
  beforeEach(() => window.localStorage.clear());

  it('formats cells by column type', () => {
    render(<ReportTable {...base} />);
    expect(screen.getByText('Queue q1')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('2:00')).toBeInTheDocument();
  });

  it('shows a totals strip weighted by the denominator, not an average of rates', () => {
    render(<ReportTable {...base} />);
    const totals = screen.getByTestId('cc-report-totals');
    expect(within(totals).getByTestId('cc-report-total-totalCalls')).toHaveTextContent('400');
    // (90*100 + 50*300) / 400 = 60
    expect(within(totals).getByTestId('cc-report-total-slaPct')).toHaveTextContent('60');
  });

  it('has no totals for a list report or a single row', () => {
    const { rerender } = render(<ReportTable {...base} aggregate={false} />);
    expect(screen.queryByTestId('cc-report-totals')).not.toBeInTheDocument();
    rerender(<ReportTable {...base} rows={[ROWS[0]]} />);
    expect(screen.queryByTestId('cc-report-totals')).not.toBeInTheDocument();
  });

  it('opens a row on click', () => {
    const onRowActivate = vi.fn();
    render(<ReportTable {...base} onRowActivate={onRowActivate} />);
    fireEvent.click(screen.getAllByTestId('cc-report-row')[1]);
    expect(onRowActivate).toHaveBeenCalledWith(ROWS[1]);
  });

  it('shows search only for long lists', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ queueName: `q${i}`, totalCalls: i, slaPct: 80, ahtSec: 30 }));
    const { rerender } = render(<ReportTable {...base} rows={many} />);
    expect(document.querySelector('[data-table-search]')).toBeInTheDocument();
    rerender(<ReportTable {...base} rows={ROWS} />);
    expect(document.querySelector('[data-table-search]')).not.toBeInTheDocument();
  });

  it('hides technical id columns from the table', () => {
    const columns: ReportColumn[] = [...COLUMNS, { key: 'callUniqueid', header: 'Call ID', type: 'text' }];
    render(<ReportTable {...base} columns={columns} rows={ROWS.map((r) => ({ ...r, callUniqueid: 'abc-123' }))} />);
    expect(screen.queryByText('abc-123')).not.toBeInTheDocument();
  });

  it('renders cards on a phone, with totals and row activation', () => {
    const onRowActivate = vi.fn();
    render(<ReportTable {...base} mobile onRowActivate={onRowActivate} />);
    expect(screen.getByTestId('cc-report-cards')).toBeInTheDocument();
    expect(screen.queryByTestId('hybrid-table')).not.toBeInTheDocument();
    expect(screen.getByTestId('cc-report-totals')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('cc-report-card')[0]);
    expect(onRowActivate).toHaveBeenCalledWith(ROWS[0]);
  });

  it('paginates cards on a phone with "show more"', () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ queueName: `q${i}`, totalCalls: i, slaPct: 80, ahtSec: 30 }));
    render(<ReportTable {...base} aggregate={false} rows={many} mobile />);
    expect(screen.getAllByTestId('cc-report-card')).toHaveLength(30);
    fireEvent.click(screen.getByTestId('cc-report-more'));
    expect(screen.getAllByTestId('cc-report-card')).toHaveLength(45);
  });

  it('extra row actions do not activate the row', () => {
    const onRowActivate = vi.fn();
    const onAction = vi.fn();
    render(
      <ReportTable
        {...base}
        mobile
        onRowActivate={onRowActivate}
        renderRowActions={() => <Button type="button" data-testid="act" onClick={onAction}>x</Button>}
      />,
    );
    fireEvent.click(screen.getAllByTestId('act')[0]);
    expect(onAction).toHaveBeenCalled();
    expect(onRowActivate).not.toHaveBeenCalled();
  });
});
