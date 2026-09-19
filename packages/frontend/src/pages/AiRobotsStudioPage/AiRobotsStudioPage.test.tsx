import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AiRobotsStudioPage } from './AiRobotsStudioPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('@/shared/api/endpoints/aiAgentsApi', () => ({
  useGetAiAgentsQuery: () => ({
    data: [{ uid: 1, name: 'Pilot', mode: 'cascade', draft_revision: 1, enabled: true }],
  }),
  useGetAiProvidersQuery: () => ({ data: [] }),
  useGetAiToolsetsQuery: () => ({ data: [] }),
}));

vi.mock('@/features/aiRobots/api/aiVoiceApi', () => ({
  useGetAiVoiceCapabilitiesQuery: () => ({ data: { realtime: false, previewMic: 'opt-in' } }),
  useGetAiVoiceDeploymentsQuery: () => ({ data: [] }),
  usePublishAiVoiceAgentMutation: () => [vi.fn()],
  useCreateAiVoiceDeploymentMutation: () => [vi.fn()],
  useSetAiVoiceDeploymentReadyMutation: () => [vi.fn()],
}));

vi.mock('@/features/ai-agents/ui/AiAgentModal/AiAgentModal', () => ({
  AiAgentModal: () => null,
}));

describe('AiRobotsStudioPage', () => {
  it('renders studio heading and robot row', () => {
    render(
      <MemoryRouter>
        <AiRobotsStudioPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('ai-robots-studio')).toBeInTheDocument();
    expect(screen.getByText('Pilot')).toBeInTheDocument();
  });
});
