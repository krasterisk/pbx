import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StartCampaignDialog } from './StartCampaignDialog';
import type { AutodialCampaignWithSchedules } from '@/shared/api/endpoints/autodialApi';

const mocks = vi.hoisted(() => ({ start: vi.fn(), scope: {
  currentData: { campaign_revision: 1, base_revision: 8, totals: { tasks: 1, clients: 1, numbers: 1, new_tasks: 1, rearmed_tasks: 0, carried_tasks: 0, excluded_dnc_numbers: 0, active_tasks: 0 }, by_disposition: [] },
  isFetching: false, isError: false, refetch: vi.fn(),
} }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./LaunchReadinessSummary', () => ({ LaunchReadinessSummary: () => null }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialPreflightQuery: () => ({ currentData: { ready: true, revision: 1, eligible_numbers: 1, checks: [], checked_at: '2026-10-16T00:00:00Z' }, isFetching: false, refetch: vi.fn() }),
  useGetAutodialTourPreviewQuery: () => mocks.scope,
  useStartAutodialCampaignMutation: () => [mocks.start, { isLoading: false }],
}));

describe('StartCampaignDialog deployment failure', () => {
  beforeEach(() => { mocks.scope.isFetching = false; mocks.scope.isError = false; mocks.scope.currentData.campaign_revision = 1; mocks.scope.currentData.totals.tasks = 1; mocks.scope.currentData.totals.active_tasks = 0; mocks.start.mockReset(); });
  it('requires an explicit acknowledgement for a campaign without schedule restrictions', () => {
    render(<StartCampaignDialog campaign={{ uid: 12, revision: 1, name: 'Always', schedules: [] } as unknown as AutodialCampaignWithSchedules} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'autodial.campaigns.start' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'autodial.workspace.confirmAroundClock' }));
    expect(screen.getByRole('button', { name: 'autodial.campaigns.start' })).toBeEnabled();
  });
  it('keeps the dialog open and explains a failed PBX apply', async () => {
    const close = vi.fn();
    mocks.start.mockReturnValue({ unwrap: () => Promise.reject({ data: { code: 'AC_DIALPLAN_APPLY_FAILED' } }) });
    render(<StartCampaignDialog campaign={{ uid: 11, revision: 1, name: 'Test' } as AutodialCampaignWithSchedules} onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: 'autodial.campaigns.start' }));
    expect(await screen.findByText('autodial.errors.AC_DIALPLAN_APPLY_FAILED')).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
  it.each(['empty', 'loading', 'failed', 'stale', 'active'])('prevents start with %s audience', (state) => {
    if (state === 'empty') mocks.scope.currentData.totals.tasks = 0;
    if (state === 'loading') mocks.scope.isFetching = true;
    if (state === 'failed') mocks.scope.isError = true;
    if (state === 'stale') mocks.scope.currentData.campaign_revision = 2;
    if (state === 'active') mocks.scope.currentData.totals.active_tasks = 1;
    render(<StartCampaignDialog campaign={{ uid: 11, revision: 1, name: 'Test' } as AutodialCampaignWithSchedules} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'autodial.campaigns.start' })).toBeDisabled();
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it('submits the reviewed campaign and base revisions', async () => {
    mocks.start.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    const close = vi.fn();
    render(<StartCampaignDialog campaign={{ uid: 11, revision: 1, name: 'Test' } as AutodialCampaignWithSchedules} onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: 'autodial.campaigns.start' }));
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(mocks.start).toHaveBeenCalledWith({ uid: 11, include_dispositions: undefined, expected_revision: 1, expected_base_revision: 8 });
  });
});
