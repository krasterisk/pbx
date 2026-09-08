import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
let mockState: Partial<RootState>;

const existingDirectory: IDirectory = {
  uid: 7,
  user_uid: 100,
  name: 'VIP clients',
  description: '',
  lookup_field_uid: 17,
  key_normalization: 'none',
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
    },
  ],
};

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

function scss(relative: string): string {
  return readFileSync(resolve(__dirname, relative), 'utf8');
}

describe('DirectoryFormModal responsive layout', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockState = {
      directories: {
        modalOpen: true,
        modalMode: 'edit',
        editingItem: existingDirectory,
        selectedIds: [],
      },
    } as Partial<RootState>;
    (directoryApi.useCreateDirectoryMutation as ReturnType<typeof vi.fn>).mockReturnValue([
      vi.fn(),
      { isLoading: false },
    ]);
    (directoryApi.useUpdateDirectoryMutation as ReturnType<typeof vi.fn>).mockReturnValue([
      vi.fn(),
      { isLoading: false },
    ]);
    (directoryApi.useGetDirectoryQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: existingDirectory,
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
    render(<DirectoryFormModal />);
    await userEvent.setup().click(screen.getByTestId('directory-tab-records'));
  });

  it('covers 360, 768 and 1440 with a single vertical scroll and a reachable footer', () => {
    const body = screen.getByTestId('directory-form-body');
    expect(body).toHaveAttribute('data-viewport', '360,768,1440');
    expect(body).toHaveAttribute('data-overflow', 'y');
    expect(screen.getByTestId('directory-form-footer')).toBeInTheDocument();
    expect(screen.getByTestId('directory-save')).toBeInTheDocument();

    const modalCss = scss('./DirectoryFormModal.module.scss');
    expect(modalCss).toMatch(/overflow-y:\s*auto/);
    expect(modalCss).not.toMatch(/overflow-x:\s*auto/);
    expect(modalCss).toMatch(/flex-shrink:\s*0/);
  });

  it('uses cards at 360 and a table from 768/1440 without forcing page overflow', () => {
    const region = screen.getByTestId('directory-records-scroll');
    expect(region).toHaveAttribute('data-viewport', '360,768,1440');
    expect(region).toHaveAttribute('data-mobile-layout', 'card');
    expect(region).toHaveAttribute('data-desktop-layout', 'table');
    expect(screen.getByTestId('directory-csv-actions')).toHaveAttribute('data-viewport', '360');

    const recordsCss = scss('../DirectoryRecordsEditor/DirectoryRecordsEditor.module.scss');
    expect(recordsCss).toMatch(/@media \(max-width:\s*767px\)/);
    expect(recordsCss).toMatch(/flex-direction:\s*column/);
    expect(recordsCss).toMatch(/overflow-x:\s*visible/);

    const csvCss = scss('../DirectoryCsvPanel/DirectoryCsvPanel.module.scss');
    expect(csvCss).toMatch(/flex-wrap:\s*wrap/);
  });
});
