import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { IAutodialTestCallStatus } from '@krasterisk/shared';
import type { AutodialCampaignWithSchedules } from '@/shared/api/endpoints/autodialApi';
import { LaunchReadinessSummary } from './LaunchReadinessSummary';
const mocks = vi.hoisted(() => ({ test: null as IAutodialTestCallStatus | null, failed: false }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: unknown) => key + (values ? JSON.stringify(values) : '') }) }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialLatestTestCallQuery: () => ({ currentData: mocks.test, isError: mocks.failed, isFetching: false }),
  useGetAutodialDiagnosisQuery: () => ({ currentData: { ready_agents: 3 }, isError: false }),
}));
vi.mock('@/shared/api/endpoints/trunkApi', () => ({ useGetTrunksQuery: () => ({ data: [{ id: 't_test', name: 'Friendly route' }] }) }));
vi.mock('@/shared/api/endpoints/queueApi', () => ({ useGetQueuesQuery: () => ({ data: [{ name: 'q_test', display_name: 'Support' }] }) }));
const campaign = { uid: 18, revision: 2, applied_revision: 2, business_goal: 'survey', dial_mode: 'agentless', schedules: [],
  pacing: { providers: [{ type: 'static', max_channels: 1 }] }, retry: { max_attempts: 2, default_interval_sec: 60 },
  trunk_pool: [{ trunk_id: 't_test', max_channels: 1, caller_id_source: { mode: 'static', value: '00991420' } }],
} as unknown as AutodialCampaignWithSchedules;
const view = () => render(<MemoryRouter><LaunchReadinessSummary campaign={campaign} onClose={vi.fn()} /></MemoryRouter>);
describe('launch rules and test evidence', () => {
  beforeEach(() => { mocks.test = null; mocks.failed = false; });
  it('shows the stored goal and exact revision, and keeps no test distinct from success', () => {
    view();
    expect(screen.getByText(/launchGoal.*goals.survey/)).toBeInTheDocument();
    expect(screen.getByText(/launchRevision.*"revision":2.*"applied":2/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('autodial.workspace.launchOwnTest'));
    expect(screen.getByText('autodial.workspace.launchTestAbsent')).toBeVisible();
    expect(screen.queryByText('autodial.workspace.testEvidence.playbackCompleted')).not.toBeInTheDocument();
  });
  it('does not relabel an old failed or partial test as the current verified conversation', () => {
    mocks.test = { uid: 'a1234567-1234-1234-1234-123456789abc', status: 'ended', revision: 1, created_at: '2026-10-18T10:00:00Z',
      contact_uid: 1, endpoint: 'e00991419_0', deadline_at: null, remaining_sec: 0, ended_at: '2026-10-18T10:00:30Z',
      result: { delivery: 'playback_failed' }, snapshot: { version: 1, revision: 1, steps: [], skipped_steps: ['queue'], variables: [{ name: 'AC_NAME', value: 'private-value' }] },
    };
    view(); fireEvent.click(screen.getByText('autodial.workspace.launchOwnTest'));
    expect(screen.getByRole('alert')).toHaveTextContent('autodial.workspace.launchTestStale');
    expect(screen.getByText('autodial.workspace.testEvidence.playbackFailed')).toBeVisible();
    expect(screen.getByText('autodial.workspace.launchTestSkipped')).toBeVisible();
    expect(screen.queryByText('private-value')).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/autodial/campaigns/18?tab=scenario&ac_test=a1234567-1234-1234-1234-123456789abc');
  });
  it('shows a query failure rather than a false absence of tests', () => {
    mocks.failed = true; view(); fireEvent.click(screen.getByText('autodial.workspace.launchOwnTest'));
    expect(screen.getByRole('alert')).toHaveTextContent('autodial.common.loadFailed');
    expect(screen.queryByText('autodial.workspace.launchTestAbsent')).not.toBeInTheDocument();
  });
  it('uses the human route name and preserves the configured caller ID and retry limits', () => {
    view(); fireEvent.click(screen.getByText('autodial.workspace.launchRules'));
    expect(screen.getByText(/Friendly route.*00991420/)).toBeVisible();
    expect(screen.getByText(/launchRetry.*"attempts":2/)).toBeVisible();
  });
});
