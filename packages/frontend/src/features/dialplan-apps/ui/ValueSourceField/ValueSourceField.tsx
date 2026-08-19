import { useTranslation } from 'react-i18next';
import type { IRoutePhonebook, ValueSource } from '@krasterisk/shared';
import { Input, Label, Select, Text, InfoTooltip } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import { useGetPhonebooksQuery } from '@/shared/api/endpoints/phonebookApi';
import type { OptionsSource } from '../../model/schema.types';
import styles from './ValueSourceField.module.scss';

export interface ValueSourceFieldProps {
  value: ValueSource | undefined;
  onChange: (next: ValueSource) => void;
  tenantUid: number;
  label: string;
  hint?: string;
  required?: boolean;
  optionsSource?: OptionsSource;
  readOnly?: boolean;
  /** Highlight incomplete required fields after a failed close/save attempt */
  showErrors?: boolean;
}

const SRC_ROUTE = '__src:route_pattern';
const SRC_VARIABLE = '__src:variable';
const SRC_PHONEBOOK = '__src:phonebook';

function collectPhonebookVarKeys(phonebook: IRoutePhonebook | undefined): string[] {
  const keys = new Set<string>();
  for (const entry of phonebook?.entries || []) {
    if (entry.vars) Object.keys(entry.vars).forEach((k) => keys.add(k));
  }
  return Array.from(keys).sort();
}

export function isValueSourceComplete(value: ValueSource | undefined): boolean {
  if (!value) return false;
  if (value.source === 'fixed') return value.value.trim().length > 0;
  if (value.source === 'route_pattern') return true;
  if (value.source === 'variable') return value.name.trim().length > 0;
  return (
    Number.isInteger(value.phonebookUid) &&
    value.phonebookUid > 0 &&
    typeof value.varKey === 'string' &&
    value.varKey.trim().length > 0
  );
}

function asValueSource(value: ValueSource | undefined): ValueSource {
  return value ?? { source: 'fixed', value: '' };
}

function selectValue(src: ValueSource): string {
  if (src.source === 'fixed') return src.value;
  if (src.source === 'route_pattern') return SRC_ROUTE;
  if (src.source === 'variable') return SRC_VARIABLE;
  return SRC_PHONEBOOK;
}

