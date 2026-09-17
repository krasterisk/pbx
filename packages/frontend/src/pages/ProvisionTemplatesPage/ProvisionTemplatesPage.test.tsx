import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'provisionTemplates/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('@/features/provisionTemplates', () => ({
  ProvisionTemplatesTable: () => (
    <div data-testid="provision-templates-table-stub">templates</div>
  ),
  ProvisionTemplateFormModal: () => null,
  provisionTemplatesActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

import { ProvisionTemplatesPage } from './ProvisionTemplatesPage';

describe('ProvisionTemplatesPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<ProvisionTemplatesPage />);

    expect(screen.getByTestId('provision-templates-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Шаблоны автонастройки' })).toBeInTheDocument();
    expect(
      screen.getByText('XML/CFG шаблоны автонастройки SIP-телефонов'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Добавить шаблон/i })).toBeInTheDocument();
    expect(screen.getByTestId('provision-templates-table-stub')).toBeInTheDocument();
  });

  it('renders the table in a full-width wrap', () => {
    render(<ProvisionTemplatesPage />);
    expect(screen.getByTestId('provision-templates-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<ProvisionTemplatesPage />);

    await user.click(screen.getByRole('button', { name: /Добавить шаблон/i }));

    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'provisionTemplates/openCreateModal' });
  });
});
