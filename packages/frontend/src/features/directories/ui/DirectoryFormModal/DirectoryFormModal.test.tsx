import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import type { IDirectory } from '@krasterisk/shared';
import type { RootState } from '@/app/store/store';
import { DirectoryFormModal } from './DirectoryFormModal';
import { directoriesActions } from '../../model/slice/directoriesSlice';
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
    useImportDirectoryCsvMutation: vi.fn(),
    useLazyExportDirectoryCsvQuery: vi.fn(),
  };
});

vi.mock('@/features/route-references/ui/UsageTab', () => ({
  UsageTab: () => <div data-testid="usage-tab" />,
}));

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
      (open ? <div data-testid="dialog">{children}</div> : null),
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogFooter: ({ children, ...props }: { children: React.ReactNode }) => (
      <div data-testid="directory-form-footer" {...props}>{children}</div>
    ),
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

async function openTab(name: 'general' | 'fields' | 'records' | 'test' | 'usage') {
  const user = userEvent.setup();
  await user.click(screen.getByTestId(`directory-tab-${name}`));
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
    (directoryApi.useImportDirectoryCsvMutation as ReturnType<typeof vi.fn>).mockReturnValue([
      vi.fn(),
      { isLoading: false },
    ]);
    (directoryApi.useLazyExportDirectoryCsvQuery as ReturnType<typeof vi.fn>).mockReturnValue([
      vi.fn(),
      { isFetching: false },
    ]);
  });

  it('hides the lookup test tab until the directory is saved', () => {
    renderModal();
    expect(screen.queryByTestId('directory-tab-test')).not.toBeInTheDocument();
  });

  it('shows the lookup test tab when editing a saved directory', () => {
    (directoryApi.useGetDirectoryQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: existingDirectory,
      isFetching: false,
    });
    renderModal({
      modalMode: 'edit',
      editingItem: existingDirectory,
    });
    expect(screen.getByTestId('directory-tab-test')).toBeEnabled();
  });

  it('appends Usage last in edit mode only', async () => {
    (directoryApi.useGetDirectoryQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: existingDirectory,
      isFetching: false,
    });
    renderModal({
      modalMode: 'edit',
      editingItem: existingDirectory,
    });
    expect(screen.getByTestId('directory-tab-usage')).toHaveTextContent('Где используется');
    await openTab('usage');
    expect(screen.getByTestId('usage-tab')).toBeInTheDocument();
  });

  it('cannot save a new directory without one lookup field and states the reason', async () => {
    renderModal();

    fireEvent.change(screen.getByTestId('directory-name'), { target: { value: 'VIP' } });
    await openTab('fields');
    fireEvent.click(screen.getByTestId('directory-add-field'));

    expect(screen.getByTestId('directory-save')).toBeDisabled();
    expect(screen.getByTestId('directory-save-blocked')).toHaveTextContent('Pick the lookup field.');
    fireEvent.click(screen.getByTestId('directory-save'));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('serializes records by field key and infers a pattern from a leading underscore', async () => {
    renderModal();

    fireEvent.change(screen.getByTestId('directory-name'), { target: { value: 'VIP' } });
    await openTab('fields');
    fireEvent.click(screen.getByTestId('directory-add-field'));
    fireEvent.change(screen.getByTestId('field-key-0'), { target: { value: 'phone' } });
    fireEvent.change(screen.getByTestId('field-type-0'), { target: { value: 'phone' } });
    fireEvent.change(screen.getByTestId('directory-lookup-field'), { target: { value: 'phone' } });

    await openTab('records');
    fireEvent.click(screen.getByTestId('directory-add-record'));
    fireEvent.change(screen.getByTestId('record-value-0-phone'), { target: { value: '100' } });

    fireEvent.click(screen.getByTestId('directory-add-record'));
    fireEvent.change(screen.getByTestId('record-value-1-phone'), { target: { value: '_1XX' } });

    fireEvent.click(screen.getByTestId('directory-save'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });

    const payload = mockCreate.mock.calls[0][0];
    expect(payload.lookupFieldKey).toBe('phone');
    expect(payload.fields[0]).toMatchObject({ key: 'phone', type: 'phone' });
    expect(payload.records).toEqual([
      expect.objectContaining({
        values: expect.objectContaining({ phone: '100' }),
      }),
      expect.objectContaining({
        values: expect.objectContaining({ phone: '_1XX' }),
      }),
    ]);
    expect(payload.records[0]).not.toHaveProperty('match_kind');
    expect(payload.records[0]).not.toHaveProperty('priority');
    expect(payload.records[0].values).not.toHaveProperty('17');
    expect(payload.records[1].uid).toBeUndefined();
    expect(payload.key_normalization).toBe('none');
  });

  it('sends the selected key comparison mode', async () => {
    renderModal();

    fireEvent.change(screen.getByTestId('directory-name'), { target: { value: 'VIP' } });
    expect(screen.getByTestId('directory-normalization')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Digits and 8 to 7/i }));
    await openTab('fields');
    fireEvent.click(screen.getByTestId('directory-add-field'));
    fireEvent.change(screen.getByTestId('field-key-0'), { target: { value: 'phone' } });
    fireEvent.change(screen.getByTestId('directory-lookup-field'), { target: { value: 'phone' } });
    fireEvent.click(screen.getByTestId('directory-save'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });
    expect(mockCreate.mock.calls[0][0].key_normalization).toBe('ru_8_to_7');
  });

  it('blocks save when two records use the same Asterisk pattern', async () => {
    renderModal();

    fireEvent.change(screen.getByTestId('directory-name'), { target: { value: 'VIP' } });
    await openTab('fields');
    fireEvent.click(screen.getByTestId('directory-add-field'));
    fireEvent.change(screen.getByTestId('field-key-0'), { target: { value: 'phone' } });
    fireEvent.change(screen.getByTestId('field-type-0'), { target: { value: 'phone' } });
    fireEvent.change(screen.getByTestId('directory-lookup-field'), { target: { value: 'phone' } });

    await openTab('records');
    fireEvent.click(screen.getByTestId('directory-add-record'));
    fireEvent.change(screen.getByTestId('record-value-0-phone'), { target: { value: '_7900XXXXXXX' } });
    fireEvent.click(screen.getByTestId('directory-add-record'));
    fireEvent.change(screen.getByTestId('record-value-1-phone'), { target: { value: '_7900XXXXXXX' } });

    expect(screen.getByTestId('directory-save')).toBeDisabled();
    expect(screen.getByTestId('directory-save-blocked')).toHaveTextContent(
      'Each number or pattern can appear only once.',
    );
    fireEvent.click(screen.getByTestId('directory-save'));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('stays open on the Records tab after the first save so CSV import is reachable', async () => {
    const created: IDirectory = { ...existingDirectory, uid: 11, name: 'VIP' };
    mockCreate.mockReturnValue({ unwrap: () => Promise.resolve(created) });
    renderModal();

    fireEvent.change(screen.getByTestId('directory-name'), { target: { value: 'VIP' } });
    await openTab('fields');
    fireEvent.click(screen.getByTestId('directory-add-field'));
    fireEvent.change(screen.getByTestId('field-key-0'), { target: { value: 'phone' } });
    fireEvent.change(screen.getByTestId('directory-lookup-field'), { target: { value: 'phone' } });

    fireEvent.click(screen.getByTestId('directory-save'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });
    expect(mockDispatch).toHaveBeenCalledWith(directoriesActions.openEditModal(created));
    expect(screen.getByTestId('directory-tab-records')).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('directory-csv-panel')).toBeInTheDocument();
  });

  it('blocks CSV import while the draft is dirty and while the directory is unsaved', async () => {
    renderModal();
    await openTab('records');

    expect(screen.getByTestId('directory-csv-import')).toBeDisabled();
    expect(screen.getByTestId('directory-csv-blocked')).toHaveTextContent(
      'Save the directory first, then import records.',
    );
  });

  it('blocks CSV import when an existing directory has unsaved form changes', async () => {
    (directoryApi.useGetDirectoryQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: existingDirectory,
      isFetching: false,
    });
    renderModal({
      modalMode: 'edit',
      editingItem: existingDirectory,
    });

    fireEvent.change(screen.getByTestId('directory-name'), { target: { value: 'Renamed VIP' } });
    await openTab('records');

    expect(screen.getByTestId('directory-csv-import')).toBeDisabled();
    expect(screen.getByTestId('directory-csv-blocked')).toHaveTextContent(
      'Save the form changes before importing.',
    );
  });

  it('shows a regular API error instead of swallowing it', async () => {
    mockCreate.mockReturnValue({
      unwrap: () => Promise.reject({
        status: 400,
        data: { message: 'Directory name already exists' },
      }),
    });
    renderModal();

    fireEvent.change(screen.getByTestId('directory-name'), { target: { value: 'VIP' } });
    await openTab('fields');
    fireEvent.click(screen.getByTestId('directory-add-field'));
    fireEvent.change(screen.getByTestId('field-key-0'), { target: { value: 'phone' } });
    fireEvent.change(screen.getByTestId('directory-lookup-field'), { target: { value: 'phone' } });
    fireEvent.click(screen.getByTestId('directory-save'));

    await waitFor(() => {
      expect(screen.getByTestId('directory-save-error')).toHaveTextContent('Directory name already exists');
    });
  });

  it('copy clears the directory name but retains schema and records', async () => {
    (directoryApi.useGetDirectoryQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: existingDirectory,
      isFetching: false,
    });

    renderModal({
      modalMode: 'copy',
      editingItem: existingDirectory,
    });

    expect(screen.getByTestId('directory-name')).toHaveValue('');
    await openTab('fields');
    expect(screen.getByTestId('field-key-0')).toHaveValue('phone');
    expect(screen.getByTestId('field-key-1')).toHaveValue('name');
    await openTab('records');
    expect(screen.getByTestId('record-value-0-phone')).toHaveValue('100');
    expect(screen.getByTestId('record-value-0-name')).toHaveValue('Alice');
    expect(screen.getByTestId('record-value-1-phone')).toHaveValue('_1XX');
    expect(screen.queryByTestId('record-match-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('record-priority-1')).not.toBeInTheDocument();
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

    await openTab('fields');
    fireEvent.click(screen.getByTestId('field-delete-name'));
    expect(screen.queryByTestId('field-key-1')).not.toBeInTheDocument();

    await openTab('records');
    expect(screen.queryByTestId('record-value-0-name')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('directory-save'));

    await waitFor(() => {
      expect(screen.getByTestId('directory-reference-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Route 5 binding 12')).toBeInTheDocument();
    expect(screen.getByText('Route 5 action act-9')).toBeInTheDocument();
    await openTab('fields');
    expect(screen.getByTestId('field-key-1')).toHaveValue('name');
    await openTab('records');
    expect(screen.getByTestId('record-value-0-name')).toHaveValue('Alice');
    expect(screen.getByTestId('record-value-1-name')).toHaveValue('Pattern');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0].data.records[0].values).not.toHaveProperty('name');

    mockUpdate.mockReturnValue({ unwrap: () => Promise.resolve({ uid: 7 }) });
    fireEvent.click(screen.getByTestId('directory-save'));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });
    expect(mockUpdate.mock.calls[1][0].data.records[0].values).toEqual(
      expect.objectContaining({ phone: '100', name: 'Alice' }),
    );
    expect(mockUpdate.mock.calls[1][0].data.records[1].values).toEqual(
      expect.objectContaining({ phone: '_1XX', name: 'Pattern' }),
    );
  });
});
