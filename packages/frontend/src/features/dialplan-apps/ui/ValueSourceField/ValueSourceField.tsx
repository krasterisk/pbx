import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { IRoutePhonebook, ValueSource } from '@krasterisk/shared';
import { Input, Label, Select, Text, InfoTooltip } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import { useGetPhonebooksQuery } from '@/shared/api/endpoints/phonebookApi';
import { useGetEndpointsQuery } from '@/shared/api/endpoints/endpointApi';
import { extractExtension, interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import type { OptionsSource, ValueSourceMode } from '../../model/schema.types';
import type { DirectoryValueSource } from '@krasterisk/shared';
import { DirectoryLookupField, type DirectoryCatalogItem } from '../DirectoryLookupField';
import styles from './ValueSourceField.module.scss';

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
  /** `queue` = catalog + route_pattern; `scalar` = number / variable / phonebook. */
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
const SRC_PHONEBOOK = '__src:phonebook';
/** Store bare extension — strip PJSIP/e101_42 or ew101_42 pasted by mistake. */
export function normalizeBareExtension(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.includes('/')) return interfaceToExtension(trimmed);
  if (/^e(w?).+_\d+$/.test(trimmed)) return extractExtension(trimmed);
  return trimmed;
}

function collectPhonebookVarKeys(phonebook: IRoutePhonebook | undefined): string[] {
  const keys = new Set<string>();
  for (const entry of phonebook?.entries || []) {
    if (entry.vars) Object.keys(entry.vars).forEach((k) => keys.add(k));
  }
  return Array.from(keys).sort();
}

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
  const leftover = value as { phonebookUid?: number; varKey?: string };
  return (
    Number.isInteger(leftover.phonebookUid) &&
    (leftover.phonebookUid ?? 0) > 0 &&
    typeof leftover.varKey === 'string' &&
    leftover.varKey.trim().length > 0
  );
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

type LeftoverPhonebook = { source: 'phonebook'; phonebookUid: number; varKey: string };

