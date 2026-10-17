import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { CcDashboardLosses } from '@krasterisk/shared';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg?: string | Record<string, unknown>) => (typeof arg === 'string' ? arg : String(arg?.defaultValue ?? key)),
  }),
}));

import { CcLossesPanel } from './CcLossesPanel';

const losses = (partial: Partial<CcDashboardLosses> = {}): CcDashboardLosses => ({
  total: 20,
  previousTotal: 25,
  recoveredByAgent: 10,
  recoveredWithin15: 5,
  recoveredWithin60: 8,
  clientCalledBack: 2,
  pending: 8,
  waitBuckets: { upTo5: 2, upTo20: 8, upTo60: 6, over60: 4 },
  ...partial,
});

describe('CcLossesPanel', () => {
  it('shows the count, the recovery shares and what is still waiting', () => {
    render(<CcLossesPanel losses={losses()} compare />);
    expect(screen.getByTestId('cc-losses-total')).toHaveTextContent('20');
    expect(screen.getByTestId('cc-losses-15')).toHaveTextContent('25%');
    expect(screen.getByTestId('cc-losses-60')).toHaveTextContent('40%');
    expect(screen.getByTestId('cc-losses-client')).toHaveTextContent('2');
    expect(screen.getByTestId('cc-losses-pending')).toHaveTextContent('8');
    expect(screen.getByTestId('cc-losses-pending')).toHaveAttribute('data-tone', 'warning');
  });

  it('fewer losses than before is shown as an improvement', () => {
    render(<CcLossesPanel losses={losses()} compare />);
    expect(screen.getByTestId('cc-losses-delta')).toHaveAttribute('data-tone', 'success');
    expect(screen.getByTestId('cc-losses-delta')).toHaveTextContent('-20%');
  });

  it('draws the wait buckets with their counts', () => {
    render(<CcLossesPanel losses={losses()} compare />);
    expect(screen.getByTestId('cc-losses-bucket-upTo20')).toHaveTextContent('8 · 40%');
    expect(screen.getByTestId('cc-losses-bucket-over60')).toHaveTextContent('4 · 20%');
  });

  it('nothing pending is good news, and no comparison is said out loud', () => {
    render(<CcLossesPanel losses={losses({ pending: 0, previousTotal: null })} compare={false} />);
    expect(screen.getByTestId('cc-losses-pending')).toHaveAttribute('data-tone', 'success');
    expect(screen.getByTestId('cc-losses-nocompare')).toHaveTextContent('Comparison is off');
  });

  it('says there were no lost calls instead of showing zeros', () => {
    render(<CcLossesPanel losses={losses({ total: 0, previousTotal: 0, pending: 0 })} compare />);
    expect(screen.getByTestId('cc-losses-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('cc-losses-total')).not.toBeInTheDocument();
  });
});
