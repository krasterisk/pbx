import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/shared/api/endpoints/aiAgentsApi', () => ({
  useGetAiProvidersQuery: () => ({
    data: [{
      uid: 3,
      name: 'Office LLM',
      vendor: 'openai',
      kind: 'online',
      capabilities: ['llm'],
      enabled: true,
    }],
  }),
  useDeleteAiProviderMutation: () => [vi.fn()],
}));

import { AiProvidersTable } from './AiProvidersTable';

describe('AiProvidersTable', () => {
  it('renders provider rows and row actions', () => {
    render(<AiProvidersTable onEdit={vi.fn()} />);
    expect(screen.getByText('Office LLM')).toBeInTheDocument();
    expect(screen.getByLabelText('common.edit')).toBeInTheDocument();
    expect(screen.getByLabelText('common.delete')).toBeInTheDocument();
  });
});
