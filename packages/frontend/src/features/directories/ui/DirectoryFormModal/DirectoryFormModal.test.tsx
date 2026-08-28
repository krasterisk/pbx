import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { IDirectory } from '@krasterisk/shared';
import type { RootState } from '@/app/store/store';
import { DirectoryFormModal } from './DirectoryFormModal';
import * as directoryApi from '@/shared/api/endpoints/directoryApi';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const mockDispatch = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

const existingDirectory: IDirectory = {
  uid: 7,
  user_uid: 100,
  name: 'VIP clients',
  description: 'Priority',
  lookup_field_uid: 17,
  key_normalization: 'digits',
  revision: 1,
  fields: [
    { uid: 17, directory_uid: 7, key: 'phone', label: 'Phone', type: 'phone', required: true, position: 0 },
    { uid: 18, directory_uid: 7, key: 'name', label: 'Name', type: 'string', required: false, position: 1 },
  ],
  records: [
    {
      uid: 1,
      directory_uid: 7,
      lookup_value: '100',
      normalized_lookup_value: '100',
      match_kind: 'exact',
      priority: 1,
      values: { phone: '100', name: 'Alice' },
      comment: 'exact row',
    },
    {
      uid: 2,
      directory_uid: 7,
      lookup_value: '_1XX',
      normalized_lookup_value: '_1XX',
      match_kind: 'asterisk_pattern',
      priority: 10,
      values: { phone: '_1XX', name: 'Pattern' },
    },
  ],
};

let mockState: Partial<RootState>;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru' },
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: RootState) => unknown) => selector(mockState as RootState),
}));

vi.mock('@/shared/api/endpoints/directoryApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/endpoints/directoryApi')>();
  return {
    ...actual,
    useGetDirectoryQuery: vi.fn(),
    useCreateDirectoryMutation: vi.fn(),
    useUpdateDirectoryMutation: vi.fn(),
    useLookupTestDirectoryMutation: vi.fn(),
  };
});

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
      (open ? <div data-testid="dialog">{children}</div> : null),
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

function renderModal(overrides: Partial<RootState['directories']> = {}) {
  mockState = {
    directories: {
      modalOpen: true,
      modalMode: 'create',
      editingItem: null,
      selectedIds: [],
      ...overrides,
    },
  } as Partial<RootState>;
  return render(<DirectoryFormModal />);
}

describe('DirectoryFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockReturnValue({ unwrap: () => Promise.resolve({ uid: 1 }) });
    mockUpdate.mockReturnValue({ unwrap: () => Promise.resolve({ uid: 7 }) });
    (directoryApi.useCreateDirectoryMutation as ReturnType<typeof vi.fn>).mockReturnValue([
      mockCreate,
      { isLoading: false },
    ]);
    (directoryApi.useUpdateDirectoryMutation as ReturnType<typeof vi.fn>).mockReturnValue([
      mockUpdate,
      { isLoading: false },
    ]);
    (directoryApi.useGetDirectoryQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isFetching: false,
    });
    (directoryApi.useLookupTestDirectoryMutation as ReturnType<typeof vi.fn>).mockReturnValue([
      vi.fn(),
      { isLoading: false },
    ]);
  });

  it('cannot save a new directory without one lookup field', () => {
    renderModal();

    fireEvent.change(screen.getByTestId('directory-name'), { target: { value: 'VIP' } });
    fireEvent.click(screen.getByTestId('directory-add-field'));

    expect(screen.getByTestId('directory-save')).toBeDisabled();
    fireEvent.click(screen.getByTestId('directory-save'));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('serializes exact and pattern priority fields by field key', async () => {
    renderModal();

    fireEvent.change(screen.getByTestId('directory-name'), { target: { value: 'VIP' } });
    fireEvent.click(screen.getByTestId('directory-add-field'));
    fireEvent.change(screen.getByTestId('field-key-0'), { target: { value: 'phone' } });
    fireEvent.change(screen.getByTestId('field-type-0'), { target: { value: 'phone' } });
    fireEvent.click(screen.getByTestId('field-lookup-phone'));

    fireEvent.click(screen.getByTestId('directory-add-record'));
    fireEvent.change(screen.getByTestId('record-value-0-phone'), { target: { value: '100' } });
    fireEvent.change(screen.getByTestId('record-priority-0'), { target: { value: '1' } });
    fireEvent.change(screen.getByTestId('record-match-0'), { target: { value: 'exact' } });

    fireEvent.click(screen.getByTestId('directory-add-record'));
    fireEvent.change(screen.getByTestId('record-value-1-phone'), { target: { value: '_1XX' } });
    fireEvent.change(screen.getByTestId('record-priority-1'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('record-match-1'), { target: { value: 'asterisk_pattern' } });

    fireEvent.click(screen.getByTestId('directory-save'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });

    const payload = mockCreate.mock.calls[0][0];
    expect(payload.lookupFieldKey).toBe('phone');
    expect(payload.fields[0]).toMatchObject({ key: 'phone', type: 'phone' });
    expect(payload.records).toEqual([
      expect.objectContaining({
        match_kind: 'exact',
        priority: 1,
        values: expect.objectContaining({ phone: '100' }),
      }),
      expect.objectContaining({
        match_kind: 'asterisk_pattern',
        priority: 10,
        values: expect.objectContaining({ phone: '_1XX' }),
      }),
    ]);
    expect(payload.records[0].values).not.toHaveProperty('17');
    expect(payload.records[1].uid).toBeUndefined();
  });

  it('copy clears the directory name but retains schema and records', () => {
    (directoryApi.useGetDirectoryQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: existingDirectory,
      isFetching: false,
    });

    renderModal({
      modalMode: 'copy',
      editingItem: existingDirectory,
    });

    expect(screen.getByTestId('directory-name')).toHaveValue('');
    expect(screen.getByTestId('field-key-0')).toHaveValue('phone');
    expect(screen.getByTestId('field-key-1')).toHaveValue('name');
    expect(screen.getByTestId('record-value-0-phone')).toHaveValue('100');
    expect(screen.getByTestId('record-value-0-name')).toHaveValue('Alice');
    expect(screen.getByTestId('record-match-1')).toHaveValue('asterisk_pattern');
    expect(screen.getByTestId('record-priority-1')).toHaveValue(10);
  });

  it('API reference error prevents field deletion and lists route and action locations', async () => {
    mockUpdate.mockReturnValue({
      unwrap: () => Promise.reject({
        status: 409,
        data: {
          message: 'Field is referenced and cannot be deleted',
          references: [
            { routeUid: 5, actionOrBindingId: '12', location: 'Route 5 binding 12' },
            { routeUid: 5, actionOrBindingId: 'act-9', location: 'Route 5 action act-9' },
          ],
        },
      }),
    });
    (directoryApi.useGetDirectoryQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: existingDirectory,
      isFetching: false,
    });

    renderModal({
      modalMode: 'edit',
      editingItem: existingDirectory,
    });

    fireEvent.click(screen.getByTestId('field-delete-name'));
    expect(screen.queryByTestId('field-key-1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('directory-save'));

    await waitFor(() => {
      expect(screen.getByTestId('directory-reference-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Route 5 binding 12')).toBeInTheDocument();
    expect(screen.getByText('Route 5 action act-9')).toBeInTheDocument();
    expect(screen.getByTestId('field-key-1')).toHaveValue('name');
    expect(mockUpdate).toHaveBeenCalled();
  });
});
