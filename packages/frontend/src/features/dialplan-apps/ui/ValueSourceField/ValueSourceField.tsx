import { useTranslation } from 'react-i18next';
import type { ValueSource } from '@krasterisk/shared';
import { Input, Label, Select, Text } from '@/shared/ui';
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
}

const SRC_ROUTE = '__src:route_pattern';
const SRC_VARIABLE = '__src:variable';
const SRC_PHONEBOOK = '__src:phonebook';

export function isValueSourceComplete(value: ValueSource | undefined): boolean {
  if (!value) return false;
  if (value.source === 'fixed') return value.value.trim().length > 0;
  if (value.source === 'route_pattern') return true;
  if (value.source === 'variable') return value.name.trim().length > 0;
  return Number.isInteger(value.phonebookUid) && value.phonebookUid > 0;
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
  required,
  optionsSource,
  readOnly,
}: ValueSourceFieldProps) {
  const { t } = useTranslation();
  const src = asValueSource(value);
  const queuesQuery = useGetQueuesQuery(undefined, { skip: optionsSource !== 'queues' });
  const phonebooksQuery = useGetPhonebooksQuery(undefined, { skip: src.source !== 'phonebook' });
  const queues = queuesQuery.data ?? [];
  const phonebooks = phonebooksQuery.data ?? [];
  const isLoading = optionsSource === 'queues' && queuesQuery.isLoading;
  const isEmpty = optionsSource === 'queues' && !isLoading && queues.length === 0;
  const complete = isValueSourceComplete(src);
  const loadingLabel = t('routes.chain.catalog.loading', 'Загружаем список');
  const emptyLabel = t('routes.chain.catalog.empty', 'Нет очередей');
  const sectionName = t('routes.chain.catalog.queuesSection', 'Очереди');
  const placeholder = isLoading
    ? loadingLabel
    : isEmpty
      ? emptyLabel
      : t('routes.apps.queue.selectQueue', 'Выберите очередь');

  const handleSelect = (raw: string) => {
    if (raw === SRC_ROUTE) onChange({ source: 'route_pattern' });
    else if (raw === SRC_VARIABLE) {
      onChange({ source: 'variable', name: src.source === 'variable' ? src.name : '' });
    } else if (raw === SRC_PHONEBOOK) {
      onChange({
        source: 'phonebook',
        phonebookUid: src.source === 'phonebook' ? src.phonebookUid : 0,
      });
    } else {
      onChange({ source: 'fixed', value: raw });
    }
  };

  return (
    <VStack gap="8" className={styles.field}>
      <HStack gap="4" align="center">
        <Label>
          {label}
          {required ? ' *' : ''}
        </Label>
      </HStack>

      {optionsSource === 'queues' ? (
        <VStack gap="8">
          <Select
            disabled={readOnly || isLoading}
            value={selectValue(src)}
            error={required && !complete && !isLoading}
            aria-label={isLoading ? loadingLabel : isEmpty ? emptyLabel : label}
            onChange={(e) => handleSelect(e.target.value)}
          >
            <option value="">{placeholder}</option>
            {queues.map((q) => (
              <option key={q.name} value={q.exten || q.name}>
                {q.exten || q.name}
                {q.display_name ? ` - ${q.display_name}` : ''}
              </option>
            ))}
            <option value={SRC_ROUTE}>
              {t('routes.chain.source.routePattern', 'По маске маршрута (exten)')}
            </option>
            <option value={SRC_VARIABLE}>
              {t('routes.chain.source.variable', 'Из переменной')}
            </option>
            <option value={SRC_PHONEBOOK}>
              {t('routes.chain.source.phonebook', 'Из справочника')}
            </option>
          </Select>
          {required && !complete && !isLoading ? (
            <Text variant="muted" className={styles.emptyHint}>
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
        <Input
          value={src.name}
          disabled={readOnly}
          placeholder={t('routes.chain.fields.variableName', 'Имя переменной')}
          aria-label={t('routes.chain.fields.variableName', 'Имя переменной')}
          onChange={(e) => onChange({ source: 'variable', name: e.target.value })}
        />
      ) : null}

      {src.source === 'phonebook' ? (
        <Select
          disabled={readOnly || phonebooksQuery.isLoading}
          value={src.phonebookUid ? String(src.phonebookUid) : ''}
          aria-label={t('routes.chain.source.phonebook', 'Из справочника')}
          onChange={(e) =>
            onChange({ source: 'phonebook', phonebookUid: Number(e.target.value) || 0 })
          }
        >
          <option value="">
            {t('routes.chain.source.selectPhonebook', 'Выберите справочник')}
          </option>
          {phonebooks.map((pb) => (
            <option key={pb.uid} value={String(pb.uid)}>
              {pb.name}
            </option>
          ))}
        </Select>
      ) : null}
    </VStack>
  );
}
