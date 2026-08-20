import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ValueSource } from '@krasterisk/shared';
import {
  Checkbox,
  Input,
  Label,
  MultiSelect,
  PasswordInput,
  RadioCards,
  SegmentedControl,
  Select,
  Switch,
  TagInput,
  Text,
  InfoTooltip,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { ValueSourceField } from '../ValueSourceField/ValueSourceField';
import type {
  FieldKind,
  FieldSchema,
  OptionsSource,
  SchemaRefs,
} from '../../model/schema.types';
import styles from './SchemaFields.module.scss';

export interface SchemaFieldsProps {
  schema: FieldSchema[];
  params: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  readOnly?: boolean;
  refs?: SchemaRefs;
  fieldErrors?: Record<string, string>;
  showErrors?: boolean;
  tenantUid?: number;
}

function assertNever(x: never): never {
  throw new Error(`Unknown field kind: ${String(x)}`);
}

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (typeof value === 'number') return Number.isNaN(value);
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

const CATALOG_DEFAULTS: Record<
  OptionsSource,
  { href: string; sectionKey: string; sectionFallback: string }
> = {
  queues: { href: '/queues', sectionKey: 'routes.chain.catalog.queuesSection', sectionFallback: 'Очереди' },
  trunks: { href: '/trunks', sectionKey: 'routes.chain.catalog.trunksSection', sectionFallback: 'Транки' },
  ivrs: { href: '/ivrs', sectionKey: 'routes.chain.catalog.ivrsSection', sectionFallback: 'IVR' },
  prompts: { href: '/prompts', sectionKey: 'routes.chain.catalog.promptsSection', sectionFallback: 'Промпты' },
  phonebooks: {
    href: '/phonebooks',
    sectionKey: 'routes.chain.catalog.phonebooksSection',
    sectionFallback: 'Справочники',
  },
  'tts-engines': {
    href: '/settings/tts-engines',
    sectionKey: 'routes.chain.catalog.ttsSection',
    sectionFallback: 'Движки синтеза',
  },
};

function FieldShell({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <VStack gap="8" max className={styles.field}>
      <HStack gap="4" align="center">
        <Label htmlFor={id} className={styles.label}>
          {label}
          {required ? ' *' : ''}
        </Label>
        {hint ? <InfoTooltip text={hint} /> : null}
      </HStack>
      {children}
      {error ? (
        <Text id={`${id}-error`} variant="muted" className={styles.error}>
          {error}
        </Text>
      ) : null}
    </VStack>
  );
}

function RefSelect({
  id,
  label,
  source,
  value,
  catalog,
  readOnly,
  invalid,
  errorId,
  onChange,
}: {
  id: string;
  label: string;
  source: OptionsSource;
  value: string;
  catalog: SchemaRefs[OptionsSource];
  readOnly?: boolean;
  invalid?: boolean;
  errorId?: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const defaults = CATALOG_DEFAULTS[source];
  const loading = catalog?.isLoading ?? false;
  const items = catalog?.items ?? [];
  const empty = !loading && items.length === 0;
  const loadingLabel = t('routes.chain.catalog.loading', 'Загружаем список');
  const emptyLabel = t('routes.chain.catalog.empty', 'Ничего не создано');
  const sectionName = t(
    catalog?.sectionKey ?? defaults.sectionKey,
    catalog?.sectionFallback ?? defaults.sectionFallback,
  );
  const aria = loading ? loadingLabel : empty ? emptyLabel : label;
  const placeholder = loading ? loadingLabel : empty ? emptyLabel : t('routes.chain.catalog.choose', 'Выберите');

  return (
    <VStack gap="8" max>
      <Select
        id={id}
        disabled={readOnly || loading || empty}
        value={value}
        aria-label={aria}
        aria-invalid={invalid || undefined}
        aria-describedby={errorId}
        className={styles.touchTarget}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </Select>
      {empty ? (
        <>
          <Text variant="muted">
            {t('routes.chain.catalog.emptyHint', 'Сначала создайте запись в разделе «{{section}}»').replace(
              '{{section}}',
              sectionName,
            )}
          </Text>
          <Text
            as="a"
            href={catalog?.sectionHref ?? defaults.href}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.catalogLink}
          >
            {t('routes.chain.catalog.openSection', 'Открыть раздел «{{section}}»').replace(
              '{{section}}',
              sectionName,
            )}
          </Text>
        </>
      ) : null}
    </VStack>
  );
}

function renderControl(
  field: FieldSchema,
  params: Record<string, unknown>,
  onChange: (patch: Record<string, unknown>) => void,
  extras: {
    id: string;
    label: string;
    readOnly?: boolean;
    invalid: boolean;
    errorId?: string;
    refs?: SchemaRefs;
    tenantUid: number;
    showErrors: boolean;
  },
): ReactNode {
  const { id, label, readOnly, invalid, errorId, refs, tenantUid, showErrors } = extras;
  const raw = params[field.key];
  const kind: FieldKind = field.kind;

  switch (kind) {
    case 'text':
      return (
        <Input
          id={id}
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-describedby={errorId}
          disabled={readOnly}
          className={invalid ? styles.invalid : undefined}
          value={typeof raw === 'string' ? raw : ''}
          onChange={(e) => onChange({ [field.key]: e.target.value })}
        />
      );
    case 'number':
    case 'duration':
      return (
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-describedby={errorId}
          disabled={readOnly}
          className={invalid ? styles.invalid : undefined}
          value={raw === undefined || raw === null ? '' : String(raw)}
          onChange={(e) =>
            onChange({
              [field.key]: e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
        />
      );
    case 'secret':
      return (
        <PasswordInput
          id={id}
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-describedby={errorId}
          disabled={readOnly}
          value={typeof raw === 'string' ? raw : ''}
          onChange={(e) => onChange({ [field.key]: e.target.value })}
        />
      );
    case 'select':
      if (field.optionsSource) {
        return (
          <RefSelect
            id={id}
            label={label}
            source={field.optionsSource}
            value={typeof raw === 'string' ? raw : ''}
            catalog={refs?.[field.optionsSource]}
            readOnly={readOnly}
            invalid={invalid}
            errorId={errorId}
            onChange={(next) => onChange({ [field.key]: next })}
          />
        );
      }
      return (
        <Select
          id={id}
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-describedby={errorId}
          disabled={readOnly}
          value={typeof raw === 'string' ? raw : ''}
          onChange={(e) => onChange({ [field.key]: e.target.value })}
        >
          <option value="">{label}</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label ?? opt.labelKey}
            </option>
          ))}
        </Select>
      );
    case 'multiselect':
      return (
        <div aria-label={label} role="group">
          <MultiSelect
            value={Array.isArray(raw) ? (raw as string[]) : []}
            onChange={(next) => onChange({ [field.key]: next })}
            options={(field.options ?? []).map((opt) => ({
              value: opt.value,
              label: opt.label ?? opt.labelKey,
            }))}
            placeholder={label}
          />
        </div>
      );
    case 'toggle':
      return (
        <Switch
          id={id}
          aria-label={label}
          disabled={readOnly}
          checked={Boolean(raw)}
          onCheckedChange={(checked) => onChange({ [field.key]: checked })}
        />
      );
    case 'checkbox':
      return (
        <Checkbox
          id={id}
          aria-label={label}
          aria-invalid={invalid || undefined}
          disabled={readOnly}
          checked={Boolean(raw)}
          onChange={(e) => onChange({ [field.key]: e.target.checked })}
        />
      );
    case 'tags':
      return (
        <TagInput
          value={Array.isArray(raw) ? (raw as string[]) : []}
          onChange={(next) => onChange({ [field.key]: next })}
          placeholder={label}
          disabled={readOnly}
        />
      );
    case 'choice-cards':
      return (
        <div role="radiogroup" aria-label={label}>
          <RadioCards
            value={typeof raw === 'string' ? raw : ''}
            disabled={readOnly}
            onChange={(next) => onChange({ [field.key]: next })}
            options={(field.options ?? []).map((opt) => ({
              value: opt.value,
              label: opt.label ?? opt.labelKey,
              description: opt.description ?? opt.descriptionKey,
            }))}
          />
        </div>
      );
    case 'mode':
      return (
        <SegmentedControl
          ariaLabel={label}
          value={(typeof raw === 'string' && raw) || field.options?.[0]?.value || ''}
          onChange={(next) => onChange({ [field.key]: next })}
          options={(field.options ?? []).map((opt) => ({
            value: opt.value,
            label: opt.label ?? opt.labelKey,
          }))}
        />
      );
    case 'value-source':
      return (
        <ValueSourceField
          value={raw as ValueSource | undefined}
          onChange={(next) => onChange({ [field.key]: next })}
          tenantUid={tenantUid}
          label={label}
          hint={field.hintKey}
          required={field.required}
          optionsSource={field.optionsSource}
          readOnly={readOnly}
          showErrors={showErrors || invalid}
        />
      );
    case 'custom':
      if (typeof field.render === 'function') {
        return field.render({ params, onChange, readOnly, field });
      }
      throw new Error(`custom field "${field.key}" is missing render`);
    default:
      return assertNever(kind);
  }
}

