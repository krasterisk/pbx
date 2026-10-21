import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Textarea, Select, Checkbox, TagInput, Label, Text, VStack, HStack, Button } from '@/shared/ui';
import type { ICardField } from '@/features/callcenter/model/types/callCard';
import type { BuilderField } from './FieldRow';
import { DirectorySourceEditor } from './DirectorySourceEditor';

const AUTO_POPULATE_OPTIONS = [
  { value: '', labelKey: 'none' },
  { value: 'caller_id', labelKey: 'callerId' },
  { value: 'queue', labelKey: 'queue' },
  { value: 'phonebook.name', labelKey: 'phonebookName' },
] as const;

export interface FieldConfigProps {
  field: BuilderField;
  allFields: BuilderField[];
  onChange: (patch: Partial<ICardField>) => void;
}

export const FieldConfig = memo(({ field, allFields, onChange }: FieldConfigProps) => {
  const { t } = useTranslation();
  const [advanced, setAdvanced] = useState(false);

  const otherFields = allFields.filter((f) => f.id !== field.id && f.field_type !== 'divider' && f.field_type !== 'heading');
  const showOptions = field.field_type === 'select' || field.field_type === 'multi_select';

  const handleKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ field_key: e.target.value });
  }, [onChange]);

  return (
    <VStack gap="12">
      <Text>{t('callcenter.cards.builder.fieldConfigTitle')}: {field.label || field.field_key}</Text>

      <VStack gap="4">
        <Label>{t('callcenter.cards.builder.fieldLabel')}</Label>
        <Input aria-label={t('callcenter.cards.builder.fieldLabel')} value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
      </VStack>

      {field.field_type !== 'divider' && field.field_type !== 'heading' ? (
        <>
          <VStack gap="4">
            <Label>{t('callcenter.cards.builder.placeholder')}</Label>
            <Input
              aria-label={t('callcenter.cards.builder.placeholder')} value={field.placeholder ?? ''}
              onChange={(e) => onChange({ placeholder: e.target.value })}
            />
          </VStack>

          <HStack gap="8" align="center">
            <Checkbox
              aria-label={t('callcenter.cards.builder.required')} checked={Boolean(field.is_required)}
              onChange={(e) => onChange({ is_required: e.target.checked })}
            />
            <Label>{t('callcenter.cards.builder.required')}</Label>
          </HStack>

          {showOptions ? <DirectorySourceEditor value={field.options} onChange={(options) => onChange({ options })} /> : null}

          <Button type="button" variant="ghost" size="sm" onClick={() => setAdvanced((open) => !open)}>
            {t('callcenter.cards.builder.advancedField')}
          </Button>
          {advanced ? <VStack gap="12"><VStack gap="4">
        <Label>{t('callcenter.cards.builder.fieldKey')}</Label>
        <Input aria-label={t('callcenter.cards.builder.fieldKey')} value={field.field_key} onChange={handleKeyChange} />
      </VStack>

          <VStack gap="4">
            <Label>{t('callcenter.cards.builder.dependsOn')}</Label>
            <Select
              aria-label={t('callcenter.cards.builder.dependsOn')} value={field.depends_on ?? ''}
              onChange={(e) => onChange({ depends_on: e.target.value || null })}
            >
              <option value="">{t('callcenter.cards.builder.noDependency')}</option>
              {otherFields.map((f) => (
                <option key={f.id} value={f.field_key}>{f.label || f.field_key}</option>
              ))}
            </Select>
          </VStack>

          {field.depends_on ? (
            <VStack gap="4">
              <Label>{t('callcenter.cards.builder.dependsValues')}</Label>
              <TagInput
                aria-label={t('callcenter.cards.builder.dependsValues')} value={field.depends_values ?? []}
                onChange={(vals) => onChange({ depends_values: vals })}
                placeholder={t('callcenter.cards.builder.dependsValuesPlaceholder')}
              />
            </VStack>
          ) : null}

          <VStack gap="4">
            <Label>{t('callcenter.cards.builder.autoPopulate')}</Label>
            <Select
              aria-label={t('callcenter.cards.builder.autoPopulate')} value={field.auto_populate ?? ''}
              onChange={(e) => onChange({ auto_populate: e.target.value || null })}
            >
              {AUTO_POPULATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(`callcenter.cards.builder.autoPopulateOptions.${opt.labelKey}`)}
                </option>
              ))}
            </Select>
          </VStack></VStack> : null}
        </>
      ) : (
        <VStack gap="4">
          <Label>{t('callcenter.cards.builder.sectionTitle')}</Label>
          <Textarea
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </VStack>
      )}
    </VStack>
  );
});

FieldConfig.displayName = 'FieldConfig';
