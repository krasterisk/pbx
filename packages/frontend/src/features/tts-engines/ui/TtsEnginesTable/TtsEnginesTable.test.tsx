import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { TtsEnginesTable } from './TtsEnginesTable';
import { ttsEnginesReducer } from '../../model/slice/ttsEnginesSlice';
import * as apiHooks from '@/shared/api/endpoints/ttsEnginesApi';

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

vi.mock('@/shared/api/endpoints/ttsEnginesApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
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

describe('TtsEnginesTable', () => {
  const mockEngines = [
    { uid: 1, name: 'AWS Polly', type: 'amazon' },
    { uid: 2, name: 'Yandex Alena', type: 'yandex' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
    (apiHooks.useGetTtsEnginesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockEngines,
      isLoading: false,
    });
    (apiHooks.useDeleteTtsEngineMutation as ReturnType<typeof vi.fn>).mockReturnValue([vi.fn()]);
    (apiHooks.useBulkDeleteTtsEnginesMutation as ReturnType<typeof vi.fn>).mockReturnValue([
      vi.fn(),
      { isLoading: false },
    ]);
  });

  it('renders table rows', () => {
    renderWithStore(<TtsEnginesTable />);
    expect(screen.getByText('AWS Polly')).toBeInTheDocument();
    expect(screen.getByText('Yandex Alena')).toBeInTheDocument();
  });

  it('uses TableRowActions with title and aria-label', () => {
    renderWithStore(<TtsEnginesTable />);
    const edit = screen.getAllByRole('button', { name: 'common.edit' })[0];
    const del = screen.getAllByRole('button', { name: 'common.delete' })[0];
    expect(edit).toHaveAttribute('title');
    expect(edit).toHaveAttribute('aria-label');
    expect(del).toHaveAttribute('title');
    expect(del).toHaveAttribute('aria-label');
  });

  it('dispatches openEditModal on edit button click', () => {
    renderWithStore(<TtsEnginesTable />);
    fireEvent.click(screen.getAllByRole('button', { name: 'common.edit' })[0]);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ttsEngines/openEditModal', payload: mockEngines[0] }),
    );
  });

  it('renders overflow-x-auto hybrid marker on desktop', () => {
    renderWithStore(<TtsEnginesTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(screen.getByTestId('tts-engines-table-scroll')).toBeInTheDocument();
  });

  it('renders mobile-card hybrid marker when useIsMobile is true', () => {
    useIsMobileMock.mockReturnValue(true);
    renderWithStore(<TtsEnginesTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'mobile-card');
    expect(screen.getAllByTestId('tts-engines-mobile-card').length).toBeGreaterThan(0);
    expect(screen.getByText('AWS Polly')).toBeInTheDocument();
  });
});
