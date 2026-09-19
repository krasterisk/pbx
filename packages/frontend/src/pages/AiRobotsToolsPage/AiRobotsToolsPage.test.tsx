import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiRobotsToolsPage } from './AiRobotsToolsPage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/aiRobots/api/aiToolsApi', () => ({
  useGetAiToolsQuery: () => ({ data: [] }),
  useCreateAiToolMutation: () => [vi.fn()],
}));

describe('AiRobotsToolsPage', () => {
  it('renders tools heading', () => {
    render(<AiRobotsToolsPage />);
    expect(screen.getByTestId('ai-robots-tools')).toBeInTheDocument();
  });
});