function asPhonebook(value: ValueSource | undefined): LeftoverPhonebook | undefined {
  return sourceOf(value) === 'phonebook' ? (value as unknown as LeftoverPhonebook) : undefined;
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
    if (kind === 'phonebook' || kind === 'directory') return SRC_PHONEBOOK;
    return SRC_ROUTE;
  }
  if (mode === 'scalar') {
    if (!src || (src.source === 'fixed' && !src.value.trim())) return '';
    if (kind === 'fixed') return SRC_FIXED;
    if (kind === 'variable') return SRC_VARIABLE;
    if (kind === 'phonebook' || kind === 'directory') return SRC_PHONEBOOK;
    return '';
  }
  if (kind === 'fixed') return src.source === 'fixed' ? src.value : '';
  if (kind === 'route_pattern') return SRC_ROUTE;
  if (kind === 'variable') return SRC_VARIABLE;
  return SRC_PHONEBOOK;
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
  const leftoverPhonebook = asPhonebook(src);
  const directorySource = asDirectorySource(src);
  const phonebooksQuery = useGetPhonebooksQuery(undefined, {
    skip: mode === 'queue'
      ? optionsSource !== 'queues' && !leftoverPhonebook
      : !leftoverPhonebook,
  });
  const endpointsQuery = useGetEndpointsQuery(undefined, {
    skip: optionsSource !== 'endpoints' || src.source !== 'fixed',
  });
  const queues = queuesQuery.data ?? [];
  const phonebooks = phonebooksQuery.data ?? [];
  const endpoints = endpointsQuery.data ?? [];
  const selectedPhonebook = leftoverPhonebook
    ? phonebooks.find((pb) => pb.uid === leftoverPhonebook.phonebookUid)
    : undefined;
  const varKeys = collectPhonebookVarKeys(selectedPhonebook);
  const isLoading = mode === 'queue' && queuesQuery.isLoading;
  const isEmpty = mode === 'queue' && !isLoading && queues.length === 0;
  const complete = isValueSourceComplete(src);
  const markError = Boolean(required && showErrors && !complete && !isLoading);
  const queueEmptyError = markError && src.source === 'fixed' && !src.value.trim();
  const variableError = markError && src.source === 'variable';
  const phonebookUidError =
    markError && Boolean(leftoverPhonebook) && !(leftoverPhonebook && leftoverPhonebook.phonebookUid > 0);
  const phonebookVarError =
    markError &&
    Boolean(leftoverPhonebook && leftoverPhonebook.phonebookUid > 0) &&
    !(typeof leftoverPhonebook?.varKey === 'string' && leftoverPhonebook.varKey.trim());
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
  const varKeyLabel = isScalar
    ? t('routes.chain.source.selectPriorityVarKey', 'Поле с приоритетом')
    : isDial
      ? t('routes.chain.source.selectDestVarKey', 'Поле с номером')
      : t('routes.chain.source.selectVarKey', 'Поле с номером очереди');

  const handleQueueSelect = (raw: string) => {
    if (raw === SRC_ROUTE) onChange({ source: 'route_pattern' });
    else if (raw === SRC_VARIABLE) {
      onChange({ source: 'variable', name: src.source === 'variable' ? src.name : '' });
    } else if (raw === SRC_PHONEBOOK) {
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
    if (raw === SRC_PHONEBOOK) {
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

  const setPhonebookUid = (uid: number) => {
    const pb = phonebooks.find((item) => item.uid === uid);
    const keys = collectPhonebookVarKeys(pb);
    const prevKey = leftoverPhonebook?.varKey ?? '';
    onChange({
      source: 'phonebook',
      phonebookUid: uid,
      varKey: keys.includes(prevKey) ? prevKey : '',
    } as unknown as ValueSource);
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
          <option value={SRC_PHONEBOOK}>
            {t('routes.chain.source.phonebook', 'Из справочника')}
          </option>
        </Select>
      ) : mode === 'queue' ? (
        <VStack gap="8" max>
          <Select
            disabled={readOnly || isLoading || isEmpty}
            value={selectValue(src, mode)}
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
              <option value={SRC_PHONEBOOK}>
                {t('routes.chain.source.phonebook', 'Из справочника')}
              </option>
              <option value={SRC_VARIABLE}>
                {t('routes.chain.source.variable', 'Из переменной')}
              </option>
            </optgroup>
            <optgroup label={staticGroup}>
              {queues.map((q) => (
                <option key={q.name} value={q.exten || q.name}>
                  {q.exten || q.name}
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
          <option value={SRC_PHONEBOOK}>
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

      {leftoverPhonebook ? (
        <VStack gap="8" max className={styles.field}>
          <HStack gap="4" align="center">
            <Label className={styles.subLabel}>
              {t('routes.chain.source.selectPhonebook', 'Выберите справочник')}
              {required ? ' *' : ''}
            </Label>
            <InfoTooltip
              text={t(
                isScalar
                  ? 'routes.chain.source.priorityPhonebookHint'
                  : isDial
                    ? 'routes.chain.source.dialPhonebookHint'
                    : 'routes.chain.source.phonebookHint',
                isScalar
                  ? 'По **номеру звонящего** находим запись в справочнике\nБерём значение **выбранного поля**\nЭто значение становится **приоритетом** в очереди'
                  : isDial
                    ? 'По **номеру звонящего** находим запись в справочнике\nБерём значение **выбранного поля** записи\nЭто значение становится **номером для набора**'
                    : 'По **номеру звонящего** находим запись в справочнике\nБерём значение **выбранного поля** записи\nЭто значение становится **номером очереди**',
              )}
            />
          </HStack>
          <Select
            disabled={readOnly || phonebooksQuery.isLoading}
            value={leftoverPhonebook.phonebookUid ? String(leftoverPhonebook.phonebookUid) : ''}
            error={phonebookUidError}
            aria-invalid={phonebookUidError || undefined}
            aria-describedby={phonebookUidError ? 'queue-phonebook-error' : undefined}
            aria-label={t('routes.chain.source.phonebook', 'Из справочника')}
            onChange={(e) => setPhonebookUid(Number(e.target.value) || 0)}
          >
            <option value="">
              {phonebooksQuery.isLoading
                ? loadingLabel
                : t('routes.chain.source.selectPhonebook', 'Выберите справочник')}
            </option>
            {phonebooks.map((pb) => (
              <option key={pb.uid} value={String(pb.uid)}>
                {pb.name}
              </option>
            ))}
          </Select>
          {phonebookUidError ? (
            <Text id="queue-phonebook-error" variant="muted" className={styles.fieldError}>
              {t('routes.chain.source.phonebookRequired', 'Выберите справочник')}
            </Text>
          ) : null}

          {leftoverPhonebook.phonebookUid > 0 ? (
            <VStack gap="8" max className={styles.field}>
              <HStack gap="4" align="center">
                <Label className={styles.subLabel}>
                  {varKeyLabel}
                  {required ? ' *' : ''}
                </Label>
                <InfoTooltip
                  text={t(
                    isScalar
                      ? 'routes.chain.source.priorityVarKeyHint'
                      : isDial
                        ? 'routes.chain.source.dialVarKeyHint'
                        : 'routes.chain.source.varKeyHint',
                    isScalar
                      ? 'Ключ из **переменных записи** справочника\n**Пример:** в записи prio=5 - выберите prio'
                      : isDial
                        ? 'Ключ из **переменных записи** справочника\n**Пример:** в записи trunk_num=84951234567 - выберите trunk_num'
                        : 'Ключ из **переменных записи** справочника\n**Пример:** в записи queue=sales - выберите queue\nЗвонок пойдёт в очередь **sales**',
                  )}
                />
              </HStack>
              <Select
                disabled={readOnly || varKeys.length === 0}
                value={leftoverPhonebook.varKey || ''}
                error={phonebookVarError}
                aria-invalid={phonebookVarError || undefined}
                aria-describedby={phonebookVarError ? 'queue-varkey-error' : undefined}
                aria-label={varKeyLabel}
                onChange={(e) =>
                  onChange({
                    source: 'phonebook',
                    phonebookUid: leftoverPhonebook.phonebookUid,
                    varKey: e.target.value,
                  } as unknown as ValueSource)
                }
              >
                <option value="">
                  {varKeys.length === 0
                    ? t('routes.chain.source.noVarKeys', 'В справочнике нет переменных')
                    : t('routes.chain.source.selectVarKeyPlaceholder', 'Выберите поле')}
                </option>
                {varKeys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </Select>
              {phonebookVarError ? (
                <Text id="queue-varkey-error" variant="muted" className={styles.fieldError}>
                  {t('routes.chain.source.varKeyRequired', 'Выберите поле')}
                </Text>
              ) : null}
              {leftoverPhonebook.phonebookUid > 0 && varKeys.length === 0 ? (
                <Text variant="muted" className={styles.fieldError}>
                  {t(
                    'routes.chain.source.noVarKeysHint',
                    'Добавьте переменные в записи справочника, затем вернитесь сюда.',
                  )}
                </Text>
              ) : null}
            </VStack>
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
