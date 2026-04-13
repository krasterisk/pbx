import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { IvrsTable } from './IvrsTable';
import { ivrsReducer } from '../../model/slice/ivrsSlice';
import * as apiHooks from '@/shared/api/endpoints/ivrsApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/shared/api/endpoints/ivrsApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useGetIvrsQuery: vi.fn(),
    useDeleteIvrMutation: vi.fn(),
    useBulkDeleteIvrsMutation: vi.fn(),
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
      ivrs: ivrsReducer,
    },
  });
  return render(<Provider store={store}>{ui}</Provider>);
};

describe('IvrsTable UI integration', () => {
  const mockIvrs = [
    { uid: 1, name: 'Menu A', exten: '100', timeout: 5, max_count: 2 },
    { uid: 2, name: 'Menu B', exten: '101', timeout: 10, max_count: 3 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (apiHooks.useGetIvrsQuery as any).mockReturnValue({ data: mockIvrs, isLoading: false });
    (apiHooks.useDeleteIvrMutation as any).mockReturnValue([vi.fn()]);
    (apiHooks.useBulkDeleteIvrsMutation as any).mockReturnValue([vi.fn(), { isLoading: false }]);
  });

  it('renders table rows', () => {
    renderWithStore(<IvrsTable />);
    expect(screen.getByText('Menu A')).toBeInTheDocument();
    expect(screen.getByText('Menu B')).toBeInTheDocument();
  });

  it('dispatches openEditModal on edit button click', () => {
    renderWithStore(<IvrsTable />);
    
    // We added title='common.edit' logic in the refactor
    const editBtns = screen.getAllByTitle('common.edit');
    fireEvent.click(editBtns[0]);
    
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ivrs/openEditModal',
        payload: mockIvrs[0],
      })
    );
  });
});
