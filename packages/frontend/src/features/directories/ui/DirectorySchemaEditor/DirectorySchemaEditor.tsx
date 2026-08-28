import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import type { DirectoryFieldType } from '@krasterisk/shared';
import {
  Button,
  Input,
  Label,
  Select,
  Checkbox,
  Switch,
  Text,
  InfoTooltip,
  TableRowActions,
  TableRowAction,
} from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
import cls from './DirectorySchemaEditor.module.scss';

export interface IDirectoryFieldDraft {
  key: string;
  label: string;
  type: DirectoryFieldType;
  required: boolean;
  position: number;
}

const FIELD_TYPES: DirectoryFieldType[] = ['string', 'phone', 'number', 'boolean'];

function nextFieldKey(fields: IDirectoryFieldDraft[]): string {
  let n = fields.length + 1;
  let key = `field_${n}`;
  const used = new Set(fields.map((field) => field.key));
  while (used.has(key)) {
    n += 1;
    key = `field_${n}`;
  }
  return key;
}

export interface DirectorySchemaEditorProps {
  fields: IDirectoryFieldDraft[];
  lookupFieldKey: string;
  onFieldsChange: (fields: IDirectoryFieldDraft[]) => void;
  onLookupFieldKeyChange: (key: string) => void;
  lockedKeys?: ReadonlySet<string>;
}

export const DirectorySchemaEditor = memo(({
  fields,
  lookupFieldKey,
  onFieldsChange,
  onLookupFieldKeyChange,
  lockedKeys,
}: DirectorySchemaEditorProps) => {
  const { t } = useTranslation();

  const emitFields = useCallback((next: IDirectoryFieldDraft[]) => {
    onFieldsChange(next.map((field, index) => ({ ...field, position: index })));
  }, [onFieldsChange]);

  const addField = useCallback(() => {
    const key = nextFieldKey(fields);
    emitFields([
      ...fields,
      { key, label: '', type: 'string', required: false, position: fields.length },
    ]);
  }, [fields, emitFields]);

  const updateField = useCallback((index: number, patch: Partial<IDirectoryFieldDraft>) => {
    const prev = fields[index];
    if (!prev) return;
    if (patch.key !== undefined && lockedKeys?.has(prev.key)) return;
    const next = fields.map((field, i) => (i === index ? { ...field, ...patch } : field));
    emitFields(next);
    if (patch.key !== undefined && prev.key === lookupFieldKey) {
      onLookupFieldKeyChange(patch.key);
    }
  }, [fields, emitFields, lockedKeys, lookupFieldKey, onLookupFieldKeyChange]);

  const removeField = useCallback((index: number) => {
    const removed = fields[index];
    emitFields(fields.filter((_, i) => i !== index));
    if (removed && removed.key === lookupFieldKey) {
      onLookupFieldKeyChange('');
    }
  }, [fields, emitFields, lookupFieldKey, onLookupFieldKeyChange]);

  const setLookup = useCallback((key: string, checked: boolean) => {
    if (checked) {
      onLookupFieldKeyChange(key);
      return;
    }
    if (lookupFieldKey === key) {
      onLookupFieldKeyChange('');
    }
  }, [lookupFieldKey, onLookupFieldKeyChange]);

  return (
    <VStack gap="12" max className={cls.editor}>
      <HStack justify="between" align="center" max>
        <HStack gap="4" align="center">
          <Text variant="h4">{t('directories.schemaTitle', 'Schema')}</Text>
          <InfoTooltip text={t('directories.schemaHint', 'Declare fields first. Records use these keys, not inferred columns.')} />
        </HStack>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addField}
          data-testid="directory-add-field"
        >
          <Plus className={cls.icon} />
          {t('directories.addField', 'Add field')}
        </Button>
      </HStack>

      {fields.length === 0 ? (
        <Text variant="muted">{t('directories.noFields', 'Add at least one field and mark it as the lookup field.')}</Text>
      ) : (
        <VStack gap="8" max>
          {fields.map((field, index) => {
            const keyLocked = Boolean(lockedKeys?.has(field.key));
            return (
              <Flex key={`${field.key}-${index}`} align="start" className={cls.fieldRow}>
                <VStack gap="4" className={cls.fieldCell}>
                  <HStack gap="4" align="center">
                    <Label htmlFor={`field-key-${index}`}>{t('directories.fieldKey', 'Key')}</Label>
                    <InfoTooltip text={t('directories.fieldKeyHint', 'Immutable after save. Used in CSV headers and record values.')} />
                  </HStack>
                  <Input
                    id={`field-key-${index}`}
                    data-testid={`field-key-${index}`}
                    value={field.key}
                    readOnly={keyLocked}
                    onChange={(e) => updateField(index, { key: e.target.value.trim() })}
                  />
                </VStack>
                <VStack gap="4" className={cls.fieldCell}>
                  <Label htmlFor={`field-label-${index}`}>{t('directories.fieldLabel', 'Label')}</Label>
                  <Input
                    id={`field-label-${index}`}
                    data-testid={`field-label-${index}`}
                    value={field.label}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                  />
                </VStack>
                <VStack gap="4" className={cls.fieldCell}>
                  <Label htmlFor={`field-type-${index}`}>{t('directories.fieldType', 'Type')}</Label>
                  <Select
                    id={`field-type-${index}`}
                    data-testid={`field-type-${index}`}
                    value={field.type}
                    onChange={(e) => updateField(index, { type: e.target.value as DirectoryFieldType })}
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t(`directories.fieldTypes.${type}`, type)}
                      </option>
                    ))}
                  </Select>
                </VStack>
                <VStack gap="4" className={cls.flagCell}>
                  <Label htmlFor={`field-required-${index}`}>{t('directories.fieldRequired', 'Required')}</Label>
                  <Checkbox
                    id={`field-required-${index}`}
                    checked={field.required}
                    onChange={(e) => updateField(index, { required: e.target.checked })}
                  />
                </VStack>
                <VStack gap="4" className={cls.flagCell}>
                  <HStack gap="4" align="center">
                    <Label htmlFor={`field-lookup-${field.key}`}>{t('directories.lookupField', 'Lookup')}</Label>
                    <InfoTooltip text={t('directories.lookupFieldHint', 'Exactly one field is used as the lookup key.')} />
                  </HStack>
                  <Switch
                    id={`field-lookup-${field.key}`}
                    data-testid={`field-lookup-${field.key}`}
                    checked={lookupFieldKey === field.key}
                    onCheckedChange={(checked) => setLookup(field.key, checked)}
                    disabled={!field.key}
                    aria-label={t('directories.lookupField', 'Lookup')}
                  />
                </VStack>
                <TableRowActions>
                  <TableRowAction
                    danger
                    title={t('common.delete')}
                    aria-label={t('common.delete')}
                    data-testid={`field-delete-${field.key}`}
                    onClick={() => removeField(index)}
                  >
                    <Trash2 />
                  </TableRowAction>
                </TableRowActions>
              </Flex>
            );
          })}
        </VStack>
      )}
    </VStack>
  );
});

DirectorySchemaEditor.displayName = 'DirectorySchemaEditor';
