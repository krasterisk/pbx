import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/shared/api/endpoints/aiAgentsApi', () => ({
  useCreateAiProviderMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateAiProviderMutation: () => [vi.fn(), { isLoading: false }],
}));

import { AiProviderModal } from './AiProviderModal';

describe('AiProviderModal', () => {
  it('opens a create form with user-facing fields', () => {
    render(<AiProviderModal provider={null} onClose={vi.fn()} />);
    expect(screen.getByText('aiAgents.createProvider')).toBeInTheDocument();
    expect(screen.getByLabelText('aiProviders.field.name *')).toBeInTheDocument();
    expect(screen.getByLabelText('aiProviders.field.endpoint *')).toBeInTheDocument();
    expect(screen.getByLabelText('aiProviders.field.apiKey')).toBeInTheDocument();
  });
});
