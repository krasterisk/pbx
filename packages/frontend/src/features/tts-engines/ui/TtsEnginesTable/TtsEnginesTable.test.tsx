import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { TtsEnginesTable } from './TtsEnginesTable';
import { ttsEnginesReducer } from '../../model/slice/ttsEnginesSlice';
import * as apiHooks from '@/shared/api/endpoints/ttsEnginesApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback || key,
  }),
}));

vi.mock('@/shared/api/endpoints/ttsEnginesApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useGetTtsEnginesQuery: vi.fn(),
    useDeleteTtsEngineMutation: vi.fn(),
    useBulkDeleteTtsEnginesMutation: vi.fn(),
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
      ttsEngines: ttsEnginesReducer,
    },
  });
  return render(<Provider store={store}>{ui}</Provider>);
};

describe('TtsEnginesTable UI integration', () => {
  const mockEngines = [
    { uid: 1, name: 'AWS Polly', type: 'amazon' },
    { uid: 2, name: 'Yandex Alena', type: 'yandex' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (apiHooks.useGetTtsEnginesQuery as any).mockReturnValue({ data: mockEngines, isLoading: false });
    (apiHooks.useDeleteTtsEngineMutation as any).mockReturnValue([vi.fn()]);
    (apiHooks.useBulkDeleteTtsEnginesMutation as any).mockReturnValue([vi.fn(), { isLoading: false }]);
  });

  it('renders table rows', () => {
    renderWithStore(<TtsEnginesTable />);
    expect(screen.getByText('AWS Polly')).toBeInTheDocument();
    expect(screen.getByText('Yandex Alena')).toBeInTheDocument();
  });

  it('dispatches openCreateModal on add button click', () => {
    renderWithStore(<TtsEnginesTable />);
    const addBtn = screen.getByText('Добавить движок');
    fireEvent.click(addBtn);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ttsEngines/openCreateModal' })
    );
  });

  it('dispatches openEditModal on edit button click', () => {
    renderWithStore(<TtsEnginesTable />);
    const editBtns = screen.getAllByTitle('Редактировать');
    fireEvent.click(editBtns[0]);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ttsEngines/openEditModal', payload: mockEngines[0] })
    );
  });
});
