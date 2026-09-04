import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ValueSource } from '@krasterisk/shared';
import { Input, Label, Select, Text, InfoTooltip } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import { useGetEndpointsQuery } from '@/shared/api/endpoints/endpointApi';
import type { OptionsSource, ValueSourceMode } from '../../model/schema.types';
import type { DirectoryValueSource } from '@krasterisk/shared';
import { normalizeBareExtension, stripTenantQueueName } from '../../model/normalizeTenantDisplayValue';
import { DirectoryLookupField, type DirectoryCatalogItem } from '../DirectoryLookupField';
import styles from './ValueSourceField.module.scss';

export { normalizeBareExtension } from '../../model/normalizeTenantDisplayValue';

export interface ValueSourceFieldProps {
  value: ValueSource | number | string | undefined;
  onChange: (next: ValueSource | undefined) => void;
  tenantUid: number;
  label: string;
  hint?: string;
  required?: boolean;
  /** Hide the visible label row; aria-label on controls still uses `label`. */
  hideLabel?: boolean;
  optionsSource?: OptionsSource;
  /** `queue` = catalog + route_pattern; `scalar` = number / variable / directory. */
  mode?: ValueSourceMode;
  readOnly?: boolean;
  /** Highlight incomplete required fields after a failed close/save attempt */
  showErrors?: boolean;
  /** Directory catalog from useSchemaRefs. DirectoryLookupField loads fields itself. */
  directories?: DirectoryCatalogItem[];
}

const SRC_ROUTE = '__src:route_pattern';
const SRC_FIXED = '__src:fixed';
const SRC_VARIABLE = '__src:variable';
const SRC_DIRECTORY = '__src:directory';

/** Dual-read legacy number/string into ValueSource for editors. */
export function coerceValueSource(
  value: ValueSource | number | string | undefined | null,
): ValueSource | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { source: 'fixed', value: String(Math.trunc(value)) };
  }
  if (typeof value === 'string' && value.trim()) {
    if (value.trim() === '${EXTEN}' || value.trim() === '__USE_EXTEN__') {
      return { source: 'route_pattern' };
    }
    return { source: 'fixed', value: value.trim() };
  }
  if (typeof value === 'object' && typeof value.source === 'string') {
    return value;
  }
  return undefined;
}

export function isValueSourceComplete(value: ValueSource | undefined): boolean {
  if (!value) return false;
  if (value.source === 'fixed') return value.value.trim().length > 0;
  if (value.source === 'route_pattern') return true;
  if (value.source === 'variable') return value.name.trim().length > 0;
  if (value.source === 'original_caller' || value.source === 'current_caller') return true;
  if (value.source === 'directory') {
    return (
      Number.isInteger(value.directoryUid) &&
      value.directoryUid > 0 &&
      Number.isInteger(value.valueFieldUid) &&
      value.valueFieldUid > 0
    );
  }
  return false;
}

function asValueSource(value: ValueSource | undefined): ValueSource {
  return value ?? { source: 'fixed', value: '' };
}

function sourceOf(value: ValueSource | undefined): string {
  return value && typeof value === 'object' ? value.source : '';
}

function asDirectorySource(value: ValueSource | undefined): DirectoryValueSource | undefined {
  return sourceOf(value) === 'directory' ? (value as DirectoryValueSource) : undefined;
}

function emptyDirectorySource(): DirectoryValueSource {
  return {
    source: 'directory',
    directoryUid: 0,
    keySource: { source: 'original_caller' },
    valueFieldUid: 0,
    onMissing: 'skip',
  };
}

