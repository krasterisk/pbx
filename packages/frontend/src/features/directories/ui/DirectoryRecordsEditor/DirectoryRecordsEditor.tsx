import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { DirectoryFieldType, DirectoryKeyNormalization } from '@krasterisk/shared';
import {
  Button,
  Input,
  Label,
  Checkbox,
  Text,
  InfoTooltip,
  TableRowActions,
  TableRowAction,
} from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
import type { IDirectoryFieldDraft } from '../DirectorySchemaEditor/DirectorySchemaEditor';
import { findDuplicateRecordIndexes } from '../../model/directoryRecordLookup';
import cls from './DirectoryRecordsEditor.module.scss';

export interface IDirectoryRecordDraft {
  values: Record<string, string | number | boolean>;
  comment?: string;
}

export interface DirectoryRecordsEditorProps {
  fields: IDirectoryFieldDraft[];
  lookupFieldKey: string;
  keyNormalization: DirectoryKeyNormalization;
  records: IDirectoryRecordDraft[];
  onRecordsChange: (records: IDirectoryRecordDraft[]) => void;
}

/** Keeps an imported file of hundreds of rows from mounting thousands of controls. */
const PAGE_SIZE = 25;

function coerceValue(type: DirectoryFieldType, raw: string): string | number | boolean {
  if (type === 'number') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : raw;
  }
  if (type === 'boolean') return raw === 'true';
  return raw;
}

