import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { DirectoryFieldType } from '@krasterisk/shared';
import { DirectoryCsvPanel } from './DirectoryCsvPanel';
import type { IDirectoryFieldDraft } from '../DirectorySchemaEditor/DirectorySchemaEditor';
import * as directoryApi from '@/shared/api/endpoints/directoryApi';

const csvMocks = vi.hoisted(() => ({
  readFileAsText: vi.fn<(file: File) => Promise<string>>(),
  downloadBlob: vi.fn<(blob: Blob, filename: string) => void>(),
  downloadCsv: vi.fn<(csv: string, filename: string) => void>(),
}));

vi.mock('@/shared/lib/csv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/csv')>();
  return { ...actual, ...csvMocks };
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru' },
  }),
}));

vi.mock('@/shared/api/endpoints/directoryApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/endpoints/directoryApi')>();
  return {
    ...actual,
    useImportDirectoryCsvMutation: vi.fn(),
    useLazyExportDirectoryCsvQuery: vi.fn(),
  };
});

const mockImport = vi.fn();
const mockExport = vi.fn();
const onImported = vi.fn();

function field(key: string, type: DirectoryFieldType, required = false): IDirectoryFieldDraft {
  return { key, label: key, type, required, position: 0 };
}

const FIELDS = [field('phone', 'phone', true), field('name', 'string')];

function renderPanel(overrides: Partial<React.ComponentProps<typeof DirectoryCsvPanel>> = {}) {
  return render(
    <DirectoryCsvPanel
      directoryUid={7}
      directoryName="VIP clients"
      fields={FIELDS}
      recordCount={3}
      isDirty={false}
      onImported={onImported}
      {...overrides}
    />,
  );
}

function pickFile(content: string, name = 'rows.csv') {
  const file = new File([content], name, { type: 'text/csv' });
  csvMocks.readFileAsText.mockResolvedValue(content);
  fireEvent.change(screen.getByTestId('directory-csv-input'), { target: { files: [file] } });
  return file;
}