function selectValue(src: ValueSource, mode: ValueSourceMode): string {
  const kind = sourceOf(src);
  if (mode === 'dial') {
    if (kind === 'route_pattern') return SRC_ROUTE;
    if (kind === 'fixed') return SRC_FIXED;
    if (kind === 'variable') return SRC_VARIABLE;
    if (kind === 'directory') return SRC_DIRECTORY;
    return SRC_ROUTE;
  }
  if (mode === 'scalar') {
    if (!src || (src.source === 'fixed' && !src.value.trim())) return '';
    if (kind === 'fixed') return SRC_FIXED;
    if (kind === 'variable') return SRC_VARIABLE;
    if (kind === 'directory') return SRC_DIRECTORY;
    return '';
  }
  if (kind === 'fixed') return src.source === 'fixed' ? src.value : '';
  if (kind === 'route_pattern') return SRC_ROUTE;
  if (kind === 'variable') return SRC_VARIABLE;
  return SRC_DIRECTORY;
}

export function ValueSourceField({
  value,
  onChange,
  label,
  hint,
  required,
  hideLabel,
  optionsSource,
  mode: modeProp,
  readOnly,
  showErrors = false,
  directories = [],
}: ValueSourceFieldProps) {
  const { t } = useTranslation();
  const mode: ValueSourceMode =
    modeProp ?? (optionsSource === 'queues' ? 'queue' : 'scalar');
  const coerced = coerceValueSource(value);
  const src = asValueSource(coerced);
  const queuesQuery = useGetQueuesQuery(undefined, { skip: mode !== 'queue' });
  const directorySource = asDirectorySource(src);
  const endpointsQuery = useGetEndpointsQuery(undefined, {
    skip: optionsSource !== 'endpoints' || src.source !== 'fixed',
  });
  const queues = queuesQuery.data ?? [];
  const endpoints = endpointsQuery.data ?? [];
  const queueCatalogValue = (q: (typeof queues)[number]) => q.exten || stripTenantQueueName(q.name);
  const queueSelectValue =
    mode === 'queue' && src.source === 'fixed' ? stripTenantQueueName(src.value) : selectValue(src, mode);
  const queueInCatalog =
    mode !== 'queue' ||
    src.source !== 'fixed' ||
    !queueSelectValue ||
    queues.some((q) => queueCatalogValue(q) === queueSelectValue);
  const isLoading = mode === 'queue' && queuesQuery.isLoading;
  const isEmpty = mode === 'queue' && !isLoading && queues.length === 0;
  const complete = isValueSourceComplete(src);
  const markError = Boolean(required && showErrors && !complete && !isLoading);
  const queueEmptyError = markError && src.source === 'fixed' && !src.value.trim();
  const variableError = markError && src.source === 'variable';
  const loadingLabel = t('routes.chain.catalog.loading', 'Загружаем список');
  const emptyLabel = t('routes.chain.catalog.empty', 'Ничего не создано');
  const sectionName = t('routes.chain.catalog.queuesSection', 'Очереди');
  const placeholder = isLoading
    ? loadingLabel
    : isEmpty
      ? emptyLabel
      : t('routes.apps.queue.selectQueue', 'Выберите очередь');
  const dynamicGroup = t('routes.chain.source.groupDynamic', 'Динамичная очередь');
  const staticGroup = t('routes.chain.source.groupStatic', 'Статичная очередь');
  const isScalar = mode === 'scalar';
  const isDial = mode === 'dial';
  const isEndpointPicker = optionsSource === 'endpoints' && isDial;
  const endpointExtensions = endpoints.map((item) => item.extension);
  const fixedExten = src.source === 'fixed' ? normalizeBareExtension(src.value) : '';
  const extenInCatalog = fixedExten ? endpointExtensions.includes(fixedExten) : false;
  const endpointsLoading = isEndpointPicker && endpointsQuery.isLoading;
  const endpointsEmpty = isEndpointPicker && !endpointsLoading && endpoints.length === 0;
  const endpointsSection = t('routes.chain.catalog.endpointsSection', 'Абоненты');
  const [endpointFilter, setEndpointFilter] = useState('');
  const filteredEndpoints = useMemo(() => {
    const q = endpointFilter.trim().toLowerCase();
    const base = !q
      ? endpoints
      : endpoints.filter((item) => {
          const ext = String(item.extension ?? '').toLowerCase();
          const cid = String(item.callerid ?? '').toLowerCase();
          return ext.includes(q) || cid.includes(q);
        });
    // Keep the current selection visible even if the search filter excludes it.
    if (fixedExten && extenInCatalog && !base.some((item) => item.extension === fixedExten)) {
      const selected = endpoints.find((item) => item.extension === fixedExten);
      return selected ? [selected, ...base] : base;
    }
    return base;
  }, [endpointFilter, endpoints, fixedExten, extenInCatalog]);
  const handleQueueSelect = (raw: string) => {
    if (raw === SRC_ROUTE) onChange({ source: 'route_pattern' });
    else if (raw === SRC_VARIABLE) {
      onChange({ source: 'variable', name: src.source === 'variable' ? src.name : '' });
    } else if (raw === SRC_DIRECTORY) {
      onChange(directorySource ?? emptyDirectorySource());
    } else if (raw === '') {
      onChange({ source: 'fixed', value: '' });
    } else {
      onChange({ source: 'fixed', value: raw });
    }
  };

  const handleScalarSelect = (raw: string) => {
    if (raw === '') {
      onChange(undefined);
      return;
    }
    if (raw === SRC_FIXED) {
      onChange({
        source: 'fixed',
        value: src.source === 'fixed' && src.value.trim() ? src.value : '0',
      });
      return;
    }
    if (raw === SRC_VARIABLE) {
      onChange({ source: 'variable', name: src.source === 'variable' ? src.name : '' });
      return;
    }
    if (raw === SRC_DIRECTORY) {
      onChange(directorySource ?? emptyDirectorySource());
    }
  };

  const handleDialSelect = (raw: string) => {
    if (raw === SRC_ROUTE || raw === '') {
      onChange({ source: 'route_pattern' });
      return;
    }
    if (raw === SRC_FIXED) {
      onChange({
        source: 'fixed',
        value: src.source === 'fixed' ? src.value : '',
      });
      return;
    }
    if (raw === SRC_VARIABLE) {
      onChange({ source: 'variable', name: src.source === 'variable' ? src.name : '' });
      return;
    }
    onChange(directorySource ?? emptyDirectorySource());
  };

  // With a hidden label the hint icon sits left of the control.
  const inlineHint = Boolean(hideLabel && hint);
  const withInlineHint = (control: ReactNode) =>
    inlineHint ? (
      <HStack gap="4" align="center" max className={styles.inlineHintRow}>
        <InfoTooltip text={hint as string} />
        {control}
      </HStack>
    ) : (
      control
    );

  return (
    <VStack gap="8" max className={styles.field}>
      {!hideLabel ? (
        <HStack gap="4" align="center">
          <Label className={styles.label}>
            {label}
            {required ? ' *' : ''}
          </Label>
          {hint ? <InfoTooltip text={hint} /> : null}
        </HStack>
      ) : null}

      {withInlineHint(mode === 'dial' ? (
        <Select
          disabled={readOnly}
          value={selectValue(src, 'dial')}
          error={markError}
          aria-invalid={markError || undefined}
          aria-label={label}
          onChange={(e) => handleDialSelect(e.target.value)}
        >
          <option value={SRC_ROUTE}>
            {t('routes.chain.source.routeNumber', 'B-номер маршрута')}
          </option>
          <option value={SRC_FIXED}>
            {t('routes.chain.source.fixed', 'Фиксированное значение')}
          </option>
          <option value={SRC_VARIABLE}>
            {t('routes.chain.source.variable', 'Из переменной')}
          </option>
          <option value={SRC_DIRECTORY}>
            {t('routes.chain.source.phonebook', 'Из справочника')}
          </option>
        </Select>
      ) : mode === 'queue' ? (
        <VStack gap="8" max>
          <Select
            disabled={readOnly || isLoading || isEmpty}
            value={queueSelectValue}
            error={queueEmptyError || (markError && src.source !== 'fixed' && !complete)}
            aria-invalid={markError || undefined}
            aria-describedby={queueEmptyError ? 'queue-source-error' : undefined}
            aria-label={isLoading ? loadingLabel : isEmpty ? emptyLabel : label}
            onChange={(e) => handleQueueSelect(e.target.value)}
          >
            <option value="">{placeholder}</option>
            <optgroup label={dynamicGroup}>
              <option value={SRC_ROUTE}>
                {t('routes.chain.source.routeNumber', 'B-номер маршрута')}
              </option>
              <option value={SRC_DIRECTORY}>
                {t('routes.chain.source.phonebook', 'Из справочника')}
              </option>
              <option value={SRC_VARIABLE}>
                {t('routes.chain.source.variable', 'Из переменной')}
              </option>
            </optgroup>
            <optgroup label={staticGroup}>
              {!queueInCatalog ? (
                <option value={queueSelectValue}>
                  {t('routes.chain.source.queueOrphan', '{{queue}} (нет в списке)').replace(
                    '{{queue}}',
                    queueSelectValue,
                  )}
                </option>
              ) : null}
              {queues.map((q) => (
                <option key={q.name} value={queueCatalogValue(q)}>
                  {queueCatalogValue(q)}
                  {q.display_name ? ` - ${q.display_name}` : ''}
                </option>
              ))}
            </optgroup>
          </Select>
          {queueEmptyError ? (
            <Text id="queue-source-error" variant="muted" className={styles.fieldError}>
              {t('routes.chain.source.required', 'Укажите очередь')}
            </Text>
          ) : null}
          {isEmpty ? (
            /* catalogLink exception: opens in a new tab, Text has no anchor props */
            <a href="/queues" target="_blank" rel="noopener noreferrer" className={styles.catalogLink}>
              {t('routes.chain.catalog.openSection', 'Открыть раздел «{{section}}»').replace(
                '{{section}}',
                sectionName,
              )}
            </a>
          ) : null}
        </VStack>
      ) : (
        <Select
          disabled={readOnly}
          value={selectValue(src, 'scalar')}
          aria-label={label}
          onChange={(e) => handleScalarSelect(e.target.value)}
        >
          <option value="">
            {t('routes.chain.source.priorityNone', 'Не задан')}
          </option>
          <option value={SRC_FIXED}>
            {t('routes.chain.source.priorityFixed', 'Число')}
          </option>
          <option value={SRC_VARIABLE}>
            {t('routes.chain.source.variable', 'Из переменной')}
          </option>
          <option value={SRC_DIRECTORY}>
            {t('routes.chain.source.phonebook', 'Из справочника')}
          </option>
        </Select>
      ))}

      {isDial && src.source === 'fixed' ? (
        isEndpointPicker ? (
          <VStack gap="8" max className={styles.endpointPicker}>
            <Input
              value={endpointFilter}
              disabled={readOnly || endpointsLoading}
              aria-label={t('routes.chain.source.searchEndpoint', 'Поиск абонента')}
              placeholder={t('routes.chain.source.searchEndpointPlaceholder', 'Номер или имя…')}
              onChange={(e) => setEndpointFilter(e.target.value)}
            />
            <Select
              disabled={readOnly || endpointsLoading}
              value={fixedExten}
              error={markError && !fixedExten}
              aria-invalid={markError && !fixedExten ? true : undefined}
              aria-label={t('routes.apps.exten.select', 'Абонент')}
              onChange={(e) => {
                onChange({ source: 'fixed', value: e.target.value });
              }}
            >
              <option value="">
                {endpointsLoading
                  ? loadingLabel
                  : t('routes.chain.source.selectEndpoint', 'Выберите абонента')}
              </option>
              {fixedExten && !extenInCatalog ? (
                <option value={fixedExten}>
                  {t('routes.chain.source.endpointOrphan', '{{exten}} (нет в списке)').replace(
                    '{{exten}}',
                    fixedExten,
                  )}
                </option>
              ) : null}
              {filteredEndpoints.map((item) => (
                <option key={item.extension} value={item.extension}>
                  {item.callerid ? `${item.extension} - ${item.callerid}` : item.extension}
                </option>
              ))}
              {!endpointsLoading && filteredEndpoints.length === 0 && endpoints.length > 0 ? (
                <option value="" disabled>
                  {t('routes.chain.source.endpointNoMatch', 'Ничего не найдено')}
                </option>
              ) : null}
            </Select>
            {endpointsEmpty ? (
              <a href="/endpoints" target="_blank" rel="noopener noreferrer" className={styles.catalogLink}>
                {t('routes.chain.catalog.openSection', 'Открыть раздел «{{section}}»').replace(
                  '{{section}}',
                  endpointsSection,
                )}
              </a>
            ) : null}
          </VStack>
        ) : (
          <Input
            value={src.value}
            disabled={readOnly}
            aria-label={label}
            placeholder={t('routes.chain.fields.destPlaceholder', 'Например: 79001234567')}
            onChange={(e) => onChange({ source: 'fixed', value: e.target.value })}
          />
        )
      ) : null}

      {isScalar && src.source === 'fixed' && coerced ? (
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={20}
          value={src.value}
          disabled={readOnly}
          aria-invalid={markError || undefined}
          aria-label={label}
          onChange={(e) => onChange({ source: 'fixed', value: e.target.value })}
        />
      ) : null}

      {src.source === 'variable' ? (
        <VStack gap="8" max className={styles.field}>
          <HStack gap="4" align="center">
            <Label className={styles.subLabel}>
              {t('routes.chain.fields.variableName', 'Имя переменной')}
              {required ? ' *' : ''}
            </Label>
            <InfoTooltip
              text={t(
                isScalar
                  ? 'routes.chain.source.priorityVariableHint'
                  : isDial
                    ? 'routes.chain.source.dialVariableHint'
                    : 'routes.chain.source.variableHint',
                isScalar
                  ? 'Имя переменной канала **без ${}**\n**Пример:** VIP_PRIO\nЗначение должно быть числом приоритета'
                  : isDial
                    ? 'Имя переменной канала **без ${}**\n**Пример:** OUTNUM или DEST\nЗначение подставляется в номер для набора'
                    : 'Имя переменной канала **без ${}**\n**Пример:** MY_QUEUE или QUEUE_EXTEN\nЗначения переменной задаются ранее в цепочке маршрута, либо в webhook',
              )}
            />
          </HStack>
          <Input
            value={src.name}
            disabled={readOnly}
            aria-invalid={variableError || undefined}
            aria-describedby={variableError ? 'queue-variable-error' : undefined}
            className={variableError ? styles.invalid : undefined}
            placeholder={t(
              isScalar
                ? 'routes.chain.fields.priorityVariablePlaceholder'
                : 'routes.chain.fields.variableNamePlaceholder',
              isScalar ? 'Например: VIP_PRIO' : 'Например: MY_QUEUE',
            )}
            aria-label={t('routes.chain.fields.variableName', 'Имя переменной')}
            onChange={(e) => onChange({ source: 'variable', name: e.target.value })}
          />
          {variableError ? (
            <Text id="queue-variable-error" variant="muted" className={styles.fieldError}>
              {t('routes.chain.source.variableRequired', 'Укажите имя переменной')}
            </Text>
          ) : null}
        </VStack>
      ) : null}

      {directorySource ? (
        <DirectoryLookupField
          value={directorySource.directoryUid > 0 ? directorySource : undefined}
          onChange={onChange}
          directories={directories}
          readOnly={readOnly}
        />
      ) : null}
    </VStack>
  );
}
