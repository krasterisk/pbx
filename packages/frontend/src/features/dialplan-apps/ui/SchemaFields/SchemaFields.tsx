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
  FieldVisibleWhenRule,
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
  /** Route extensions for live dial-number preview (route_pattern dest). */
  previewPatterns?: string[];
}

function assertNever(x: never): never {
  throw new Error(`Unknown field kind: ${String(x)}`);
}

function isRuleVisible(rule: FieldVisibleWhenRule, params: Record<string, unknown>): boolean {
  const actual = params[rule.key];
  const expected = rule.equals;
  return Array.isArray(expected)
    ? expected.includes(String(actual ?? ''))
    : String(actual ?? '') === expected;
}

function isVisibleWhenArray(cond: FieldSchema['visibleWhen']): cond is readonly FieldVisibleWhenRule[] {
  return Array.isArray(cond);
}

function isFieldVisible(field: FieldSchema, params: Record<string, unknown>): boolean {
  const cond = field.visibleWhen;
  if (!cond) return true;
  if (isVisibleWhenArray(cond)) {
    return cond.every((rule) => isRuleVisible(rule, params));
  }
  return isRuleVisible(cond, params);
}

type SchemaChunk =
  | { kind: 'single'; field: FieldSchema }
  | { kind: 'row'; rowId: string; fields: FieldSchema[] };

/** Group consecutive visible fields that share the same `row` id. */
export function chunkSchemaFields(
  schema: FieldSchema[],
  params: Record<string, unknown>,
): SchemaChunk[] {
  const chunks: SchemaChunk[] = [];
  let i = 0;
  while (i < schema.length) {
    const field = schema[i];
    if (!isFieldVisible(field, params)) {
      i += 1;
      continue;
    }
    if (!field.row) {
      chunks.push({ kind: 'single', field });
      i += 1;
      continue;
    }
    const rowId = field.row;
    const fields: FieldSchema[] = [field];
    let j = i + 1;
    while (j < schema.length) {
      const next = schema[j];
      if (!isFieldVisible(next, params)) {
        j += 1;
        continue;
      }
      if (next.row !== rowId) break;
      fields.push(next);
      j += 1;
    }
    chunks.push(fields.length > 1 ? { kind: 'row', rowId, fields } : { kind: 'single', field });
    i = j;
  }
  return chunks;
}

function rowColsCss(fields: FieldSchema[]): string {
  return fields.map((f) => `minmax(0, ${f.rowWeight ?? 1}fr)`).join(' ');
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
  prompts: { href: '/prompts', sectionKey: 'routes.chain.catalog.promptsSection', sectionFallback: 'Записи' },
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
  callGroups: {
    href: '/call-groups',
    sectionKey: 'routes.chain.catalog.callGroupsSection',
    sectionFallback: 'Группы вызова',
  },
  voiceRobots: {
    href: '/voice-robots',
    sectionKey: 'routes.chain.catalog.voiceRobotsSection',
    sectionFallback: 'Голосовые роботы',
  },
  contexts: {
    href: '/contexts',
    sectionKey: 'routes.chain.catalog.contextsSection',
    sectionFallback: 'Контексты',
  },
  endpoints: {
    href: '/endpoints',
    sectionKey: 'routes.chain.catalog.endpointsSection',
    sectionFallback: 'Абоненты',
  },
  numberLists: {
    href: '/numbers',
    sectionKey: 'routes.chain.catalog.numberListsSection',
    sectionFallback: 'Списки доступа',
  },
  notifications: {
    href: '/notifications',
    sectionKey: 'routes.chain.catalog.notificationsSection',
    sectionFallback: 'Интеграции уведомлений',
  },
};

