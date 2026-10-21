import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MonitorBoard } from './MonitorBoard';
const mocks = vi.hoisted(() => ({
  live: { status: 'open', snapshotReceivedAt: 1, channels: [], runtimes: {}, recent: [], healthError: undefined },
  health: { ari_connected: true, ami_connected: true, checked_at: '', campaigns: [] }, failed: false,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../lib/useAutodialSse', () => ({ useAutodialSse: () => mocks.live }));
vi.mock('./MonitorHealthPanel', () => ({ MonitorHealthPanel: () => null }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialCampaignsQuery: () => ({ data: [] }),
  useGetAutodialMonitorQuery: () => ({ currentData: [], isError: false, refetch: vi.fn() }),
  useGetAutodialMonitorHealthQuery: () => ({ currentData: mocks.health, isError: mocks.failed }),
}));
describe('live call count provenance', () => {
  beforeEach(() => { mocks.live.status = 'open'; mocks.health.ari_connected = true; mocks.health.checked_at = new Date().toISOString(); mocks.failed = false; });
  it('shows a real zero only with a current ARI connection and event stream', () => {
    render(<MonitorBoard />);
    expect(screen.getByText('autodial.monitor.noCalls')).toBeInTheDocument();
    expect(screen.queryByText('autodial.workspace.liveCallsUnknown')).not.toBeInTheDocument();
  });
  it.each(['ari_offline', 'stream_disconnected', 'query_error', 'stale_health'])('keeps %s distinct from zero calls', (reason) => {
    if (reason === 'ari_offline') mocks.health.ari_connected = false;
    if (reason === 'stream_disconnected') mocks.live.status = 'disconnected';
    if (reason === 'query_error') mocks.failed = true;
    if (reason === 'stale_health') mocks.health.checked_at = new Date(Date.now() - 60_000).toISOString();
    render(<MonitorBoard />);
    expect(screen.getByText('autodial.workspace.liveCallsUnknown')).toBeInTheDocument();
    expect(screen.queryByText('autodial.monitor.noCalls')).not.toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(4);
  });
});
