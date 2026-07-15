import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Textarea, Select, Checkbox, TagInput, Label, Text, VStack } from '@/shared/ui';
import type { ICardField } from '@/features/callcenter/model/types/callCard';
import type { BuilderField } from './FieldRow';

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

  const otherFields = allFields.filter((f) => f.id !== field.id && f.field_type !== 'divider' && f.field_type !== 'heading');
  const showOptions = field.field_type === 'select' || field.field_type === 'multi_select';

  const handleKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ field_key: e.target.value });
  }, [onChange]);

  return (
    <VStack gap="12" className="p-4 border border-border rounded-lg bg-muted/20">
      <Text className="font-medium">{t('callcenter.cards.builder.fieldConfigTitle')}</Text>

      <VStack gap="4">
        <Label>{t('callcenter.cards.builder.fieldKey')}</Label>
        <Input value={field.field_key} onChange={handleKeyChange} />
      </VStack>

      <VStack gap="4">
        <Label>{t('callcenter.cards.builder.fieldLabel')}</Label>
        <Input value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
      </VStack>

      {field.field_type !== 'divider' && field.field_type !== 'heading' ? (
        <>
          <VStack gap="4">
            <Label>{t('callcenter.cards.builder.placeholder')}</Label>
            <Input
              value={field.placeholder ?? ''}
              onChange={(e) => onChange({ placeholder: e.target.value })}
            />
          </VStack>

          <FlexRow>
            <Checkbox
              checked={Boolean(field.is_required)}
              onChange={(e) => onChange({ is_required: e.target.checked })}
            />
            <Label>{t('callcenter.cards.builder.required')}</Label>
          </FlexRow>

          {showOptions ? (
            <VStack gap="4">
              <Label>{t('callcenter.cards.builder.options')}</Label>
              <TagInput
                value={field.options ?? []}
                onChange={(opts) => onChange({ options: opts })}
                placeholder={t('callcenter.cards.builder.optionsPlaceholder')}
              />
            </VStack>
          ) : null}

          <VStack gap="4">
            <Label>{t('callcenter.cards.builder.dependsOn')}</Label>
            <Select
              value={field.depends_on ?? ''}
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
                value={field.depends_values ?? []}
                onChange={(vals) => onChange({ depends_values: vals })}
                placeholder={t('callcenter.cards.builder.dependsValuesPlaceholder')}
              />
            </VStack>
          ) : null}

          <VStack gap="4">
            <Label>{t('callcenter.cards.builder.autoPopulate')}</Label>
            <Select
              value={field.auto_populate ?? ''}
              onChange={(e) => onChange({ auto_populate: e.target.value || null })}
            >
              {AUTO_POPULATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(`callcenter.cards.builder.autoPopulateOptions.${opt.labelKey}`)}
                </option>
              ))}
            </Select>
          </VStack>
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

function FlexRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}
