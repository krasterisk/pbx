import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { SttEnginesTable } from './SttEnginesTable';
import { sttEnginesReducer } from '../../model/slice/sttEnginesSlice';
import * as apiHooks from '@/shared/api/endpoints/sttEnginesApi';

const useIsMobileMock = vi.fn((_bp?: number) => false);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: string | Record<string, unknown>) =>
      typeof opts === 'string' ? opts : (opts?.defaultValue as string) ?? key,
  }),
}));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

vi.mock('@/shared/api/endpoints/sttEnginesApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
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

describe('SttEnginesTable', () => {
  const mockEngines = [
    { uid: 1, name: 'Google Rec', type: 'google' },
    { uid: 2, name: 'Yandex Rec', type: 'yandex' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
    (apiHooks.useGetSttEnginesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockEngines,
      isLoading: false,
    });
    (apiHooks.useDeleteSttEngineMutation as ReturnType<typeof vi.fn>).mockReturnValue([vi.fn()]);
    (apiHooks.useBulkDeleteSttEnginesMutation as ReturnType<typeof vi.fn>).mockReturnValue([
      vi.fn(),
      { isLoading: false },
    ]);
  });

  it('renders table rows', () => {
    renderWithStore(<SttEnginesTable />);
    expect(screen.getByText('Google Rec')).toBeInTheDocument();
    expect(screen.getByText('Yandex Rec')).toBeInTheDocument();
  });

  it('uses TableRowActions with title and aria-label', () => {
    renderWithStore(<SttEnginesTable />);
    const edit = screen.getAllByRole('button', { name: 'common.edit' })[0];
    const del = screen.getAllByRole('button', { name: 'common.delete' })[0];
    expect(edit).toHaveAttribute('title');
    expect(edit).toHaveAttribute('aria-label');
    expect(del).toHaveAttribute('title');
    expect(del).toHaveAttribute('aria-label');
  });

  it('dispatches openEditModal on edit button click', () => {
    renderWithStore(<SttEnginesTable />);
    fireEvent.click(screen.getAllByRole('button', { name: 'common.edit' })[0]);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sttEngines/openEditModal', payload: mockEngines[0] }),
    );
  });

  it('renders overflow-x-auto hybrid marker on desktop', () => {
    renderWithStore(<SttEnginesTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(screen.getByTestId('stt-engines-table-scroll')).toBeInTheDocument();
  });

  it('renders mobile-card hybrid marker when useIsMobile is true', () => {
    useIsMobileMock.mockReturnValue(true);
    renderWithStore(<SttEnginesTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'mobile-card');
    expect(screen.getAllByTestId('stt-engines-mobile-card').length).toBeGreaterThan(0);
    expect(screen.getByText('Google Rec')).toBeInTheDocument();
  });
});
