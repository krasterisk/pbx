import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const useIsMobileMock = vi.fn((_bp?: number) => false);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
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
    isLoading: false,
  }),
  useDeleteAiProviderMutation: () => [vi.fn()],
}));

import { AiProvidersTable } from './AiProvidersTable';

describe('AiProvidersTable', () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
  });

  it('renders provider rows and row actions', () => {
    render(<AiProvidersTable onEdit={vi.fn()} />);
    expect(screen.getByText('Office LLM')).toBeInTheDocument();
    const edit = screen.getByLabelText('common.edit');
    const del = screen.getByLabelText('common.delete');
    expect(edit).toHaveAttribute('title');
    expect(edit).toHaveAttribute('aria-label');
    expect(del).toHaveAttribute('title');
    expect(del).toHaveAttribute('aria-label');
  });

  it('renders overflow-x-auto hybrid marker on desktop', () => {
    render(<AiProvidersTable onEdit={vi.fn()} />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(screen.getByTestId('ai-providers-table-scroll')).toBeInTheDocument();
  });

  it('renders mobile-card hybrid marker when useIsMobile is true', () => {
    useIsMobileMock.mockReturnValue(true);
    render(<AiProvidersTable onEdit={vi.fn()} />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'mobile-card');
    expect(screen.getByTestId('ai-providers-mobile-card')).toBeInTheDocument();
    expect(screen.getByText('Office LLM')).toBeInTheDocument();
  });
});