function FieldShell({
  id,
  label,
  required,
  hint,
  error,
  hideLabel,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  children: ReactNode;
}) {
  // With a hidden label the hint icon sits left of the control, not on a row of its own.
  const inlineHint = Boolean(hideLabel && hint);

  return (
    <VStack gap="8" max className={styles.field}>
      {!hideLabel ? (
        <HStack gap="4" align="center">
          <Label htmlFor={id} className={styles.label}>
            {label}
            {required ? ' *' : ''}
          </Label>
          {hint ? <InfoTooltip text={hint} /> : null}
        </HStack>
      ) : null}
      {inlineHint ? (
        <HStack gap="4" align="center" max className={styles.inlineHintRow}>
          <InfoTooltip text={hint as string} />
          {children}
        </HStack>
      ) : (
        children
      )}
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
          {/* catalogLink exception: cross-section link opens in a new tab, Text has no anchor props */}
          <a
            href={catalog?.sectionHref ?? defaults.href}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.catalogLink}
          >
            {t('routes.chain.catalog.openSection', 'Открыть раздел «{{section}}»').replace(
              '{{section}}',
              sectionName,
            )}
          </a>
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
    hint?: string;
    readOnly?: boolean;
    invalid: boolean;
    errorId?: string;
    refs?: SchemaRefs;
    tenantUid: number;
    showErrors: boolean;
    previewPatterns?: string[];
  },
): ReactNode {
  const { id, label, hint, readOnly, invalid, errorId, refs, tenantUid, showErrors } = extras;
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
          placeholder={field.placeholder}
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
          value={raw as ValueSource | number | string | undefined}
          onChange={(next) => onChange({ [field.key]: next })}
          tenantUid={tenantUid}
          label={label}
          hint={hint}
          required={field.required}
          hideLabel={field.hideLabel}
          optionsSource={field.optionsSource}
          mode={field.valueSourceMode}
          readOnly={readOnly}
          showErrors={showErrors || invalid}
        />
      );
    case 'custom':
      if (typeof field.render === 'function') {
        return field.render({
          params,
          onChange,
          readOnly,
          field,
          previewPatterns: extras.previewPatterns,
          tenantUid,
        });
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
  previewPatterns,
}: SchemaFieldsProps) {
  const { t } = useTranslation();

  const renderField = (field: FieldSchema) => {
    const label = t(field.labelKey, field.label ?? field.labelKey);
    const hint = field.hintKey ? t(field.hintKey, field.hint ?? field.hintKey) : undefined;
    const id = `schema-field-${field.key}`;
    const empty = isEmptyValue(params[field.key]);
    const error = fieldErrors?.[field.key];
    const invalid = Boolean(error || (field.required && empty));
    const errorId = error ? `${id}-error` : undefined;
    const renderCtxExtras = { previewPatterns, tenantUid };

    if (field.kind === 'value-source') {
      return renderControl(field, params, onChange, {
        id,
        label,
        hint,
        readOnly,
        invalid,
        errorId,
        refs,
        tenantUid,
        showErrors,
        previewPatterns,
      });
    }

    if (field.kind === 'custom' && typeof field.render === 'function') {
      return (
        <FieldShell
          id={id}
          label={label}
          required={field.required}
          hint={hint}
          error={error}
          hideLabel={field.hideLabel}
        >
          {field.render({ params, onChange, readOnly, field, ...renderCtxExtras })}
        </FieldShell>
      );
    }

    return (
      <FieldShell
        id={id}
        label={label}
        required={field.required}
        hint={hint}
        error={error}
        hideLabel={field.hideLabel}
      >
        {renderControl(field, params, onChange, {
          id,
          label,
          hint,
          readOnly,
          invalid,
          errorId,
          refs,
          tenantUid,
          showErrors,
          previewPatterns,
        })}
      </FieldShell>
    );
  };

  const chunks = chunkSchemaFields(schema, params);

  return (
    <VStack gap="12" max className={styles.fields}>
      {chunks.map((chunk) => {
        if (chunk.kind === 'single') {
          return (
            <VStack key={chunk.field.key} gap="0" max className={styles.fieldCell}>
              {renderField(chunk.field)}
            </VStack>
          );
        }
        return (
          <VStack
            key={`row-${chunk.rowId}`}
            gap="0"
            max
            className={styles.fieldRow}
            style={{ ['--schema-row-cols' as string]: rowColsCss(chunk.fields) }}
          >
            {chunk.fields.map((field) => (
              <VStack key={field.key} gap="0" max className={styles.fieldCell}>
                {renderField(field)}
              </VStack>
            ))}
          </VStack>
        );
      })}
    </VStack>
  );
}
