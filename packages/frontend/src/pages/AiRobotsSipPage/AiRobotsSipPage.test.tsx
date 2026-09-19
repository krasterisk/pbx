import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiRobotsSipPage } from './AiRobotsSipPage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/aiRobots/api/aiVoiceApi', () => ({
  useGetAiSipConnectionsQuery: () => ({ data: [] }),
  useCreateAiSipConnectionMutation: () => [vi.fn()],
}));

describe('AiRobotsSipPage', () => {
  it('renders SIP wizard copy', () => {
    render(<AiRobotsSipPage />);
    expect(screen.getByTestId('ai-robots-sip')).toBeInTheDocument();
  });
});
