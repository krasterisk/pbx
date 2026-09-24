import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('@/features/ai-providers', () => ({
  AiProvidersTable: ({ capability }: { capability: string }) => (
    <div data-testid="stt-engines-table-stub">{capability}</div>
  ),
  AiProviderModal: ({ requiredCapability }: { requiredCapability: string }) => (
    <div data-testid="stt-provider-modal">{requiredCapability}</div>
  ),
}));

import { SttEnginesPage } from './SttEnginesPage';

describe('SttEnginesPage', () => {
  it('renders the STT catalog filtered to that capability', () => {
    render(<SttEnginesPage />);

    expect(screen.getByTestId('stt-engines-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'sttEngines.title' })).toBeInTheDocument();
    expect(screen.getByText('sttEngines.subtitle')).toBeInTheDocument();
    expect(screen.getByTestId('stt-engines-table-stub')).toHaveTextContent('stt');
  });

  it('opens create with STT already selected', async () => {
    const user = userEvent.setup();
    render(<SttEnginesPage />);

    await user.click(screen.getByRole('button', { name: /sttEngines.add/i }));
    expect(screen.getByTestId('stt-provider-modal')).toHaveTextContent('stt');
  });
});
