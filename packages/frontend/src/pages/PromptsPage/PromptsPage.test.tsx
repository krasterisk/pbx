import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openUploadModal = vi.fn(() => ({ type: 'prompts/openUploadModal' }));
const openRecordModal = vi.fn(() => ({ type: 'prompts/openRecordModal' }));
const openSynthesizeModal = vi.fn(() => ({ type: 'prompts/openSynthesizeModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('@/features/prompts/model/slice/promptsSlice', () => ({
  promptsActions: {
    openUploadModal: () => openUploadModal(),
    openRecordModal: () => openRecordModal(),
    openSynthesizeModal: () => openSynthesizeModal(),
  },
}));

vi.mock('@/features/prompts/ui/PromptsTable', () => ({
  PromptsTable: () => <div data-testid="prompts-table-stub">prompts</div>,
}));

import { PromptsPage } from './PromptsPage';

describe('PromptsPage', () => {
  it('renders title, subtitle, CTAs and table', () => {
    render(<PromptsPage />);

    expect(screen.getByTestId('prompts-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'promptsPage.title' })).toBeInTheDocument();
    expect(screen.getByText('promptsPage.subtitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /promptsPage.addBtn/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /promptsPage.recordBtn/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /promptsPage.synthesizeBtn/i })).toBeInTheDocument();
    expect(screen.getByTestId('prompts-table-stub')).toBeInTheDocument();
  });

  it('opens upload, record and synthesize modals from page CTAs', async () => {
    const user = userEvent.setup();
    render(<PromptsPage />);

    await user.click(screen.getByRole('button', { name: /promptsPage.addBtn/i }));
    expect(openUploadModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'prompts/openUploadModal' });

    await user.click(screen.getByRole('button', { name: /promptsPage.recordBtn/i }));
    expect(openRecordModal).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /promptsPage.synthesizeBtn/i }));
    expect(openSynthesizeModal).toHaveBeenCalledTimes(1);
  });
});