export function SchemaFields({
  schema,
  params,
  onChange,
  readOnly,
  refs,
  fieldErrors,
  showErrors = false,
  tenantUid = 0,
}: SchemaFieldsProps) {
  const { t } = useTranslation();

  return (
    <VStack gap="12" max className={styles.fields}>
      {schema.map((field) => {
        if (field.visibleWhen) {
          const actual = params[field.visibleWhen.key];
          const expected = field.visibleWhen.equals;
          const visible = Array.isArray(expected)
            ? expected.includes(String(actual ?? ''))
            : String(actual ?? '') === expected;
          if (!visible) return null;
        }
        const label = t(field.labelKey, field.label ?? field.labelKey);
        const hint = field.hintKey ? t(field.hintKey, field.hint ?? field.hintKey) : undefined;
        const id = `schema-field-${field.key}`;
        const empty = isEmptyValue(params[field.key]);
        const error = fieldErrors?.[field.key];
        const invalid = Boolean(error || (field.required && empty));
        const errorId = error ? `${id}-error` : undefined;

        if (field.kind === 'value-source') {
          return (
            <div key={field.key}>
              {renderControl(field, params, onChange, {
                id,
                label,
                readOnly,
                invalid,
                errorId,
                refs,
                tenantUid,
                showErrors,
              })}
            </div>
          );
        }

        if (field.kind === 'custom' && typeof field.render === 'function') {
          return (
            <FieldShell key={field.key} id={id} label={label} required={field.required} hint={hint} error={error}>
              {field.render({ params, onChange, readOnly, field })}
            </FieldShell>
          );
        }

        return (
          <FieldShell key={field.key} id={id} label={label} required={field.required} hint={hint} error={error}>
            {renderControl(field, params, onChange, {
              id,
              label,
              readOnly,
              invalid,
              errorId,
              refs,
              tenantUid,
              showErrors,
            })}
          </FieldShell>
        );
      })}
    </VStack>
  );
}