export function ValueSourceField({
  value,
  onChange,
  label,
  hint,
  required,
  optionsSource,
  readOnly,
  showErrors = false,
}: ValueSourceFieldProps) {
  const { t } = useTranslation();
  const src = asValueSource(value);
  const queuesQuery = useGetQueuesQuery(undefined, { skip: optionsSource !== 'queues' });
  const phonebooksQuery = useGetPhonebooksQuery(undefined, {
    skip: optionsSource !== 'queues' && src.source !== 'phonebook',
  });
  const queues = queuesQuery.data ?? [];
  const phonebooks = phonebooksQuery.data ?? [];
  const selectedPhonebook =
    src.source === 'phonebook'
      ? phonebooks.find((pb) => pb.uid === src.phonebookUid)
      : undefined;
  const varKeys = collectPhonebookVarKeys(selectedPhonebook);
  const isLoading = optionsSource === 'queues' && queuesQuery.isLoading;
  const isEmpty = optionsSource === 'queues' && !isLoading && queues.length === 0;
  const complete = isValueSourceComplete(src);
  const markError = Boolean(required && showErrors && !complete && !isLoading);
  const queueEmptyError = markError && src.source === 'fixed' && !src.value.trim();
  const variableError = markError && src.source === 'variable';
  const phonebookUidError =
    markError && src.source === 'phonebook' && !(src.phonebookUid > 0);
  const phonebookVarError =
    markError &&
    src.source === 'phonebook' &&
    src.phonebookUid > 0 &&
    !(typeof src.varKey === 'string' && src.varKey.trim());
  const loadingLabel = t('routes.chain.catalog.loading', 'Загружаем список');
  const emptyLabel = t('routes.chain.catalog.empty', 'Нет очередей');
  const sectionName = t('routes.chain.catalog.queuesSection', 'Очереди');
  const placeholder = isLoading
    ? loadingLabel
    : isEmpty
      ? emptyLabel
      : t('routes.apps.queue.selectQueue', 'Выберите очередь');
  const dynamicGroup = t('routes.chain.source.groupDynamic', 'Динамичная очередь');
  const staticGroup = t('routes.chain.source.groupStatic', 'Статичная очередь');

  const handleSelect = (raw: string) => {
    if (raw === SRC_ROUTE) onChange({ source: 'route_pattern' });
    else if (raw === SRC_VARIABLE) {
      onChange({ source: 'variable', name: src.source === 'variable' ? src.name : '' });
    } else if (raw === SRC_PHONEBOOK) {
      onChange({
        source: 'phonebook',
        phonebookUid: src.source === 'phonebook' ? src.phonebookUid : 0,
        varKey: src.source === 'phonebook' ? src.varKey : '',
      });
    } else if (raw === '') {
      onChange({ source: 'fixed', value: '' });
    } else {
      onChange({ source: 'fixed', value: raw });
    }
  };

  const setPhonebookUid = (uid: number) => {
    const pb = phonebooks.find((item) => item.uid === uid);
    const keys = collectPhonebookVarKeys(pb);
    const prevKey = src.source === 'phonebook' ? src.varKey : '';
    onChange({
      source: 'phonebook',
      phonebookUid: uid,
      varKey: keys.includes(prevKey) ? prevKey : '',
    });
  };

  return (
    <VStack gap="8" max className={styles.field}>
      <HStack gap="4" align="center">
        <Label className={styles.label}>
          {label}
          {required ? ' *' : ''}
        </Label>
        {hint ? <InfoTooltip text={hint} /> : null}
      </HStack>

      {optionsSource === 'queues' ? (
        <VStack gap="8" max>
          <Select
            disabled={readOnly || isLoading}
            value={selectValue(src)}
            error={queueEmptyError || (markError && src.source !== 'fixed' && !complete)}
            aria-invalid={markError || undefined}
            aria-describedby={queueEmptyError ? 'queue-source-error' : undefined}
            aria-label={isLoading ? loadingLabel : isEmpty ? emptyLabel : label}
            onChange={(e) => handleSelect(e.target.value)}
          >
            <option value="">{placeholder}</option>
            <optgroup label={dynamicGroup}>
              <option value={SRC_ROUTE}>
                {t('routes.chain.source.routePattern', 'По маске маршрута (exten)')}
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
            <Text
              as="a"
              href="/queues"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.catalogLink}
            >
              {t('routes.chain.catalog.openSection', 'Открыть раздел «{{section}}»').replace(
                '{{section}}',
                sectionName,
              )}
            </Text>
          ) : null}
        </VStack>
      ) : (
        <Input
          value={src.source === 'fixed' ? src.value : ''}
          disabled={readOnly}
          onChange={(e) => onChange({ source: 'fixed', value: e.target.value })}
        />
      )}

      {src.source === 'variable' ? (
        <VStack gap="8" max className={styles.field}>
          <HStack gap="4" align="center">
            <Label className={styles.subLabel}>
              {t('routes.chain.fields.variableName', 'Имя переменной')}
              {required ? ' *' : ''}
            </Label>
            <InfoTooltip
              text={t(
                'routes.chain.source.variableHint',
                'Имя переменной канала **без ${}**\n**Пример:** MY_QUEUE или QUEUE_EXTEN\nЗначения переменной задаются ранее в цепочке маршрута, либо в webhook',
              )}
            />
          </HStack>
          <Input
            value={src.name}
            disabled={readOnly}
            aria-invalid={variableError || undefined}
            aria-describedby={variableError ? 'queue-variable-error' : undefined}
            className={variableError ? styles.invalid : undefined}
            placeholder={t('routes.chain.fields.variableNamePlaceholder', 'Например: MY_QUEUE')}
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

      {src.source === 'phonebook' ? (
        <VStack gap="8" max className={styles.field}>
          <HStack gap="4" align="center">
            <Label className={styles.subLabel}>
              {t('routes.chain.source.selectPhonebook', 'Выберите справочник')}
              {required ? ' *' : ''}
            </Label>
            <InfoTooltip
              text={t(
                'routes.chain.source.phonebookHint',
                'По **номеру звонящего** находим запись в справочнике\nБерём значение **выбранного поля** записи\nЭто значение становится **номером очереди**',
              )}
            />
          </HStack>
          <Select
            disabled={readOnly || phonebooksQuery.isLoading}
            value={src.phonebookUid ? String(src.phonebookUid) : ''}
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

          {src.phonebookUid > 0 ? (
            <VStack gap="8" max className={styles.field}>
              <HStack gap="4" align="center">
                <Label className={styles.subLabel}>
                  {t('routes.chain.source.selectVarKey', 'Поле с номером очереди')}
                  {required ? ' *' : ''}
                </Label>
                <InfoTooltip
                  text={t(
                    'routes.chain.source.varKeyHint',
                    'Ключ из **переменных записи** справочника\n**Пример:** в записи queue=sales - выберите queue\nЗвонок пойдёт в очередь **sales**',
                  )}
                />
              </HStack>
              <Select
                disabled={readOnly || varKeys.length === 0}
                value={src.varKey || ''}
                error={phonebookVarError}
                aria-invalid={phonebookVarError || undefined}
                aria-describedby={phonebookVarError ? 'queue-varkey-error' : undefined}
                aria-label={t('routes.chain.source.selectVarKey', 'Поле с номером очереди')}
                onChange={(e) =>
                  onChange({
                    source: 'phonebook',
                    phonebookUid: src.phonebookUid,
                    varKey: e.target.value,
                  })
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
                  {t('routes.chain.source.varKeyRequired', 'Выберите поле с номером очереди')}
                </Text>
              ) : null}
              {src.phonebookUid > 0 && varKeys.length === 0 ? (
                <Text variant="muted" className={styles.fieldError}>
                  {t(
                    'routes.chain.source.noVarKeysHint',
                    'Добавьте переменные в записи справочника (например queue), затем вернитесь сюда.',
                  )}
                </Text>
              ) : null}
            </VStack>
          ) : null}
        </VStack>
      ) : null}
    </VStack>
  );
}
