import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { CcDashboardPauses } from '@krasterisk/shared';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg?: string | Record<string, unknown>) => (typeof arg === 'string' ? arg : String(arg?.defaultValue ?? key)),
  }),
}));

import { CcPausesPanel } from './CcPausesPanel';

const pauses = (partial: Partial<CcDashboardPauses> = {}): CcDashboardPauses => ({
  count: 4,
  totalSec: 4000,
  paidSec: 1000,
  unpaidSec: 2400,
  unknownSec: 600,
  reasons: [
    { reason: 'Lunch', count: 2, totalSec: 2400, isPaid: false },
    { reason: 'Training', count: 1, totalSec: 1000, isPaid: true },
    { reason: '(none)', count: 1, totalSec: 600, isPaid: null },
  ],
  previousTotalSec: 5000,
  ...partial,
});

describe('CcPausesPanel', () => {
  it('shows total, paid, unpaid and unknown time', () => {
    render(<CcPausesPanel pauses={pauses()} compare />);
    expect(screen.getByTestId('cc-pauses-total')).toHaveTextContent('1 h 07 min');
    expect(screen.getByTestId('cc-pauses-paid')).toHaveTextContent('17 min');
    expect(screen.getByTestId('cc-pauses-unpaid')).toHaveTextContent('40 min');
    expect(screen.getByTestId('cc-pauses-unknown')).toHaveTextContent('10 min');
  });

  it('hides the unknown figure when every reason is catalogued', () => {
    render(<CcPausesPanel pauses={pauses({ unknownSec: 0 })} compare />);
    expect(screen.queryByTestId('cc-pauses-unknown')).not.toBeInTheDocument();
  });

  it('lists reasons largest first with their share, naming the reasonless pauses', () => {
    render(<CcPausesPanel pauses={pauses()} compare />);
    expect(screen.getByTestId('cc-pauses-row-0')).toHaveTextContent('Lunch');
    expect(screen.getByTestId('cc-pauses-row-0')).toHaveTextContent('40 min · 60%');
    expect(screen.getByTestId('cc-pauses-row-2')).toHaveTextContent('No reason given');
  });

  it('less pause time than before is an improvement', () => {
    render(<CcPausesPanel pauses={pauses()} compare />);
    expect(screen.getByTestId('cc-pauses-delta')).toHaveAttribute('data-tone', 'success');
  });

  it('says so when comparison is off', () => {
    render(<CcPausesPanel pauses={pauses({ previousTotalSec: null })} compare={false} />);
    expect(screen.getByTestId('cc-pauses-nocompare')).toHaveTextContent('Comparison is off');
  });

  it('says there were no pauses instead of zeros', () => {
    render(<CcPausesPanel pauses={pauses({ count: 0, totalSec: 0, reasons: [] })} compare />);
    expect(screen.getByTestId('cc-pauses-empty')).toBeInTheDocument();
  });
});
