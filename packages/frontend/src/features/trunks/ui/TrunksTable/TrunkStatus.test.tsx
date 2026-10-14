import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrunkStatus } from './TrunkStatus';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('TrunkStatus', () => {
  it.each(['Reachable', 'Unreachable', 'Unqualified', 'NoContacts', 'Unknown'] as const)('displays IP contact state %s as an accessible compact icon', (state) => {
    const { container } = render(<TrunkStatus trunkType="ip" registrationStatus={null} reachabilityStatus={state} />);
    expect(screen.getByRole('button', { name: 'trunks.reachabilityLabel: trunks.reachability' + state })).toBeInTheDocument();
    expect(screen.queryByText('IP')).not.toBeInTheDocument();
    expect(container.querySelector('[data-reachability]')).toHaveAttribute('data-reachability', state);
    expect(container.querySelector('[data-reachability]')).toHaveAttribute('data-status-tone', state === 'Reachable' ? 'success' : state === 'Unreachable' ? 'danger' : state === 'Unqualified' ? 'warning' : 'neutral');
    expect(screen.queryByText('trunks.reachability' + state)).not.toBeInTheDocument();
  });
  it('shows registration and unavailable contact as distinct states', () => {
    render(<TrunkStatus trunkType="auth" registrationStatus="Registered" reachabilityStatus="Unreachable" />);
    expect(screen.getByRole('button', { name: 'trunks.registrationLabel: trunks.statusRegistered' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'trunks.reachabilityLabel: trunks.reachabilityUnreachable' })).toBeInTheDocument();
  });
  it('defaults to unknown for old API responses without contact status', () => {
    render(<TrunkStatus trunkType="ip" registrationStatus={null} />);
    expect(screen.getByRole('button', { name: 'trunks.reachabilityLabel: trunks.reachabilityUnknown' })).toBeInTheDocument();
  });

  it.each(['Registered', 'Rejected', 'Unregistered', 'Stopped'] as const)('preserves registration state %s regardless of casing', (state) => {
    render(<TrunkStatus trunkType="auth" registrationStatus={state.toLowerCase()} reachabilityStatus="Reachable" />);
    expect(screen.getByRole('button', { name: `trunks.registrationLabel: trunks.status${state}` })).toHaveAttribute('data-registration', state);
  });

  it('shows a touch/click tooltip without activating the surrounding row', async () => {
    const activate = vi.fn();
    render(<div onClick={activate}><TrunkStatus trunkType="auth" registrationStatus="Rejected" reachabilityStatus="Reachable" /></div>);
    fireEvent.click(screen.getByRole('button', { name: 'trunks.registrationLabel: trunks.statusRejected' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('trunks.registrationLabel: trunks.statusRejected');
    expect(activate).not.toHaveBeenCalled();
  });

  it('opens the explanation on keyboard focus', async () => {
    render(<TrunkStatus trunkType="ip" registrationStatus={null} reachabilityStatus="NoContacts" />);
    fireEvent.focus(screen.getByRole('button', { name: 'trunks.reachabilityLabel: trunks.reachabilityNoContacts' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('trunks.reachabilityNoContacts');
  });
});
