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

vi.mock('@/features/provisionTemplates', () => ({
  ProvisionTemplatesTable: () => (
    <div data-testid="provision-templates-table-stub">templates</div>
  ),
  ProvisionTemplateFormModal: () => null,
  provisionTemplatesActions: {
    openCreateModal: () => ({ type: 'provisionTemplates/openCreateModal' }),
  },
}));

import { ProvisionTemplatesPage } from './ProvisionTemplatesPage';

describe('ProvisionTemplatesPage hybrid overflow (D-29 / D-27 wave B)', () => {
  it('exposes hybrid-table overflow marker at page level', () => {
    render(<ProvisionTemplatesPage />);
    expect(screen.getByTestId('provision-templates-page-responsive')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(hybrid.className).toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('provision-templates-table-stub')).toBeInTheDocument();
  });
});
