import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/features/ivrs', () => ({
  IvrsTable: () => <div data-testid="ivrs-table-stub">ivrs</div>,
  ivrsActions: { openCreateModal: () => ({ type: 'ivrs/openCreateModal' }) },
}));

import { IvrsPage } from './IvrsPage';

describe('IvrsPage hybrid overflow (D-29 / D-27 wave A)', () => {
  it('exposes hybrid-table overflow marker at page level', () => {
    render(<IvrsPage />);
    expect(screen.getByTestId('ivrs-page-responsive')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(hybrid.className).toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('ivrs-table-stub')).toBeInTheDocument();
  });
});
