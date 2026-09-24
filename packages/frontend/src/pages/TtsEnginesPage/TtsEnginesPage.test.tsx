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
    <div data-testid="tts-engines-table-stub">{capability}</div>
  ),
  AiProviderModal: ({ requiredCapability }: { requiredCapability: string }) => (
    <div data-testid="tts-provider-modal">{requiredCapability}</div>
  ),
}));

import { TtsEnginesPage } from './TtsEnginesPage';

describe('TtsEnginesPage', () => {
  it('renders the TTS catalog filtered to that capability', () => {
    render(<TtsEnginesPage />);

    expect(screen.getByTestId('tts-engines-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ttsEngines.title' })).toBeInTheDocument();
    expect(screen.getByText('ttsEngines.subtitle')).toBeInTheDocument();
    expect(screen.getByTestId('tts-engines-table-stub')).toHaveTextContent('tts');
  });

  it('opens create with TTS already selected', async () => {
    const user = userEvent.setup();
    render(<TtsEnginesPage />);

    await user.click(screen.getByRole('button', { name: /ttsEngines.add/i }));
    expect(screen.getByTestId('tts-provider-modal')).toHaveTextContent('tts');
  });
});
