import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/api/endpoints/aiAgentsApi', () => ({
  useGetAiAgentsQuery: () => ({ data: [{ uid: 1, name: 'Agent', unique_id: 'a1', mode: 'cascade', model_profile_id: null, toolset_id: null, enabled: true, greeting: '' }] }),
  useGetAiProvidersQuery: () => ({ data: [] }),
  useGetAiToolsetsQuery: () => ({ data: [] }),
  useDeleteAiAgentMutation: () => [vi.fn()],
  useDeleteAiProviderMutation: () => [vi.fn()],
  useCloneAiProviderMutation: () => [vi.fn()],
  useUpdateAiAgentMutation: () => [vi.fn()],
}));

vi.mock('@/features/ai-agents/ui/AiAgentModal/AiAgentModal', () => ({
  AiAgentModal: () => null,
}));

vi.mock('@/features/ai-agents/ui/AiProviderModal/AiProviderModal', () => ({
  AiProviderModal: () => null,
}));

import { AiAgentsPage } from './AiAgentsPage';

describe('AiAgentsPage hybrid overflow (D-29 / D-27 wave E)', () => {
  it('exposes hybrid-table overflow marker at page level', () => {
    render(<AiAgentsPage />);
    expect(screen.getByTestId('ai-agents-page-responsive')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(hybrid.className).toMatch(/overflow-x-auto/);
  });
});
