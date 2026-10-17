import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CcOperatorsPanel } from './CcOperatorsPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, def: string, vars?: Record<string, unknown>) =>
      typeof def === 'string' ? def.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(vars?.[k] ?? '')) : _key,
  }),
}));

const operators = {
  evaluated: 6,
  medianAhtSec: 200,
  medianPauseSharePct: 10,
  outliers: [
    { agentInterface: 'PJSIP/105', agentUserUid: 5, callsHandled: 14, ahtSec: 480, pauseSharePct: 41.5, loggedInSec: 28800, flags: ['highAht' as const, 'highPause' as const] },
    { agentInterface: 'PJSIP/106', agentUserUid: 6, callsHandled: 9, ahtSec: 410, pauseSharePct: 8, loggedInSec: 28800, flags: ['highAht' as const] },
  ],
};

describe('CcOperatorsPanel', () => {
  it('shows the medians and each outlier with the offending figures marked', () => {
    render(<CcOperatorsPanel operators={operators} onOpenOperator={() => undefined} />);
    expect(screen.getByTestId('cc-operators-medians')).toHaveTextContent('Median of 6 operators: AHT 3:20, pauses 10%');
    expect(screen.getByTestId('cc-operators-row-0')).toHaveTextContent('105');
    expect(screen.getByTestId('cc-operators-aht-0')).toHaveTextContent('AHT 8:00 (14 calls)');
    expect(screen.getByTestId('cc-operators-aht-0')).toHaveAttribute('data-flagged', 'true');
    expect(screen.getByTestId('cc-operators-pause-0')).toHaveTextContent('Pauses 41.5%');
    expect(screen.getByTestId('cc-operators-pause-0')).toHaveAttribute('data-flagged', 'true');
    expect(screen.getByTestId('cc-operators-pause-1')).toHaveAttribute('data-flagged', 'false');
  });

  it('opens the operator report for the clicked operator', () => {
    const onOpen = vi.fn();
    render(<CcOperatorsPanel operators={operators} onOpenOperator={onOpen} />);
    fireEvent.click(screen.getByTestId('cc-operators-row-1'));
    expect(onOpen).toHaveBeenCalledWith('PJSIP/106');
  });

  it('says so when nobody stands out', () => {
    render(<CcOperatorsPanel operators={{ ...operators, outliers: [] }} onOpenOperator={() => undefined} />);
    expect(screen.getByTestId('cc-operators-clear')).toBeInTheDocument();
  });

  it('does not claim "all clear" when there is nothing to compare', () => {
    render(<CcOperatorsPanel operators={{ evaluated: 2, medianAhtSec: null, medianPauseSharePct: null, outliers: [] }} onOpenOperator={() => undefined} />);
    expect(screen.getByTestId('cc-operators-nodata')).toBeInTheDocument();
    expect(screen.queryByTestId('cc-operators-clear')).toBeNull();
  });
});
