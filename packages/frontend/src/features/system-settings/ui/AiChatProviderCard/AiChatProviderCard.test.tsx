import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/shared/api/endpoints/aiAgentsApi', () => ({
  useGetAiProvidersQuery: () => ({
    data: [
      {
        uid: 7,
        name: 'Tenant LLM',
        vendor: 'openai',
        enabled: true,
        capabilities: ['llm'],
        defaults: { model: 'gpt-4o-mini' },
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/shared/api/endpoints/aiChatApi', () => ({
  useGetAiChatDefaultProviderQuery: () => ({ data: { providerUid: 7 } }),
  useUpdateAiChatDefaultProviderMutation: () => [vi.fn()],
}));

import { AiChatProviderCard } from './AiChatProviderCard';

function renderCard() {
  return render(
    <MemoryRouter>
      <AiChatProviderCard />
    </MemoryRouter>,
  );
}

describe('AiChatProviderCard', () => {
  it('lets the tenant pick a chat LLM and links to providers', () => {
    renderCard();
    expect(screen.getByTestId('ai-chat-provider-card')).toBeInTheDocument();
    expect(screen.getByTestId('ai-chat-provider')).toHaveValue('7');
    expect(screen.getByTestId('ai-chat-all-providers')).toHaveAttribute('href', '/ai-providers');
  });
});
