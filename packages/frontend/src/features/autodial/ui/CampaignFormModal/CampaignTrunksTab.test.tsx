import { fireEvent, render, screen } from '@testing-library/react';
import { vi, describe, expect, it } from 'vitest';
import type { AutodialCampaignDraft } from '../../model/campaignDraft';
import { CampaignTrunksTab } from './CampaignTrunksTab';

const mocks = vi.hoisted(() => ({
  onChange: vi.fn(),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/api/endpoints/trunkApi', () => ({
  useGetTrunksQuery: () => ({ data: [{ id: 'trunk-1', name: 'Primary' }] }),
}));
vi.mock('@/shared/api/endpoints/directoryApi', () => ({
  useGetDirectoriesQuery: () => ({ data: [{ uid: 5, name: 'Regions' }], isLoading: false }),
  useGetDirectoryQuery: () => ({ data: { fields: [{ uid: 17, key: 'cid', label: 'Caller ID', type: 'phone' }] }, isLoading: false }),
}));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialBaseQuery: () => ({ data: { fields: [{ uid: 1, key: 'region', label: 'Region' }] } }),
}));

function draft(overrides: Partial<AutodialCampaignDraft> = {}): AutodialCampaignDraft {
  return {
    name: 'Campaign',
    dial_mode: 'progressive',
    base_uid: 8,
    pacing: { providers: [{ type: 'static', max_channels: 1 }] },
    retry: { max_attempts: 3, default_interval_sec: 60, intervals_sec: {} },
    trunk_pool: [{ trunk_id: 'trunk-1', caller_id: '74950000000' }],
    cid_policy: { mode: 'per_trunk' },
    queue_names: ['sales'],
    scenario_actions: [],
    amd: { enabled: false, on_machine: 'hangup' },
    success_min_sec: 20,
    dial_timeout_sec: 30,
    schedules: [],
    ...overrides,
  };
}

describe('CampaignTrunksTab', () => {
  it('moves a Caller ID list into the selected trunk instead of the campaign-wide policy', () => {
    const { rerender } = render(
      <CampaignTrunksTab draft={draft()} onChange={mocks.onChange} errors={{}} />,
    );

    fireEvent.change(screen.getByLabelText('autodial.trunks.callerIdSource'), {
      target: { value: 'pool' },
    });

    expect(mocks.onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      trunk_pool: [expect.objectContaining({
        caller_id_source: { mode: 'pool', numbers: [], pick: 'round_robin' },
      })],
    }));
    rerender(
      <CampaignTrunksTab
        draft={draft({
          trunk_pool: [{
            trunk_id: 'trunk-1',
            caller_id_source: { mode: 'pool', numbers: [], pick: 'round_robin' },
          }],
        })}
        onChange={mocks.onChange}
        errors={{}}
      />,
    );
    expect(screen.getByLabelText('autodial.trunks.callerIdPoolNumbers')).toBeInTheDocument();
    expect(screen.queryByText('autodial.cid.title')).not.toBeInTheDocument();
  });

  it('keeps the prior shared policy visible as a migration warning', () => {
    render(
      <CampaignTrunksTab
        draft={draft({ cid_policy: { mode: 'rotate', pool: ['74950000000'] } })}
        onChange={mocks.onChange}
        errors={{}}
      />,
    );

    expect(screen.getByText('autodial.trunks.legacyCallerIdWarning')).toBeInTheDocument();
  });
});
