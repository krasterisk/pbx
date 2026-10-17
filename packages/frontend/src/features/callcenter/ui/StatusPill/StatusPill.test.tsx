import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { AgentStatus } from '../../model/types/callCenterSchema';
import { StatusPill } from './StatusPill';

const ALL_STATUSES: AgentStatus[] = [
  'OFFLINE',
  'READY',
  'IN_CALL',
  'RINGING',
  'PAUSED',
  'WRAPUP',
  'DIALING',
  'CONSULT',
  'ACW',
  'OUTBOUND_WORK',
];

describe('StatusPill (U0.6)', () => {
  it.each(ALL_STATUSES)('renders icon + text for %s', (status) => {
    const { unmount } = render(<StatusPill status={status} />);
    const pill = screen.getByTestId('cc-status-pill');
    expect(pill).toHaveAttribute('data-status', status);
    expect(pill.textContent?.trim().length).toBeGreaterThan(0);
    expect(pill.querySelector('svg')).toBeTruthy();
    unmount();
  });

  it('marks queuesDetached and overrun states', () => {
    render(<StatusPill status="PAUSED" queuesDetached timer="25:10" overrun />);
    const pill = screen.getByTestId('cc-status-pill');
    expect(pill).toHaveAttribute('data-status', 'DETACHED');
    expect(pill).toHaveAttribute('data-overrun', 'true');
    expect(pill).toHaveTextContent('25:10');
  });
});
