import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'ttsEngines/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('@/features/tts-engines/model/slice/ttsEnginesSlice', () => ({
  ttsEnginesActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

vi.mock('@/features/tts-engines/ui/TtsEnginesTable', () => ({
  TtsEnginesTable: () => <div data-testid="tts-engines-table-stub">tts</div>,
}));

import { TtsEnginesPage } from './TtsEnginesPage';

describe('TtsEnginesPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<TtsEnginesPage />);

    expect(screen.getByTestId('tts-engines-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ttsEngines.title' })).toBeInTheDocument();
    expect(screen.getByText('ttsEngines.subtitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ttsEngines.add/i })).toBeInTheDocument();
    expect(screen.getByTestId('tts-engines-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<TtsEnginesPage />);

    await user.click(screen.getByRole('button', { name: /ttsEngines.add/i }));
    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'ttsEngines/openCreateModal' });
  });
});
