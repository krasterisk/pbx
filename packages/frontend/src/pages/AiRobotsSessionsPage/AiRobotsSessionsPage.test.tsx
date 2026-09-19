import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiRobotsSessionsPage } from './AiRobotsSessionsPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/aiRobots/api/aiVoiceApi', () => ({
  useGetAiVoiceSessionsQuery: () => ({
    data: [{
      id: 's1', deployment_id: 'd1', version_id: 'v1',
      ingress_kind: 'browser_test', state: 'completed', reason: null,
      started_at: '2026-09-19', ended_at: null,
    }],
  }),
  useGetAiVoiceTimelineQuery: () => ({ data: undefined }),
}));

describe('AiRobotsSessionsPage', () => {
  it('renders session journal', () => {
    render(<AiRobotsSessionsPage />);
    expect(screen.getByTestId('ai-robots-sessions')).toBeInTheDocument();
    expect(screen.getByText('s1')).toBeInTheDocument();
  });
});