describe('DirectoryCsvPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockImport.mockReturnValue({ unwrap: () => Promise.resolve({ imported: 2, replaced: 3, errors: [] }) });
    mockExport.mockReturnValue({ unwrap: () => Promise.resolve(new Blob(['csv'], { type: 'text/csv' })) });
    (directoryApi.useImportDirectoryCsvMutation as ReturnType<typeof vi.fn>).mockReturnValue([
      mockImport,
      { isLoading: false },
    ]);
    (directoryApi.useLazyExportDirectoryCsvQuery as ReturnType<typeof vi.fn>).mockReturnValue([
      mockExport,
      { isFetching: false },
    ]);
  });

  it('explains the extra columns in plain language', () => {
    renderPanel();

    expect(screen.getByTestId('directory-csv-help')).toHaveTextContent('Each file row is one record.');
    expect(screen.getByTestId('directory-csv-help')).not.toHaveTextContent('_7900123XXXX');
    expect(screen.getByTestId('directory-csv-help')).not.toHaveTextContent('Asterisk');
    expect(screen.getByTestId('directory-csv-panel')).not.toHaveTextContent('match_kind');
    expect(screen.getByTestId('directory-csv-panel')).not.toHaveTextContent('priority');
  });

  it('blocks import until the directory is saved', () => {
    renderPanel({ directoryUid: undefined });

    expect(screen.getByTestId('directory-csv-import')).toBeDisabled();
    expect(screen.getByTestId('directory-csv-export')).toBeDisabled();
    expect(screen.getByTestId('directory-csv-blocked')).toHaveTextContent(
      'Save the directory first, then import records.',
    );
  });

  it('blocks import while the form draft has unsaved changes', () => {
    renderPanel({ isDirty: true });

    expect(screen.getByTestId('directory-csv-import')).toBeDisabled();
    expect(screen.getByTestId('directory-csv-blocked')).toHaveTextContent(
      'Save the form changes before importing.',
    );
  });

  it('previews the file before replacing anything', async () => {
    renderPanel();
    pickFile('phone;name;extra;match_kind;priority\n555;Alice;x;exact;1\n556;Bob;y;exact;1\n');

    await waitFor(() => {
      expect(screen.getByTestId('directory-csv-preview')).toBeInTheDocument();
    });

    expect(screen.getByTestId('directory-csv-rows')).toHaveTextContent('2');
    expect(screen.getByTestId('directory-csv-current')).toHaveTextContent('3');
    expect(screen.getByTestId('directory-csv-mapped')).toHaveTextContent('phone, name');
    expect(screen.getByTestId('directory-csv-mapped')).not.toHaveTextContent('match_kind');
    expect(screen.getByTestId('directory-csv-unknown')).toHaveTextContent('extra');
    expect(screen.getByTestId('directory-csv-unknown')).not.toHaveTextContent('match_kind');
    expect(screen.getByTestId('directory-csv-warning')).toBeInTheDocument();
    expect(mockImport).not.toHaveBeenCalled();
  });

  it('blocks confirmation when a required column is missing', async () => {
    renderPanel();
    pickFile('name;match_kind;priority\nAlice;exact;1\n');

    await waitFor(() => {
      expect(screen.getByTestId('directory-csv-missing')).toHaveTextContent('phone');
    });
    expect(screen.getByTestId('directory-csv-confirm')).toBeDisabled();
  });

  it('cancel leaves the directory untouched', async () => {
    renderPanel();
    pickFile('phone;match_kind;priority\n555;exact;1\n');

    await waitFor(() => expect(screen.getByTestId('directory-csv-preview')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('directory-csv-cancel'));

    expect(screen.queryByTestId('directory-csv-preview')).not.toBeInTheDocument();
    expect(mockImport).not.toHaveBeenCalled();
    expect(onImported).not.toHaveBeenCalled();
  });

  it('confirming replace sends the raw file once and refreshes the records', async () => {
    renderPanel();
    const csv = 'phone;match_kind;priority\n0712345;exact;1\n';
    pickFile(csv);

    await waitFor(() => expect(screen.getByTestId('directory-csv-preview')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('directory-csv-confirm'));

    await waitFor(() => expect(mockImport).toHaveBeenCalledTimes(1));
    expect(mockImport).toHaveBeenCalledWith({ uid: 7, csv });
    expect(onImported).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByTestId('directory-csv-notice')).toHaveTextContent('Imported records: 2');
    });
    expect(screen.queryByTestId('directory-csv-preview')).not.toBeInTheDocument();
  });

  it('renders row-addressed backend errors and keeps the preview data available', async () => {
    mockImport.mockReturnValue({
      unwrap: () => Promise.reject({
        status: 400,
        data: {
          code: 'csv_invalid',
          message: 'Duplicate lookup value "_7900XXXXXXX"',
          errors: [
            { row: 3, column: 'phone', code: 'duplicate_key', message: 'Duplicate lookup value "_7900XXXXXXX"' },
            { row: 4, column: 'phone', code: 'required_empty', message: 'Column "phone" must not be empty' },
          ],
        },
      }),
    });

    renderPanel();
    pickFile('phone;match_kind;priority\n555;exact;1\n');
    await waitFor(() => expect(screen.getByTestId('directory-csv-preview')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('directory-csv-confirm'));

    await waitFor(() => expect(screen.getByTestId('directory-csv-errors')).toBeInTheDocument());
    expect(screen.getByText('Row 3: Duplicate lookup value "_7900XXXXXXX"')).toBeInTheDocument();
    expect(screen.getByText('Row 4: Column "phone" must not be empty')).toBeInTheDocument();
    expect(onImported).not.toHaveBeenCalled();
  });

  it('rejects a file without data rows before any preview', async () => {
    renderPanel();
    pickFile('phone;match_kind;priority\n');

    await waitFor(() => {
      expect(screen.getByTestId('directory-csv-notice')).toHaveTextContent('The file has no data rows.');
    });
    expect(screen.queryByTestId('directory-csv-preview')).not.toBeInTheDocument();
  });

  it('exports through the authenticated query, not an anchor href', async () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('directory-csv-export'));

    await waitFor(() => expect(mockExport).toHaveBeenCalledWith(7));
    expect(csvMocks.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'vip-clients.csv');
  });

  it('builds the template from the declared schema plus the reserved columns', () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('directory-csv-template'));

    expect(csvMocks.downloadCsv).toHaveBeenCalledTimes(1);
    const [csv, filename] = csvMocks.downloadCsv.mock.calls[0];
    expect(filename).toBe('vip-clients-template.csv');
    expect(csv.slice(1).split('\r\n')[0]).toBe('phone;name;comment');
    expect(csv.slice(1).split('\r\n')[1]).toBe('+79001234567;text;');
  });
});
