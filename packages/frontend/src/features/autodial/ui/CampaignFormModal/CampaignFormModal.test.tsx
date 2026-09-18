import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CampaignFormModal } from './CampaignFormModal';

const mocks = vi.hoisted(() => ({
  campaign: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  dispatch: vi.fn(),
  state: {
    autodialPage: {
      isCampaignModalOpen: true,
      campaignModalMode: 'edit',
      selectedCampaignUid: 11,
    },
  },
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
}));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialCampaignQuery: mocks.campaign,
  useCreateAutodialCampaignMutation: () => [mocks.create, { isLoading: false }],
  useUpdateAutodialCampaignMutation: () => [mocks.update, { isLoading: false }],
}));
vi.mock('./CampaignGeneralTab', () => ({ CampaignGeneralTab: () => null }));
vi.mock('./CampaignPacingTab', () => ({ CampaignPacingTab: () => null }));
vi.mock('./CampaignRetryTab', () => ({ CampaignRetryTab: () => null }));
vi.mock('./CampaignTrunksTab', () => ({ CampaignTrunksTab: () => null }));
vi.mock('./CampaignScheduleTab', () => ({ CampaignScheduleTab: () => null }));
vi.mock('./CampaignScenarioTab', () => ({ CampaignScenarioTab: () => null }));
vi.mock('./CampaignDncTab', () => ({ CampaignDncTab: () => null }));

const campaign = {
  uid: 11,
  revision: 4,
  name: 'Renewal',
  status: 'draft',
  dial_mode: 'progressive',
  base_uid: 2,
  pacing: { providers: [{ type: 'static', max_channels: 2 }] },
  retry: { max_attempts: 3, default_interval_sec: 3600, intervals_sec: {} },
  trunk_pool: [{ trunk_id: 'trunk-1' }],
  cid_policy: { mode: 'per_trunk' },
  queue_names: ['sales'],
  scenario_actions: [],
  amd: { enabled: false, on_machine: 'hangup' },
  success_min_sec: 20,
  dial_timeout_sec: 30,
  schedules: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.campaign.mockReturnValue({ data: campaign, isFetching: false });
  mocks.update.mockReturnValue({ unwrap: () => Promise.resolve(campaign) });
});

describe('CampaignFormModal edit session', () => {
  it('sends the revision read with the draft when saving', async () => {
    render(<CampaignFormModal />);
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: 11,
          data: expect.objectContaining({ expected_revision: 4 }),
        }),
      ),
    );
  });

  it('keeps the modal open and localizes a revision conflict', async () => {
    mocks.update.mockReturnValue({
      unwrap: () => Promise.reject({ data: { code: 'AC_CAMPAIGN_REVISION_CONFLICT' } }),
    });
    render(<CampaignFormModal />);
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    expect(await screen.findByText('autodial.errors.AC_CAMPAIGN_REVISION_CONFLICT')).toBeInTheDocument();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
