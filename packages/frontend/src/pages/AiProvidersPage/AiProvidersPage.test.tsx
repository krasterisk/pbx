import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/ai-providers', () => ({
  AiProvidersTable: () => <div data-testid="ai-providers-table-stub">providers</div>,
  AiProviderModal: () => null,
}));

import { AiProvidersPage } from './AiProvidersPage';

describe('AiProvidersPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<AiProvidersPage />);

    expect(screen.getByTestId('ai-providers-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'aiProviders.title' })).toBeInTheDocument();
    expect(screen.getByText('aiProviders.subtitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aiProviders.newProvider/i })).toBeInTheDocument();
    expect(screen.getByTestId('ai-providers-table-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-providers-chat-default')).not.toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<AiProvidersPage />);
    await user.click(screen.getByRole('button', { name: /aiProviders.newProvider/i }));
    expect(screen.getByRole('button', { name: /aiProviders.newProvider/i })).toBeInTheDocument();
  });
});
