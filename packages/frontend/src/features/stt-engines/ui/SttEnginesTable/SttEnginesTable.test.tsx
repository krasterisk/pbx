import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { SttEnginesTable } from './SttEnginesTable';
import { sttEnginesReducer } from '../../model/slice/sttEnginesSlice';
import * as apiHooks from '@/shared/api/endpoints/sttEnginesApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback || key,
  }),
}));

vi.mock('@/shared/api/endpoints/sttEnginesApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useGetSttEnginesQuery: vi.fn(),
    useDeleteSttEngineMutation: vi.fn(),
    useBulkDeleteSttEnginesMutation: vi.fn(),
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
      sttEngines: sttEnginesReducer,
    },
  });
  return render(<Provider store={store}>{ui}</Provider>);
};

describe('SttEnginesTable UI integration', () => {
  const mockEngines = [
    { uid: 1, name: 'Google Rec', type: 'google' },
    { uid: 2, name: 'Yandex Rec', type: 'yandex' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (apiHooks.useGetSttEnginesQuery as any).mockReturnValue({ data: mockEngines, isLoading: false });
    (apiHooks.useDeleteSttEngineMutation as any).mockReturnValue([vi.fn()]);
    (apiHooks.useBulkDeleteSttEnginesMutation as any).mockReturnValue([vi.fn(), { isLoading: false }]);
  });

  it('renders table rows', () => {
    renderWithStore(<SttEnginesTable />);
    expect(screen.getByText('Google Rec')).toBeInTheDocument();
    expect(screen.getByText('Yandex Rec')).toBeInTheDocument();
  });

  it('dispatches openCreateModal on add button click', () => {
    renderWithStore(<SttEnginesTable />);
    const addBtn = screen.getByText('Добавить движок');
    fireEvent.click(addBtn);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sttEngines/openCreateModal' })
    );
  });

  it('dispatches openEditModal on edit button click', () => {
    renderWithStore(<SttEnginesTable />);
    const editBtns = screen.getAllByTitle('common.edit');
    fireEvent.click(editBtns[0]);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sttEngines/openEditModal', payload: mockEngines[0] })
    );
  });
});
