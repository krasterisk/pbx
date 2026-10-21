import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CallRecord, CallJourneyStep } from '@krasterisk/shared';
import { CallRouteView } from './CallRouteView';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ru' } }),
}));
const transfer: CallJourneyStep = {
  id: 'transfer',
  kind: 'transfer',
  at: '2026-10-18T06:03:04Z',
  until: null,
  actor: {
    id: '101',
    number: '101',
    name: 'Анна',
    kind: 'employee',
    department: null,
  },
  target: {
    id: '102',
    number: '102',
    name: 'Сергей',
    kind: 'employee',
    department: null,
  },
  result: 'answered',
  evidence: 'cel',
};
describe('call route presentation', () => {
  it('shows the full human handoff, timezone-aware seconds and honest partial coverage in either view', () => {
    const call = {
      startedAt: '2026-10-18T06:03:01Z',
      historyComplete: false,
      journey: [transfer],
      route: {
        coverage: 'partial',
        nodes: [
          {
            id: 'transfer',
            kind: 'transfer',
            steps: [transfer],
            possibleParallel: false,
          },
        ],
      },
    } as CallRecord;
    render(
      <CallRouteView
        call={call}
        timezone="Asia/Krasnoyarsk"
        label={(party) => party?.name || ''}
      />,
    );
    expect(screen.getAllByText(/Анна/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('calls.transferConnected').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/13:03:04/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'calls.partialHistoryLabel',
    );
    fireEvent.click(screen.getByRole('button', { name: 'calls.routeScheme' }));
    expect(
      screen.getByRole('button', { name: 'calls.routeTimeline' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText(/Сергей/).length).toBeGreaterThan(0);
  });
});
