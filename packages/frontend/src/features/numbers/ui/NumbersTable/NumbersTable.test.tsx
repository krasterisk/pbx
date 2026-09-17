import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { NumbersTable } from './NumbersTable';
import { numbersPageReducer } from '../../model/slice/numbersPageSlice';
import * as apiHooks from '@/shared/api/api';

const useIsMobileMock = vi.fn((_bp?: number) => false);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) =>
      opts?.count != null ? `${key}:${opts.count}` : key,
  }),
}));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

vi.mock('@/shared/api/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useGetNumbersQuery: vi.fn(),
    useDeleteNumberMutation: vi.fn(),
    useBulkDeleteNumbersMutation: vi.fn(),
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
      numbersPage: numbersPageReducer,
    },
  });
  return render(<Provider store={store}>{ui}</Provider>);
};

describe('NumbersTable UI integration', () => {
  const mockNumbers = [
    { id: 1, name: 'List 1', comment: 'General' },
    { id: 2, name: 'List 2', comment: 'Sales' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
    (apiHooks.useGetNumbersQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockNumbers,
      isLoading: false,
    });
    (apiHooks.useDeleteNumberMutation as ReturnType<typeof vi.fn>).mockReturnValue([vi.fn()]);
    (apiHooks.useBulkDeleteNumbersMutation as ReturnType<typeof vi.fn>).mockReturnValue([
      vi.fn(),
      { isLoading: false },
    ]);
  });

  it('renders overflow-x-auto hybrid marker on desktop', () => {
    renderWithStore(<NumbersTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(screen.getByTestId('numbers-table-scroll')).toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('renders table rows', () => {
    renderWithStore(<NumbersTable />);
    expect(screen.getByText('List 1')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('List 2')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
  });

  it('dispatches openEditModal on edit button click', () => {
    renderWithStore(<NumbersTable />);

    const editBtns = screen.getAllByTitle('common.edit');
    fireEvent.click(editBtns[0]);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'numbersPage/openEditModal',
        payload: mockNumbers[0],
      }),
    );
  });

  it('renders mobile-card hybrid marker when useIsMobile is true', () => {
    useIsMobileMock.mockReturnValue(true);
    renderWithStore(<NumbersTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'mobile-card');
    expect(screen.getAllByTestId('numbers-mobile-card')).toHaveLength(2);
    expect(screen.getByText('List 1')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'common.edit' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'common.delete' }).length).toBeGreaterThan(0);
  });
});
