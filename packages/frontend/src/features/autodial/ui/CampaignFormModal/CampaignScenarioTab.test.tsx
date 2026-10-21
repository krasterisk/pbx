import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignScenarioTab } from './CampaignScenarioTab';
import { emptyCampaignDraft } from '../../model/campaignDraft';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialBaseQuery: () => ({ currentData: { fields: [] } }),
  useGetAutodialCapabilitiesQuery: () => ({ data: { tts_engines: [] }, isLoading: false, refetch: vi.fn() }),
}));
vi.mock('@/features/dialplan-apps', () => ({ DialplanAppsEditor: () => null }));
vi.mock('./AutodialSpeechBuilder', () => ({ AutodialSpeechBuilder: () => null }));
vi.mock('./AutodialOutcomeEditor', () => ({ AutodialOutcomeEditor: () => null }));
vi.mock('./ConversationLibrary', () => ({ ConversationLibrary: ({ initialGoal }: { initialGoal?: string }) => <span data-testid="initial-template-goal">{initialGoal ?? 'library-default'}</span> }));
describe('existing campaign template goal', () => {
  it('opens the library on the stored goal without changing the saved conversation', () => {
    const change = vi.fn();
    render(<CampaignScenarioTab draft={{ ...emptyCampaignDraft(), business_goal: 'survey' }} onChange={change} errors={{}} />);
    expect(screen.getByTestId('initial-template-goal')).toHaveTextContent('survey');
    expect(change).not.toHaveBeenCalled();
  });
  it('retains the library default for a legacy custom goal', () => {
    render(<CampaignScenarioTab draft={{ ...emptyCampaignDraft(), business_goal: 'custom' }} onChange={vi.fn()} errors={{}} />);
    expect(screen.getByTestId('initial-template-goal')).toHaveTextContent('library-default');
  });
});
