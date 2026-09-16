import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'conferencesPage/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('@/features/conferences/model/slice/conferencesPageSlice', () => ({
  conferencesPageActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

vi.mock('@/features/conferences/ui/ConferencesTable', () => ({
  ConferencesTable: () => <div data-testid="conferences-table-stub">conferences</div>,
}));

vi.mock('@/features/conferences/ui/ConferenceRoomFormModal', () => ({
  ConferenceRoomFormModal: () => null,
}));

import { ConferencesPage } from './ConferencesPage';

describe('ConferencesPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<ConferencesPage />);

    expect(screen.getByTestId('conferences-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Конференции' })).toBeInTheDocument();
    expect(
      screen.getByText('Комнаты телеконференций, роли участников и записи встреч'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Создать комнату/i })).toBeInTheDocument();
    expect(screen.getByTestId('conferences-table-stub')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<ConferencesPage />);

    await user.click(screen.getByRole('button', { name: /Создать комнату/i }));

    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'conferencesPage/openCreateModal' });
  });

  it('keeps the orchestrator at 70 lines or fewer without a page SCSS module', () => {
    const pagePath = resolve(__dirname, './ConferencesPage.tsx');
    const source = readFileSync(pagePath, 'utf8');
    expect(source.split(/\r?\n/).length).toBeLessThanOrEqual(70);
    expect(existsSync(resolve(__dirname, './ConferencesPage.module.scss'))).toBe(false);
  });
});
