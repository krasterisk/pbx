import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/ai-providers', () => ({
  AiProvidersTable: () => null,
  AiProviderModal: () => null,
}));

import { AiProvidersPage } from './AiProvidersPage';

describe('AiProvidersPage', () => {
  it('renders the section title and overflow marker', () => {
    render(<AiProvidersPage />);
    expect(screen.getByTestId('ai-providers-page-responsive')).toBeInTheDocument();
    expect(screen.getByText('aiProviders.title')).toBeInTheDocument();
    expect(screen.getByText('aiProviders.subtitle')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(screen.queryByTestId('ai-providers-chat-default')).not.toBeInTheDocument();
  });
});
