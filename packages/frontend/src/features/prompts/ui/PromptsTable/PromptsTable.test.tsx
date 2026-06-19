import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { PromptsTable } from './PromptsTable';
import { promptsReducer } from '../../model/slice/promptsSlice';
import * as apiHooks from '@/shared/api/endpoints/promptsApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === 'string') return fallback || key;
      if (fallback && typeof fallback === 'object' && fallback.defaultValue) {
        return fallback.defaultValue;
      }
      return key;
    },
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
    {
      uid: 1,
      filename: 'welcome',
      comment: 'Welcome',
      description: '',
      user_uid: 1,
      source_type: 'file' as const,
      tts: null,
    },
    {
      uid: 2,
      filename: 'hold',
      comment: 'Hold music',
      description: 'Очередь ожидания',
      user_uid: 1,
      source_type: 'tts' as const,
      tts: { text: 'Подождите', engine_uid: 1 },
    },
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
    expect(screen.getByText('Hold music')).toBeInTheDocument();
    expect(screen.getByText('Очередь ожидания')).toBeInTheDocument();
  });

  it('shows row numbers starting from 1', () => {
    renderWithStore(<PromptsTable />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
