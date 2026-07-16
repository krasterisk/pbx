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

vi.mock('@/features/stt-engines/model/slice/sttEnginesSlice', () => ({
  sttEnginesActions: {
    openCreateModal: () => ({ type: 'sttEngines/openCreateModal' }),
  },
}));

vi.mock('@/features/stt-engines/ui/SttEnginesTable/SttEnginesTable', () => ({
  SttEnginesTable: () => <div data-testid="stt-engines-table-stub">stt</div>,
}));

import { SttEnginesPage } from './SttEnginesPage';

describe('SttEnginesPage hybrid overflow (D-29 / D-27 wave D)', () => {
  it('exposes hybrid-table overflow marker at page level', () => {
    render(<SttEnginesPage />);
    expect(screen.getByTestId('stt-engines-page-responsive')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(hybrid.className).toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('stt-engines-table-stub')).toBeInTheDocument();
  });
});
