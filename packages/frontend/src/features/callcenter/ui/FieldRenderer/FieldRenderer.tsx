import { memo, useId } from 'react';
import { cardAnswerLabel, cardChoiceValue, isCardDirectorySource, type CardChoice } from '@krasterisk/shared';
import { useGetCardFieldChoicesQuery } from '@/shared/api/endpoints/callCenterApi';
import { useGetDirectoryQuery } from '@/shared/api/endpoints/directoryApi';
import { useTranslation } from 'react-i18next';
import {
  Button, Input, Textarea, Select, Checkbox, MultiSelect, Text, Label, Separator,
} from '@/shared/ui';
import type { ICardField } from '@/features/callcenter/model/types/callCard';
import styles from './FieldRenderer.module.scss';

export interface FieldRendererProps {
  field: ICardField;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
  templateId?: number;
  preview?: boolean;
  choices?: CardChoice[];
  invalid?: boolean;
  errorId?: string;
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

export const FieldRenderer = memo(({ field, value, onChange, readOnly, templateId, preview, choices, invalid, errorId }: FieldRendererProps) => {
  const { t } = useTranslation();
  const controlId = useId();
  if (isCardDirectorySource(field.options)) return <DirectoryField field={field} value={value} onChange={onChange} readOnly={readOnly} templateId={templateId} preview={preview} invalid={invalid} errorId={errorId} />;
  const available = choices ?? (Array.isArray(field.options) ? field.options.map(opt => ({ value: opt, label: opt })) : []);
  const selected = Array.isArray(value) ? value.map(cardChoiceValue) : [];
  const changeChoice = (code: string) => onChange(choices ? available.find(opt => opt.value === code) ?? '' : code);

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
  const strValue = choices ? cardChoiceValue(value ?? field.default_value ?? '') : toStringValue(value ?? field.default_value ?? '');

  const labelEl = field.field_type !== 'checkbox' ? (
    <Label htmlFor={controlId} className={styles.label}>
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
            id={controlId} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined}
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
            id={controlId} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined}
            value={strValue}
            disabled={disabled}
            onChange={(e) => changeChoice(e.target.value)}
          >
            <option value="">{field.placeholder || t('callcenter.cards.builder.selectPlaceholder')}</option>
            {strValue && !available.some(opt => opt.value === strValue) ? <option value={strValue}>{cardAnswerLabel(value)}</option> : null}
            {available.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>
      );

    case 'multi_select':
      return (
        <div className={styles.field}>
          {labelEl}
          {disabled ? <Text>{cardAnswerLabel(value)}</Text> : <MultiSelect
            ariaLabel={field.label}
            searchable
            value={choices ? selected : toStringArray(value)}
            options={available}
            placeholder={field.placeholder || t('callcenter.cards.builder.multiSelectPlaceholder')}
            onChange={(v) => onChange(choices ? v.map(code => available.find(opt => opt.value === code) ?? (Array.isArray(value) ? value.find(item => cardChoiceValue(item) === code) : code)) : v)}
          />}
        </div>
      );

    case 'checkbox':
      return (
        <div className={styles.fieldCheckbox}>
          <Checkbox
            id={controlId} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined}
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <Label htmlFor={controlId} className={styles.checkboxLabel}>
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
            id={controlId} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined}
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
            id={controlId} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined}
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
            id={controlId} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined}
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
            id={controlId} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined}
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
            id={controlId} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined}
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
            id={controlId} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined}
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
            id={controlId} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined}
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

function DirectoryField(props: FieldRendererProps) {
  const { t } = useTranslation();
  const source = props.field.options;
  const binding = isCardDirectorySource(source) ? source : null;
  const saved = useGetCardFieldChoicesQuery({ templateId: props.templateId ?? 0, fieldKey: props.field.field_key }, { skip: !!props.preview || !props.templateId, refetchOnMountOrArgChange: true });
  const directory = useGetDirectoryQuery(binding?.directoryUid ?? 0, { skip: !props.preview || !binding?.directoryUid });
  let choices = saved.data ?? [];
  if (props.preview && directory.data && binding) {
    const valueKey = (directory.data.fields ?? []).find(f => f.uid === binding.valueFieldUid)?.key;
    const labelKey = (directory.data.fields ?? []).find(f => f.uid === binding.labelFieldUid)?.key;
    choices = valueKey && labelKey ? (directory.data.records ?? []).map(record => ({ value: String(record.values[valueKey] ?? ''), label: String(record.values[labelKey] ?? '') })) : [];
  }
  const loading = props.preview ? directory.isFetching : saved.isFetching;
  const error = props.preview ? directory.isError : saved.isError;
  return <div>
    <FieldRenderer {...props} field={{ ...props.field, options: [] }} choices={choices} readOnly={props.readOnly || loading || error} />
    {loading ? <Text variant="muted">{t('common.loading')}</Text> : null}
    {error ? <div role="alert"><Text>{t('callcenter.cards.builder.directoryLoadError')}</Text><Button type="button" onClick={() => { void (props.preview ? directory.refetch() : saved.refetch()); }}>{t('common.retry')}</Button></div> : null}
    {!loading && !error && !choices.length ? <Text variant="muted">{t('callcenter.cards.builder.directoryEmpty')}</Text> : null}
  </div>;
}
