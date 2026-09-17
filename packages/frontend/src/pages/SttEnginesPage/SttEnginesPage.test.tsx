import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'sttEngines/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('@/features/stt-engines/model/slice/sttEnginesSlice', () => ({
  sttEnginesActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

vi.mock('@/features/stt-engines/ui/SttEnginesTable', () => ({
  SttEnginesTable: () => <div data-testid="stt-engines-table-stub">stt</div>,
}));

import { SttEnginesPage } from './SttEnginesPage';

describe('SttEnginesPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<SttEnginesPage />);

    expect(screen.getByTestId('stt-engines-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'sttEngines.title' })).toBeInTheDocument();
    expect(screen.getByText('sttEngines.subtitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sttEngines.add/i })).toBeInTheDocument();
    expect(screen.getByTestId('stt-engines-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<SttEnginesPage />);

    await user.click(screen.getByRole('button', { name: /sttEngines.add/i }));
    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'sttEngines/openCreateModal' });
  });
});
