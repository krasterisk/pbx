import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/features/tts-engines/model/slice/ttsEnginesSlice', () => ({
  ttsEnginesActions: {
    openCreateModal: () => ({ type: 'ttsEngines/openCreateModal' }),
  },
}));

vi.mock('@/features/tts-engines/ui/TtsEnginesTable/TtsEnginesTable', () => ({
  TtsEnginesTable: () => <div data-testid="tts-engines-table-stub">tts</div>,
}));

import { TtsEnginesPage } from './TtsEnginesPage';

describe('TtsEnginesPage hybrid overflow (D-29 / D-27 wave D)', () => {
  it('exposes hybrid-table overflow marker at page level', () => {
    render(<TtsEnginesPage />);
    expect(screen.getByTestId('tts-engines-page-responsive')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(hybrid.className).toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('tts-engines-table-stub')).toBeInTheDocument();
  });
});
