import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiRobotsKnowledgePage } from './AiRobotsKnowledgePage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/aiRobots/api/aiToolsApi', () => ({
  useGetKnowledgeBasesQuery: () => ({ data: [] }),
  useCreateKnowledgeBaseMutation: () => [vi.fn()],
}));

describe('AiRobotsKnowledgePage', () => {
  it('renders knowledge heading', () => {
    render(<AiRobotsKnowledgePage />);
    expect(screen.getByTestId('ai-robots-knowledge')).toBeInTheDocument();
  });
});
