import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Input, Textarea, Select, Checkbox, MultiSelect, Text, Label, Separator,
} from '@/shared/ui';
import type { ICardField } from '@/features/callcenter/model/types/callCard';
import styles from './FieldRenderer.module.scss';

export interface FieldRendererProps {
  field: ICardField;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value) return [value];
  return [];
}

export const FieldRenderer = memo(({ field, value, onChange, readOnly }: FieldRendererProps) => {
  const { t } = useTranslation();

  if (field.field_type === 'divider') {
    return <Separator className={styles.divider} />;
  }

  if (field.field_type === 'heading') {
    return (
      <Text className={styles.heading}>
        {field.label}
      </Text>
    );
  }

  const disabled = readOnly || field.field_type === 'readonly';
  const strValue = toStringValue(value ?? field.default_value ?? '');

  const labelEl = field.field_type !== 'checkbox' ? (
    <Label className={styles.label}>
      {field.label}
      {field.is_required ? <span className={styles.required}>*</span> : null}
    </Label>
  ) : null;

  switch (field.field_type) {
    case 'textarea':
      return (
        <div className={styles.field}>
          {labelEl}
          <Textarea
            value={strValue}
            placeholder={field.placeholder}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case 'select':
      return (
        <div className={styles.field}>
          {labelEl}
          <Select
            value={strValue}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{field.placeholder || t('callcenter.cards.builder.selectPlaceholder')}</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        </div>
      );

    case 'multi_select':
      return (
        <div className={styles.field}>
          {labelEl}
          <MultiSelect
            value={toStringArray(value)}
            options={(field.options ?? []).map((opt) => ({ value: opt, label: opt }))}
            placeholder={field.placeholder || t('callcenter.cards.builder.multiSelectPlaceholder')}
            onChange={(v) => onChange(v)}
          />
        </div>
      );

    case 'checkbox':
      return (
        <div className={styles.fieldCheckbox}>
          <Checkbox
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <Label className={styles.checkboxLabel}>
            {field.label}
            {field.is_required ? <span className={styles.required}>*</span> : null}
          </Label>
        </div>
      );

    case 'date':
      return (
        <div className={styles.field}>
          {labelEl}
          <Input
            type="date"
            value={strValue}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case 'datetime':
      return (
        <div className={styles.field}>
          {labelEl}
          <Input
            type="datetime-local"
            value={strValue}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case 'phone':
      return (
        <div className={styles.field}>
          {labelEl}
          <Input
            type="tel"
            value={strValue}
            placeholder={field.placeholder || '+7 (___) ___-__-__'}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case 'email':
      return (
        <div className={styles.field}>
          {labelEl}
          <Input
            type="email"
            value={strValue}
            placeholder={field.placeholder}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case 'number':
      return (
        <div className={styles.field}>
          {labelEl}
          <Input
            type="number"
            value={strValue}
            placeholder={field.placeholder}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case 'phonebook_lookup':
      return (
        <div className={styles.field}>
          {labelEl}
          <Input
            value={strValue}
            placeholder={field.placeholder || t('callcenter.cards.builder.phonebookHint')}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
          <Text variant="muted" className={styles.hint}>
            {t('callcenter.cards.builder.phonebookAutoHint')}
          </Text>
        </div>
      );

    case 'readonly':
      return (
        <div className={styles.field}>
          {labelEl}
          <Text className={styles.readonlyValue}>{strValue || t('callcenter.cards.builder.emptyValue')}</Text>
        </div>
      );

    case 'text':
    default:
      return (
        <div className={styles.field}>
          {labelEl}
          <Input
            value={strValue}
            placeholder={field.placeholder}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
  }
});

FieldRenderer.displayName = 'FieldRenderer';
