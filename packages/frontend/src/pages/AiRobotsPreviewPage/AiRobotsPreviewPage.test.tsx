import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiRobotsPreviewPage } from './AiRobotsPreviewPage';

const getUserMedia = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: { expires?: string }) => opts?.expires ?? key }),
}));

vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }));

vi.mock('@/features/aiRobots/api/aiVoiceApi', () => ({
  useGetAiVoiceDeploymentsQuery: () => ({
    data: [{ id: 'dep-1', kind: 'browser_test', status: 'ready', agent_uid: 1, active_version_id: 'v1', revision: 1 }],
  }),
  useIssueAiVoiceBrowserTicketMutation: () => [vi.fn()],
}));

describe('AiRobotsPreviewPage', () => {
  it('does not request the microphone until Start', () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    render(<AiRobotsPreviewPage />);
    expect(screen.getByTestId('ai-robots-preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'aiRobots.startPreview' })).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