export const DirectoryRecordsEditor = memo(({
  fields,
  lookupFieldKey,
  keyNormalization,
  records,
  onRecordsChange,
}: DirectoryRecordsEditorProps) => {
  const { t } = useTranslation();
  const lookupField = fields.find((field) => field.key === lookupFieldKey);
  const patternAllowed = lookupField?.type === 'phone';
  const duplicateIndexes = useMemo(
    () => findDuplicateRecordIndexes(records, lookupFieldKey, keyNormalization),
    [records, lookupFieldKey, keyNormalization],
  );

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));

  useEffect(() => {
    setPage((prev) => Math.min(Math.max(prev, 1), totalPages));
  }, [totalPages]);

  const pageStart = (Math.min(page, totalPages) - 1) * PAGE_SIZE;
  const visible = useMemo(
    () => records.slice(pageStart, pageStart + PAGE_SIZE),
    [records, pageStart],
  );

  const addRecord = useCallback(() => {
    const next = [...records, { values: {} }];
    onRecordsChange(next);
    setPage(Math.ceil(next.length / PAGE_SIZE));
  }, [records, onRecordsChange]);

  const updateRecord = useCallback((index: number, patch: Partial<IDirectoryRecordDraft>) => {
    onRecordsChange(records.map((record, i) => (i === index ? { ...record, ...patch } : record)));
  }, [records, onRecordsChange]);

  const updateValue = useCallback((index: number, key: string, type: DirectoryFieldType, raw: string | boolean) => {
    const record = records[index];
    if (!record) return;
    const nextValue = typeof raw === 'boolean' ? raw : coerceValue(type, raw);
    updateRecord(index, { values: { ...record.values, [key]: nextValue } });
  }, [records, updateRecord]);

  const removeRecord = useCallback((index: number) => {
    onRecordsChange(records.filter((_, i) => i !== index));
  }, [records, onRecordsChange]);

  return (
    <VStack gap="12" max className={cls.editor}>
      <HStack justify="between" align="center" max className={cls.head}>
        <HStack gap="4" align="center">
          <Text variant="h4">{t('directories.recordsTitle', 'Records')}</Text>
          <InfoTooltip text={t('directories.recordsHint', 'Record columns follow the schema fields.')} />
          <Text variant="muted" data-testid="directory-records-total">
            {`${t('directories.recordsTotal', 'Records total')}: ${records.length}`}
          </Text>
        </HStack>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRecord}
          data-testid="directory-add-record"
        >
          <Plus className={cls.icon} />
          {t('directories.addRecord', 'Add record')}
        </Button>
      </HStack>

      <Flex
        direction="column"
        className={cls.scrollBody}
        data-testid="directory-records-scroll"
        data-hybrid="overflow-x-auto"
        data-viewport="360,768,1440"
        data-mobile-layout="card"
        data-desktop-layout="table"
      >
        <VStack gap="8" max className={cls.recordsInner}>
          {records.length === 0 ? (
            <Text variant="muted">{t('directories.noRecords', 'No records yet. Add a row or import CSV.')}</Text>
          ) : (
            visible.map((record, offset) => {
              const index = pageStart + offset;
              const isDuplicate = duplicateIndexes.has(index);
              return (
              <Flex
                key={`record-${index}`}
                align="start"
                max
                className={cls.recordRow}
                data-testid={`record-row-${index}`}
              >
                {fields.map((field) => {
                  const isLookup = field.key === lookupFieldKey;
                  return (
                    <VStack key={field.key} gap="4" className={cls.valueCell}>
                      <HStack gap="4" align="center">
                        <Label htmlFor={`record-value-${index}-${field.key}`}>
                          {field.label || field.key}
                        </Label>
                        {isLookup && patternAllowed && (
                          <InfoTooltip text={t('directories.lookupPatternHint', 'If the value starts with _, it is a pattern such as _7900123XXXX. The more specific matching pattern wins. The same number or pattern cannot be added twice.')} />
                        )}
                      </HStack>
                      {field.type === 'boolean' ? (
                        <Checkbox
                          id={`record-value-${index}-${field.key}`}
                          data-testid={`record-value-${index}-${field.key}`}
                          checked={Boolean(record.values[field.key])}
                          onChange={(e) => updateValue(index, field.key, field.type, e.target.checked)}
                        />
                      ) : (
                        <Input
                          id={`record-value-${index}-${field.key}`}
                          data-testid={`record-value-${index}-${field.key}`}
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={record.values[field.key] == null ? '' : String(record.values[field.key])}
                          onChange={(e) => updateValue(index, field.key, field.type, e.target.value)}
                          aria-invalid={isLookup && isDuplicate}
                        />
                      )}
                      {isLookup && isDuplicate && (
                        <Text variant="error" data-testid={`record-duplicate-${index}`}>
                          {t('directories.duplicateLookup', 'This number or pattern is already in the directory.')}
                        </Text>
                      )}
                    </VStack>
                  );
                })}
                <VStack gap="4" className={cls.commentCell}>
                  <Label htmlFor={`record-comment-${index}`}>{t('directories.comment', 'Comment')}</Label>
                  <Input
                    id={`record-comment-${index}`}
                    value={record.comment ?? ''}
                    onChange={(e) => updateRecord(index, { comment: e.target.value })}
                  />
                </VStack>
                <div className={cls.rowActions}>
                <TableRowActions>
                  <TableRowAction
                    danger
                    title={t('common.delete')}
                    aria-label={t('common.delete')}
                    onClick={() => removeRecord(index)}
                  >
                    <Trash2 />
                  </TableRowAction>
                </TableRowActions>
                </div>
              </Flex>
              );
            })
          )}
        </VStack>
      </Flex>

      {totalPages > 1 && (
        <HStack gap="8" align="center" justify="center" max className={cls.pager} data-testid="directory-records-pager">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            aria-label={t('directories.prevPage', 'Previous page')}
            data-testid="directory-records-prev"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            <ChevronLeft className={cls.icon} />
          </Button>
          <Text variant="small" data-testid="directory-records-page">
            {`${t('directories.recordsPage', 'Page')} ${Math.min(page, totalPages)} / ${totalPages}`}
          </Text>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            aria-label={t('directories.nextPage', 'Next page')}
            data-testid="directory-records-next"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            <ChevronRight className={cls.icon} />
          </Button>
        </HStack>
      )}
    </VStack>
  );
});

DirectoryRecordsEditor.displayName = 'DirectoryRecordsEditor';
