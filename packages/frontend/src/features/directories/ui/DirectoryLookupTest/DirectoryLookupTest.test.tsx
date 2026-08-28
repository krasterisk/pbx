import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DirectoryLookupTest } from './DirectoryLookupTest';
import * as directoryApi from '@/shared/api/endpoints/directoryApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru' },
  }),
}));

const lookupMock = vi.fn();

vi.mock('@/shared/api/endpoints/directoryApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/endpoints/directoryApi')>();
  return {
    ...actual,
    useLookupTestDirectoryMutation: vi.fn(),
  };
});

describe('DirectoryLookupTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (directoryApi.useLookupTestDirectoryMutation as ReturnType<typeof vi.fn>).mockReturnValue([
      lookupMock,
      { isLoading: false },
    ]);
  });

  it('renders FOUND, NOT_FOUND, and ERROR distinctly', async () => {
    lookupMock
      .mockReturnValueOnce({
        unwrap: () => Promise.resolve({ status: 'FOUND', matchKind: 'exact', values: ['Alice'] }),
      })
      .mockReturnValueOnce({
        unwrap: () => Promise.resolve({ status: 'NOT_FOUND', values: [] }),
      })
      .mockReturnValueOnce({
        unwrap: () => Promise.reject(new Error('lookup failed')),
      });

    render(<DirectoryLookupTest directoryUid={7} fieldUids={[17, 18]} />);

    const input = screen.getByTestId('directory-lookup-key');
    const check = screen.getByTestId('directory-lookup-check');

    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.click(check);
    await waitFor(() => {
      expect(screen.getByTestId('directory-lookup-FOUND')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('directory-lookup-NOT_FOUND')).not.toBeInTheDocument();
    expect(screen.queryByTestId('directory-lookup-ERROR')).not.toBeInTheDocument();

    fireEvent.click(check);
    await waitFor(() => {
      expect(screen.getByTestId('directory-lookup-NOT_FOUND')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('directory-lookup-FOUND')).not.toBeInTheDocument();

    fireEvent.click(check);
    await waitFor(() => {
      expect(screen.getByTestId('directory-lookup-ERROR')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('directory-lookup-FOUND')).not.toBeInTheDocument();
    expect(screen.queryByTestId('directory-lookup-NOT_FOUND')).not.toBeInTheDocument();

    expect(lookupMock).toHaveBeenCalledWith({ uid: 7, key: '100', fieldUids: [17, 18] });
  });
});
