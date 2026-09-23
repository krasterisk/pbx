import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignGeneralTab } from './CampaignGeneralTab';
import { CampaignPacingTab } from './CampaignPacingTab';
import { emptyCampaignDraft } from '../../model/campaignDraft';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialBasesQuery: () => ({
    data: [{ uid: 1, name: 'Base A' }],
  }),
}));

vi.mock('@/shared/api/endpoints/promptsApi', () => ({
  useGetPromptsQuery: () => ({
    data: [{ uid: 9, filename: 'leave.wav', comment: 'Leave msg' }],
  }),
}));

vi.mock('@/shared/api/endpoints/queueApi', () => ({
  useGetQueuesQuery: () => ({
    data: [{ name: 'sales' }, { name: 'support' }],
  }),
}));

const dialModeOptions = [
  { value: 'progressive', label: 'Progressive' },
  { value: 'power', label: 'Power' },
  { value: 'agentless', label: 'Agentless' },
  { value: 'predictive', label: 'Predictive' },
];

describe('CampaignGeneralTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render the General queues MultiSelect', () => {
    render(
      <CampaignGeneralTab
        draft={emptyCampaignDraft()}
        onChange={() => undefined}
        errors={{}}
        dialModeOptions={dialModeOptions}
      />,
    );

    expect(screen.queryByText('autodial.form.queues')).not.toBeInTheDocument();
    expect(screen.getByText('autodial.amd.title')).toBeInTheDocument();
    expect(screen.getByLabelText(/autodial.form.dialMode/)).toBeInTheDocument();
  });

  it('enables leave-a-message and asks for a prompt', () => {
    const draft = {
      ...emptyCampaignDraft(),
      amd: { enabled: true, on_machine: 'voicemail' as const, message_prompt: null },
    };
    render(
      <CampaignGeneralTab
        draft={draft}
        onChange={() => undefined}
        errors={{ amd: 'messageRequired' }}
        dialModeOptions={dialModeOptions}
      />,
    );

    expect(screen.getByLabelText(/autodial.amd.messagePrompt/)).toBeInTheDocument();
    expect(screen.getByText('autodial.amd.messageRequired')).toBeInTheDocument();
    expect(screen.queryByText('autodial.amd.voicemailUnavailable')).not.toBeInTheDocument();
  });
});

describe('CampaignPacingTab', () => {
  it('keeps the operator-pool MultiSelect on the queue_agents provider', () => {
    const draft = {
      ...emptyCampaignDraft(),
      pacing: {
        providers: [{ type: 'queue_agents' as const, queue_names: ['sales'] }],
      },
    };

    render(
      <CampaignPacingTab draft={draft} onChange={() => undefined} errors={{}} />,
    );

    expect(screen.getByText('autodial.pacing.queues')).toBeInTheDocument();
    expect(screen.queryByText('autodial.amd.title')).not.toBeInTheDocument();
  });
});
