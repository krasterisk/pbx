import { useTranslation } from 'react-i18next';
import type { DirectoryLookupOutput } from '@krasterisk/shared';
import { Button, Input, Label, Select, Text, InfoTooltip } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { Plus, Trash2 } from 'lucide-react';
import { useGetDirectoryQuery } from '@/shared/api/endpoints/directoryApi';
import { validateDirectoryOutputTarget } from '../../model/schemas/directoryLookup';
import styles from './DirectoryLookupOutputsField.module.scss';

export interface DirectoryLookupOutputsFieldProps {
  directoryUid: number;
  value: DirectoryLookupOutput[];
  onChange: (next: DirectoryLookupOutput[]) => void;
  readOnly?: boolean;
}

export function DirectoryLookupOutputsField({
  directoryUid,
  value,
  onChange,
  readOnly,
}: DirectoryLookupOutputsFieldProps) {
  const { t } = useTranslation();
  const query = useGetDirectoryQuery(directoryUid, { skip: directoryUid <= 0 });
  const fields = query.data?.fields ?? [];
  const rows = value ?? [];
  const names = rows.map((row) => row.targetVariable.trim());

  const updateRow = (index: number, patch: Partial<DirectoryLookupOutput>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const fieldLabel = t('routes.chain.directoryLookup.selectField', 'Поле записи');
  const targetLabel = t('routes.chain.directoryLookup.targetVariable', 'Имя переменной');
  const targetHint = t(
    'routes.chain.directoryLookup.outputsHint',
    'Имя переменной канала **заглавными буквами**\nНельзя: CALLERID, KRSK_*, знаки препинания, повторы',
  );

  return (
    <VStack gap="12" max className={styles.container}>
      {rows.map((row, index) => {
        const error = validateDirectoryOutputTarget(
          row.targetVariable.trim(),
          names.filter((_, i) => i !== index),
        );
        return (
          <VStack key={`output-${index}`} gap="8" max className={styles.rowCard}>
            <HStack gap="8" align="end" max className={styles.outputRow}>
              <VStack gap="4" className={styles.fieldCol}>
                <Label>{fieldLabel}</Label>
                <Select
                  disabled={readOnly || query.isLoading}
                  value={row.fieldUid ? String(row.fieldUid) : ''}
                  aria-label={fieldLabel}
                  onChange={(e) => updateRow(index, { fieldUid: Number(e.target.value) || 0 })}
                >
                  <option value="">{t('routes.chain.source.selectVarKeyPlaceholder', 'Выберите поле')}</option>
                  {fields.map((field) => (
                    <option key={field.uid} value={String(field.uid)}>
                      {field.label}
                    </option>
                  ))}
                </Select>
              </VStack>
              <VStack gap="4" className={styles.varCol}>
                <HStack gap="4" align="center">
                  <Label>{targetLabel}</Label>
                  <InfoTooltip text={targetHint} />
                </HStack>
                <Input
                  value={row.targetVariable}
                  disabled={readOnly}
                  aria-invalid={Boolean(error) || undefined}
                  aria-label={targetLabel}
                  onChange={(e) => updateRow(index, { targetVariable: e.target.value })}
                />
              </VStack>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={readOnly}
                className={styles.removeCol}
                aria-label={t('routes.chain.directoryLookup.removeOutput', 'Удалить поле')}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
              >
                <Trash2 size={16} />
              </Button>
            </HStack>
            {error ? (
              <Text variant="muted" className={styles.error}>
                {t('routes.chain.directoryLookup.outputInvalid', 'Недопустимое имя переменной')}
              </Text>
            ) : null}
          </VStack>
        );
      })}
      <Button
        type="button"
        variant="outline"
        disabled={readOnly}
        onClick={() => onChange([...rows, { fieldUid: 0, targetVariable: '' }])}
      >
        <Plus size={16} />
        {t('routes.chain.directoryLookup.addOutput', 'Добавить поле')}
      </Button>
    </VStack>
  );
}
