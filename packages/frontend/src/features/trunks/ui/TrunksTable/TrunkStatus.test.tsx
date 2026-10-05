import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrunkStatus } from './TrunkStatus';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('TrunkStatus', () => {
  it.each(['Reachable', 'Unreachable', 'Unqualified', 'Unknown'] as const)('displays IP contact state %s instead of the old IP placeholder', (state) => {
    const { container } = render(<TrunkStatus trunkType="ip" registrationStatus={null} reachabilityStatus={state} />);
    expect(screen.getByText('trunks.reachability' + state)).toBeInTheDocument();
    expect(screen.queryByText('IP')).not.toBeInTheDocument();
    expect(container.querySelector('[data-reachability]')).toHaveAttribute('data-reachability', state);
    const dot = container.querySelector('span[aria-hidden]');
    expect(dot?.className).toContain(state === 'Reachable' ? 'statusDotRegistered' : state === 'Unreachable' ? 'statusDotRejected' : 'statusDotUnknown');
  });
  it('shows registration and unavailable contact as distinct states', () => {
    render(<TrunkStatus trunkType="auth" registrationStatus="Registered" reachabilityStatus="Unreachable" />);
    expect(screen.getByText('trunks.statusRegistered')).toBeInTheDocument();
    expect(screen.getByText('trunks.reachabilityUnreachable')).toBeInTheDocument();
  });
  it('defaults to unknown for old API responses without contact status', () => {
    render(<TrunkStatus trunkType="ip" registrationStatus={null} />);
    expect(screen.getByText('trunks.reachabilityUnknown')).toBeInTheDocument();
  });
});
