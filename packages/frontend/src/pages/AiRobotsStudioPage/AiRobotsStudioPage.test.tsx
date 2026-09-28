import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AI_VOICE_ROBOT_DEFAULTS } from '@krasterisk/shared';
import { AiRobotsStudioPage } from './AiRobotsStudioPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('@/shared/api/endpoints/aiVoiceRobotsApi', () => ({
  useGetAiVoiceRobotsQuery: () => ({ data: [{ uid: 1, revision: 1, robotUuid: 'r1', versionId: 'v1',
    config: { ...AI_VOICE_ROBOT_DEFAULTS, name: 'Pilot', mode: 'cascade' } }] }),
}));

vi.mock('@/features/aiRobots/ui/RobotEditor', () => ({
  RobotEditor: () => null,
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
