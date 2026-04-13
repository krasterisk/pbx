import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { PromptsTable } from './PromptsTable';
import { promptsReducer } from '../../model/slice/promptsSlice';
import * as apiHooks from '@/shared/api/endpoints/promptsApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback || key,
  }),
}));

vi.mock('@/shared/api/endpoints/promptsApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useGetPromptsQuery: vi.fn(),
    useDeletePromptMutation: vi.fn(),
    useBulkDeletePromptsMutation: vi.fn(),
  };
});

const mockDispatch = vi.fn();
vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: vi.fn(),
}));

const renderWithStore = (ui: React.ReactElement) => {
  const store = configureStore({
    reducer: {
      prompts: promptsReducer,
    },
  });
  return render(<Provider store={store}>{ui}</Provider>);
};

describe('PromptsTable UI integration', () => {
  const mockPrompts = [
    { uid: 1, filename: 'welcome', comment: 'Welcome', format: 'wav' },
    { uid: 2, filename: 'hold', comment: 'Hold MOH', format: 'wav', moh: 'default' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (apiHooks.useGetPromptsQuery as any).mockReturnValue({ data: mockPrompts, isLoading: false });
    (apiHooks.useDeletePromptMutation as any).mockReturnValue([vi.fn()]);
    (apiHooks.useBulkDeletePromptsMutation as any).mockReturnValue([vi.fn(), { isLoading: false }]);
  });

  it('renders table rows', () => {
    renderWithStore(<PromptsTable />);
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Hold MOH')).toBeInTheDocument();
  });

  it('dispatches openUploadModal on upload button click', () => {
    renderWithStore(<PromptsTable />);
    const uploadBtn = screen.getByText('Загрузить файл');
    fireEvent.click(uploadBtn);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'prompts/openUploadModal' })
    );
  });

  it('dispatches openRecordModal on record button click', () => {
    renderWithStore(<PromptsTable />);
    const recordBtn = screen.getByText('Записать по телефону');
    fireEvent.click(recordBtn);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'prompts/openRecordModal' })
    );
  });
});
