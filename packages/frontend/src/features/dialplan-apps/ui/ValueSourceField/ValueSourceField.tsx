import { useTranslation } from 'react-i18next';
import type { ValueSource } from '@krasterisk/shared';
import { Input, Label, Select, SegmentedControl, Text, InfoTooltip } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
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

const SOURCE_ORDER = ['fixed', 'route_pattern', 'variable', 'phonebook'] as const;

function previewQueueName(src: ValueSource, uid: number): string {
  const raw =
    src.source === 'fixed'
      ? src.value
      : src.source === 'route_pattern'
        ? '${EXTEN}'
        : src.source === 'variable'
          ? `\${${src.name}}`
          : '${PB_RESULT}';
  return `q${raw}_${uid}`;
}

function asValueSource(value: ValueSource | undefined): ValueSource {
  return value ?? { source: 'fixed', value: '' };
}

export function ValueSourceField({
  value,
  onChange,
  tenantUid,
  label,
  hint,
  required,
  optionsSource,
  readOnly,
}: ValueSourceFieldProps) {
  const { t } = useTranslation();
  const src = asValueSource(value);
  const queuesQuery = useGetQueuesQuery(undefined, { skip: optionsSource !== 'queues' });
  const queues = queuesQuery.data ?? [];
  const isLoading = optionsSource === 'queues' && queuesQuery.isLoading;
  const isEmpty = optionsSource === 'queues' && !isLoading && queues.length === 0;
  const loadingLabel = t('routes.chain.catalog.loading', 'Загружаем список');
  const emptyLabel = t('routes.chain.catalog.empty', 'Ничего не создано');
  const sectionName = t('routes.chain.catalog.queuesSection', 'Очереди');

  return (
    <VStack gap="8" className={styles.field}>
      <HStack gap="4" align="center">
        <Label>
          {label}
          {required ? ' *' : ''}
        </Label>
        {hint ? <InfoTooltip text={hint} /> : null}
      </HStack>

      <SegmentedControl
        ariaLabel={t('routes.chain.source.aria', 'Источник значения')}
        value={src.source}
        onChange={(next) => {
          if (next === 'fixed') onChange({ source: 'fixed', value: src.source === 'fixed' ? src.value : '' });
          else if (next === 'route_pattern') onChange({ source: 'route_pattern' });
          else if (next === 'variable') onChange({ source: 'variable', name: src.source === 'variable' ? src.name : '' });
          else onChange({ source: 'phonebook', phonebookUid: src.source === 'phonebook' ? src.phonebookUid : 0 });
        }}
        options={SOURCE_ORDER.map((source) => ({
          value: source,
          label:
            source === 'fixed'
              ? t('routes.chain.source.fixed', 'Фиксированное значение')
              : source === 'route_pattern'
                ? t('routes.chain.source.routePattern', 'По маске маршрута')
                : source === 'variable'
                  ? t('routes.chain.source.variable', 'Из переменной')
                  : t('routes.chain.source.phonebook', 'Из справочника'),
        }))}
      />

      {src.source === 'route_pattern' ? (
        <HStack gap="4" align="center">
          <Text className={styles.chip}>{previewQueueName(src, tenantUid)}</Text>
          <InfoTooltip
            text={t(
              'routes.chain.source.normalizeHint',
              'Номер из маски приводится к внутреннему имени с учётом вашего тенанта',
            )}
          />
        </HStack>
      ) : null}

      {src.source === 'fixed' && optionsSource === 'queues' ? (
        <VStack gap="8">
          <Select
            disabled={readOnly || isLoading || isEmpty}
            value={src.source === 'fixed' ? src.value : ''}
            aria-label={isLoading ? loadingLabel : isEmpty ? emptyLabel : label}
            onChange={(e) => onChange({ source: 'fixed', value: e.target.value })}
          >
            <option value="">
              {isLoading ? loadingLabel : isEmpty ? emptyLabel : t('routes.apps.queue.selectQueue', 'Выберите очередь')}
            </option>
            {queues.map((q) => (
              <option key={q.name} value={q.exten || q.name}>
                {q.exten || q.name}
                {q.display_name ? ` - ${q.display_name}` : ''}
              </option>
            ))}
          </Select>
          {isEmpty ? (
            <VStack gap="4">
              <Text variant="muted" className={styles.emptyHint}>
                {t('routes.chain.catalog.emptyHint', 'Сначала создайте запись в разделе «{{section}}»').replace(
                  '{{section}}',
                  sectionName,
                )}
              </Text>
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
            </VStack>
          ) : null}
        </VStack>
      ) : null}

      {src.source === 'fixed' && optionsSource !== 'queues' ? (
        <Input
          value={src.value}
          disabled={readOnly}
          onChange={(e) => onChange({ source: 'fixed', value: e.target.value })}
        />
      ) : null}

      {src.source === 'variable' ? (
        <Input
          value={src.name}
          disabled={readOnly}
          placeholder={t('routes.chain.fields.variableName', 'Имя переменной')}
          onChange={(e) => onChange({ source: 'variable', name: e.target.value })}
        />
      ) : null}

      {src.source === 'phonebook' ? (
        <Input
          type="number"
          inputMode="numeric"
          value={src.phonebookUid || ''}
          disabled={readOnly}
          onChange={(e) => onChange({ source: 'phonebook', phonebookUid: Number(e.target.value) || 0 })}
        />
      ) : null}
    </VStack>
  );
}
