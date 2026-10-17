import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReportPeriodBar } from './ReportPeriodBar';
import { presetRange, shiftRange } from '../../lib/reportPeriod';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

const TODAY = '2026-10-15';

describe('ReportPeriodBar (cc-ux U3.1)', () => {
  it('applies a preset', () => {
    const onChange = vi.fn();
    render(<ReportPeriodBar value={presetRange('today', TODAY)} onChange={onChange} today={TODAY} />);
    fireEvent.click(screen.getByText('30d'));
    expect(onChange).toHaveBeenCalledWith(presetRange('30d', TODAY));
  });

  it('steps back by the length of the range and cannot step into the future', () => {
    const onChange = vi.fn();
    const value = presetRange('7d', TODAY);
    render(<ReportPeriodBar value={value} onChange={onChange} today={TODAY} />);
    expect(screen.getByTestId('cc-report-period-next')).toBeDisabled();
    fireEvent.click(screen.getByTestId('cc-report-period-prev'));
    expect(onChange).toHaveBeenCalledWith(shiftRange(value, -1));
  });

  it('shows date fields for an arbitrary (custom) range and edits one bound', () => {
    const onChange = vi.fn();
    render(<ReportPeriodBar value={{ from: '2026-09-01', to: '2026-09-03' }} onChange={onChange} today={TODAY} />);
    const from = screen.getByLabelText('From') as HTMLInputElement;
    fireEvent.change(from, { target: { value: '2026-08-30' } });
    expect(onChange).toHaveBeenCalledWith({ from: '2026-08-30', to: '2026-09-03' });
  });

  it('single-day mode shows one date and sets both bounds', () => {
    const onChange = vi.fn();
    render(<ReportPeriodBar value={{ from: '2026-10-10', to: '2026-10-10' }} onChange={onChange} singleDay today={TODAY} />);
    expect(screen.queryByTestId('cc-report-period-prev')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-11' } });
    expect(onChange).toHaveBeenCalledWith({ from: '2026-10-11', to: '2026-10-11' });
  });
});
