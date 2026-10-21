import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { IAutodialMonitorHealth } from '@krasterisk/shared';
import { MonitorHealthPanel } from './MonitorHealthPanel';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../AutodialAiAction/AutodialAiAction', () => ({ AutodialAiAction: () => null }));
const health = (ari: boolean, ami: boolean) => ({ ari_connected: ari, ami_connected: ami, checked_at: '2026-10-18T00:00:00Z', campaigns: [] }) as unknown as IAutodialMonitorHealth;
describe('PBX connection text', () => {
  it('does not present cached connections as current after query failure', () => {
    render(<MonitorHealthPanel health={health(true, true)} stats={[]} failed summaryOnly />);
    expect(screen.getByText('ARI · autodial.workspace.pbxUnknown')).toBeInTheDocument();
    expect(screen.getByText('AMI · autodial.workspace.pbxUnknown')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('autodial.workspace.healthUnavailable');
  });
  it('identifies a partial outage without relying on color', () => {
    render(<MonitorHealthPanel health={health(true, false)} stats={[]} failed={false} summaryOnly />);
    expect(screen.getByText('ARI · autodial.workspace.pbxOnline')).toBeInTheDocument();
    expect(screen.getByText('AMI · autodial.workspace.pbxOffline')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('autodial.workspace.pbxDisconnected');
  });
  it('keeps the initial state unknown', () => {
    render(<MonitorHealthPanel stats={[]} failed={false} summaryOnly />);
    expect(screen.getByText('ARI · autodial.workspace.pbxUnknown')).toBeInTheDocument();
  });
});
