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

vi.mock('@/features/contexts', () => ({
  ContextsTable: () => <div data-testid="contexts-table-stub">contexts</div>,
  ContextFormModal: () => null,
  contextsActions: { openCreateModal: () => ({ type: 'contexts/openCreateModal' }) },
}));

import { ContextsPage } from './ContextsPage';

describe('ContextsPage hybrid overflow (D-29 / D-27 wave B)', () => {
  it('exposes hybrid-table overflow marker at page level', () => {
    render(<ContextsPage />);
    expect(screen.getByTestId('contexts-page-responsive')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(hybrid.className).toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('contexts-table-stub')).toBeInTheDocument();
  });
});
