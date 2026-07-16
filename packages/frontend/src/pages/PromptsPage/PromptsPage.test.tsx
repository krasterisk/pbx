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

vi.mock('@/features/prompts/model/slice/promptsSlice', () => ({
  promptsActions: {
    openUploadModal: () => ({ type: 'prompts/openUploadModal' }),
    openRecordModal: () => ({ type: 'prompts/openRecordModal' }),
    openSynthesizeModal: () => ({ type: 'prompts/openSynthesizeModal' }),
  },
}));

vi.mock('@/features/prompts/ui/PromptsTable/PromptsTable', () => ({
  PromptsTable: () => <div data-testid="prompts-table-stub">prompts</div>,
}));

import { PromptsPage } from './PromptsPage';

describe('PromptsPage hybrid overflow (D-29 / D-27 wave C)', () => {
  it('exposes hybrid-table overflow marker at page level', () => {
    render(<PromptsPage />);
    expect(screen.getByTestId('prompts-page-responsive')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(hybrid.className).toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('prompts-table-stub')).toBeInTheDocument();
  });
});
