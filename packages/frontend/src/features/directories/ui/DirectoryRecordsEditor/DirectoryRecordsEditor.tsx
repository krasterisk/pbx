import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import type { DirectoryFieldType, DirectoryMatchKind } from '@krasterisk/shared';
import {
  Button,
  Input,
  Label,
  Select,
  Checkbox,
  Text,
  InfoTooltip,
  TableRowActions,
  TableRowAction,
} from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
import type { IDirectoryFieldDraft } from '../DirectorySchemaEditor/DirectorySchemaEditor';
import cls from './DirectoryRecordsEditor.module.scss';

export interface IDirectoryRecordDraft {
  match_kind: DirectoryMatchKind;
  priority: number;
  values: Record<string, string | number | boolean>;
  comment?: string;
}

export interface DirectoryRecordsEditorProps {
  fields: IDirectoryFieldDraft[];
  lookupFieldKey: string;
  records: IDirectoryRecordDraft[];
  onRecordsChange: (records: IDirectoryRecordDraft[]) => void;
}

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
  records,
  onRecordsChange,
}: DirectoryRecordsEditorProps) => {
  const { t } = useTranslation();
  const lookupField = fields.find((field) => field.key === lookupFieldKey);
  const patternAllowed = lookupField?.type === 'phone';

  const addRecord = useCallback(() => {
    onRecordsChange([
      ...records,
      { match_kind: 'exact', priority: 1, values: {} },
    ]);
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
      <HStack justify="between" align="center" max>
        <HStack gap="4" align="center">
          <Text variant="h4">{t('directories.recordsTitle', 'Records')}</Text>
          <InfoTooltip text={t('directories.recordsHint', 'Columns follow the schema keys. CSV headers use the same keys plus comment, match_kind, and priority.')} />
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
        data-viewport="360"
      >
        <VStack gap="8" max className={cls.recordsInner}>
          {records.length === 0 ? (
            <Text variant="muted">{t('directories.noRecords', 'No records yet. Add a row or import CSV after saving.')}</Text>
          ) : (
            records.map((record, index) => (
              <Flex key={`record-${index}`} align="start" className={cls.recordRow}>
                <VStack gap="4" className={cls.matchCell}>
                  <HStack gap="4" align="center">
                    <Label htmlFor={`record-match-${index}`}>{t('directories.matchKind', 'Match')}</Label>
                    <InfoTooltip text={t('directories.matchKindHint', 'Pattern match is available only when the lookup field type is phone.')} />
                  </HStack>
                  <Select
                    id={`record-match-${index}`}
                    data-testid={`record-match-${index}`}
                    value={record.match_kind}
                    onChange={(e) => updateRecord(index, { match_kind: e.target.value as DirectoryMatchKind })}
                  >
                    <option value="exact">{t('directories.matchExact', 'Exact')}</option>
                    <option
                      value="asterisk_pattern"
                      data-testid={`record-pattern-${index}`}
                      disabled={!patternAllowed}
                    >
                      {t('directories.matchPattern', 'Pattern')}
                    </option>
                  </Select>
                </VStack>
                <VStack gap="4" className={cls.priorityCell}>
                  <Label htmlFor={`record-priority-${index}`}>{t('directories.priority', 'Priority')}</Label>
                  <Input
                    id={`record-priority-${index}`}
                    data-testid={`record-priority-${index}`}
                    type="number"
                    min={1}
                    value={String(record.priority)}
                    onChange={(e) => updateRecord(index, { priority: Number(e.target.value) || 1 })}
                  />
                </VStack>
                {fields.map((field) => (
                  <VStack key={field.key} gap="4" className={cls.valueCell}>
                    <Label htmlFor={`record-value-${index}-${field.key}`}>
                      {field.label || field.key}
                    </Label>
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
                      />
                    )}
                  </VStack>
                ))}
                <VStack gap="4" className={cls.commentCell}>
                  <Label htmlFor={`record-comment-${index}`}>{t('directories.comment', 'Comment')}</Label>
                  <Input
                    id={`record-comment-${index}`}
                    value={record.comment ?? ''}
                    onChange={(e) => updateRecord(index, { comment: e.target.value })}
                  />
                </VStack>
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
              </Flex>
            ))
          )}
        </VStack>
      </Flex>
    </VStack>
  );
});

DirectoryRecordsEditor.displayName = 'DirectoryRecordsEditor';
