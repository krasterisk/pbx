import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileDown, Upload } from 'lucide-react';
import {
  DIRECTORY_CSV_IGNORED_COLUMNS,
  DIRECTORY_CSV_RESERVED_COLUMNS,
  type DirectoryFieldType,
  type IDirectoryCsvError,
} from '@krasterisk/shared';
import { Button, FileImportButton, InfoTooltip, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { buildCsv, downloadBlob, downloadCsv, parseCsv, readFileAsText } from '@/shared/lib/csv';
import {
  useImportDirectoryCsvMutation,
  useLazyExportDirectoryCsvQuery,
} from '@/shared/api/endpoints/directoryApi';
import type { IDirectoryFieldDraft } from '../DirectorySchemaEditor/DirectorySchemaEditor';
import cls from './DirectoryCsvPanel.module.scss';

export interface DirectoryCsvPanelProps {
  /** Undefined until the directory has been saved at least once. */
  directoryUid?: number;
  directoryName: string;
  fields: IDirectoryFieldDraft[];
  recordCount: number;
  /** Blocks import so an unsaved schema cannot be validated against stale server fields. */
  isDirty: boolean;
  onImported: () => void;
}

interface CsvPreview {
  fileName: string;
  delimiter: string;
  rowCount: number;
  mapped: string[];
  unknown: string[];
  missing: string[];
  csv: string;
}

const SAMPLE_BY_TYPE: Record<DirectoryFieldType, string> = {
  string: 'text',
  phone: '+79001234567',
  number: '0',
  boolean: 'true',
};

function fileSlug(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || 'directory';
}

function toCsvErrors(error: unknown): IDirectoryCsvError[] {
  const data = (error as { data?: { errors?: unknown; message?: unknown } })?.data;
  if (Array.isArray(data?.errors)) return data.errors as IDirectoryCsvError[];
  const message = typeof data?.message === 'string' ? data.message : null;
  return message ? [{ row: 0, code: 'empty_file', message }] : [];
}

export const DirectoryCsvPanel = memo(({
  directoryUid,
  directoryName,
  fields,
  recordCount,
  isDirty,
  onImported,
}: DirectoryCsvPanelProps) => {
  const { t } = useTranslation();
  const [importCsv, { isLoading: isImporting }] = useImportDirectoryCsvMutation();
  const [exportCsv, { isFetching: isExporting }] = useLazyExportDirectoryCsvQuery();

  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [errors, setErrors] = useState<IDirectoryCsvError[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const columns = useMemo(
    () => [...fields.map((field) => field.key), ...DIRECTORY_CSV_RESERVED_COLUMNS],
    [fields],
  );

  const blockedReason = !directoryUid
    ? t('directories.csv.needsSave', 'Save the directory first, then import records.')
    : isDirty
      ? t('directories.csv.needsClean', 'Save the form changes before importing.')
      : null;

  const handleTemplate = useCallback(() => {
    const sample = [
      ...fields.map((field) => SAMPLE_BY_TYPE[field.type] ?? ''),
      '',
    ];
    downloadCsv(buildCsv([columns, sample]), `${fileSlug(directoryName)}-template.csv`);
  }, [columns, fields, directoryName]);

  const handleExport = useCallback(async () => {
    if (!directoryUid) return;
    setErrors([]);
    setNotice(null);
    try {
      const blob = await exportCsv(directoryUid).unwrap();
      downloadBlob(blob, `${fileSlug(directoryName)}.csv`);
    } catch {
      setNotice(t('directories.csv.exportError', 'Could not export CSV.'));
    }
  }, [directoryUid, directoryName, exportCsv, t]);

  const handleFileSelect = useCallback(async (file: File) => {
    setErrors([]);
    setNotice(null);
    setPreview(null);
    let text: string;
    try {
      text = await readFileAsText(file);
    } catch {
      setNotice(t('directories.csv.readError', 'Could not read the file.'));
      return;
    }

    const parsed = parseCsv(text);
    if (!parsed.rows.length) {
      setNotice(t('directories.csv.emptyFile', 'The file has no data rows.'));
      return;
    }

    const allowed = new Set<string>([...columns, ...DIRECTORY_CSV_IGNORED_COLUMNS]);
    const present = new Set(parsed.header.filter(Boolean));
    const required = [
      ...DIRECTORY_CSV_RESERVED_COLUMNS.filter((column) => column !== 'comment'),
      ...fields.filter((field) => field.required).map((field) => field.key),
    ];

    setPreview({
      fileName: file.name,
      delimiter: parsed.delimiter,
      rowCount: parsed.rows.length,
      mapped: parsed.header.filter((column) => columns.includes(column)),
      unknown: parsed.header.filter((column) => Boolean(column) && !allowed.has(column)),
      missing: [...new Set(required)].filter((column) => !present.has(column)),
      csv: text,
    });
  }, [columns, fields, t]);

  const handleConfirm = useCallback(async () => {
    if (!directoryUid || !preview) return;
    setErrors([]);
    try {
      const result = await importCsv({ uid: directoryUid, csv: preview.csv }).unwrap();
      setPreview(null);
      setNotice(`${t('directories.csv.imported', 'Imported records')}: ${result.imported}`);
      onImported();
    } catch (error) {
      setErrors(toCsvErrors(error));
    }
  }, [directoryUid, preview, importCsv, onImported, t]);

  const handleCancel = useCallback(() => {
    setPreview(null);
    setErrors([]);
  }, []);

  const renderColumns = (values: string[]): string => (
    values.length ? values.join(', ') : t('directories.csv.none', 'none')
  );

  return (
    <VStack gap="8" max className={cls.panel} data-testid="directory-csv-panel">
      <HStack gap="4" align="center">
        <Text variant="h4">{t('directories.csv.title', 'CSV')}</Text>
        <InfoTooltip text={t('directories.csv.hint', 'Download the template: it already has this directory\'s columns and a sample row. Extra column: comment. A lookup value that starts with _ is a pattern such as _7900123XXXX. The more specific matching pattern wins. The same number or pattern cannot appear twice.')} />
      </HStack>
      <Text variant="muted" data-testid="directory-csv-help">
        {t('directories.csv.help', 'Each file row is one record.')}
      </Text>

      <HStack gap="8" className={cls.actions} data-testid="directory-csv-actions" data-viewport="360">
        <FileImportButton
          variant="outline"
          size="sm"
          accept=".csv,text/csv"
          disabled={Boolean(blockedReason) || isImporting}
          onFileSelect={(file) => void handleFileSelect(file)}
          data-testid="directory-csv-import"
          inputTestId="directory-csv-input"
        >
          <Upload className={cls.icon} />
          {t('directories.csv.import', 'Import CSV')}
        </FileImportButton>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!directoryUid || isExporting}
          onClick={() => void handleExport()}
          data-testid="directory-csv-export"
        >
          <Download className={cls.icon} />
          {t('directories.csv.export', 'Export')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!fields.length}
          onClick={handleTemplate}
          data-testid="directory-csv-template"
        >
          <FileDown className={cls.icon} />
          {t('directories.csv.template', 'Download template')}
        </Button>
      </HStack>

      {blockedReason && (
        <Text variant="muted" data-testid="directory-csv-blocked">{blockedReason}</Text>
      )}

      {notice && (
        <Text variant="small" data-testid="directory-csv-notice">{notice}</Text>
      )}

      {preview && (
        <VStack gap="8" max className={cls.preview} data-testid="directory-csv-preview">
          <Text variant="h4">{t('directories.csv.previewTitle', 'Review the file before replacing')}</Text>
          <VStack gap="4" max className={cls.summary}>
            <Text variant="small">
              {`${t('directories.csv.file', 'File')}: ${preview.fileName}`}
            </Text>
            <Text variant="small">
              {`${t('directories.csv.delimiter', 'Delimiter')}: ${preview.delimiter}`}
            </Text>
            <Text variant="small" data-testid="directory-csv-rows">
              {`${t('directories.csv.rows', 'Data rows')}: ${preview.rowCount}`}
            </Text>
            <Text variant="small" data-testid="directory-csv-current">
              {`${t('directories.csv.currentRecords', 'Current records')}: ${recordCount}`}
            </Text>
            <Text variant="small" data-testid="directory-csv-mapped">
              {`${t('directories.csv.mappedColumns', 'Mapped columns')}: ${renderColumns(preview.mapped)}`}
            </Text>
            <Text variant="small" data-testid="directory-csv-unknown">
              {`${t('directories.csv.unknownColumns', 'Unknown columns')}: ${renderColumns(preview.unknown)}`}
            </Text>
            {preview.missing.length > 0 && (
              <Text variant="error" data-testid="directory-csv-missing">
                {`${t('directories.csv.missingColumns', 'Missing columns')}: ${preview.missing.join(', ')}`}
              </Text>
            )}
          </VStack>

          <Text variant="error" data-testid="directory-csv-warning">
            {t('directories.csv.replaceWarning', 'Importing replaces every current record of this directory.')}
          </Text>

          <HStack gap="8" className={cls.actions}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isImporting}
              data-testid="directory-csv-cancel"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleConfirm()}
              disabled={isImporting || preview.missing.length > 0}
              data-testid="directory-csv-confirm"
            >
              {t('directories.csv.confirmReplace', 'Replace records')}
            </Button>
          </HStack>
        </VStack>
      )}

      {errors.length > 0 && (
        <VStack gap="4" max className={cls.errors} data-testid="directory-csv-errors">
          <Text variant="error">{t('directories.csv.errorsTitle', 'File rejected')}</Text>
          {errors.map((error, index) => (
            <Text key={`${error.code}-${error.row}-${index}`} variant="small">
              {error.row > 0
                ? `${t('directories.csv.errorRow', 'Row')} ${error.row}: ${error.message}`
                : error.message}
            </Text>
          ))}
        </VStack>
      )}
    </VStack>
  );
});

DirectoryCsvPanel.displayName = 'DirectoryCsvPanel';
