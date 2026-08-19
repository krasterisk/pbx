import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import {
  DIALSTATUS_VALUES,
  QUEUESTATUS_VALUES,
  type ConditionSource,
  type DialstatusValue,
  type QueuestatusValue,
} from '@krasterisk/shared';
import { Button, Select, SegmentedControl, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import styles from './ConditionEditor.module.scss';

type Mode = 'simple' | 'expert';
type PresetId = 'no-answer' | 'busy' | 'queue-full' | '';

const PRESETS: Array<{ id: Exclude<PresetId, ''>; condition: ConditionSource }> = [
  { id: 'no-answer', condition: { source: 'dialstatus', values: ['NOANSWER'] } },
  { id: 'busy', condition: { source: 'dialstatus', values: ['BUSY'] } },
  { id: 'queue-full', condition: { source: 'queuestatus', values: ['FULL'] } },
];

function asCondition(value: ConditionSource | undefined): ConditionSource | undefined {
  if (!value?.source) return undefined;
  return value;
}

function matchPreset(value: ConditionSource | undefined): PresetId {
  if (!value) return '';
  const found = PRESETS.find((preset) => {
    if (preset.condition.source !== value.source) return false;
    if (preset.condition.source === 'dialstatus' && value.source === 'dialstatus') {
      return JSON.stringify(preset.condition.values) === JSON.stringify(value.values);
    }
    if (preset.condition.source === 'queuestatus' && value.source === 'queuestatus') {
      return JSON.stringify(preset.condition.values) === JSON.stringify(value.values);
    }
    return false;
  });
  return found?.id ?? '';
}

export interface ConditionEditorProps {
  value: ConditionSource | undefined;
  onChange: (next: ConditionSource | undefined) => void;
  readOnly?: boolean;
}

export function ConditionEditor({ value, onChange, readOnly }: ConditionEditorProps) {
  const { t } = useTranslation();
  const condition = asCondition(value);
  const [mode, setMode] = useState<Mode>('simple');
  const [hasRow, setHasRow] = useState(Boolean(condition));
  const preset = matchPreset(condition);

  const simpleOptions = useMemo(
    () => [
      { value: '', label: t('routes.chain.conditions.placeholder', 'Выберите условие') },
      { value: 'no-answer', label: t('routes.chain.conditions.preset.noAnswer', 'Не ответили') },
      { value: 'busy', label: t('routes.chain.conditions.preset.busy', 'Занято') },
      { value: 'queue-full', label: t('routes.chain.conditions.preset.queueFull', 'Очередь переполнена') },
    ],
    [t],
  );

  const applyPreset = (id: string) => {
    const found = PRESETS.find((presetItem) => presetItem.id === id);
    onChange(found ? { ...found.condition } : undefined);
  };

  const showZero = !hasRow && !condition;

  return (
    <VStack gap="12" max className={styles.root}>
      <SegmentedControl
        ariaLabel={t('routes.chain.conditions.mode', 'Режим условий')}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'simple', label: t('routes.chain.conditions.simple', 'Простой') },
          { value: 'expert', label: t('routes.chain.conditions.expert', 'Эксперт') },
        ]}
      />

      {showZero && mode === 'simple' ? (
        <VStack gap="8" max>
          <Text variant="small">{t('routes.chain.conditions.emptyTitle', 'Условий нет')}</Text>
          <Text variant="muted" className={styles.zero}>
            {t('routes.chain.conditions.emptyBody', 'Действие выполнится всегда')}
          </Text>
          <Button type="button" variant="outline" disabled={readOnly} onClick={() => setHasRow(true)}>
            {t('routes.chain.conditions.add', 'Добавить условие')}
          </Button>
        </VStack>
      ) : null}

      {mode === 'simple' && (hasRow || condition) ? (
        <HStack gap="8" align="center" className={styles.row}>
          <Select
            aria-label={t('routes.chain.conditions.placeholder', 'Выберите условие')}
            disabled={readOnly}
            value={preset}
            onChange={(e) => applyPreset(e.target.value)}
          >
            {simpleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="ghost"
            className={styles.remove}
            title={t('routes.chain.conditions.remove', 'Удалить условие')}
            aria-label={t('routes.chain.conditions.remove', 'Удалить условие')}
            disabled={readOnly}
            onClick={() => {
              setHasRow(false);
              onChange(undefined);
            }}
          >
            <X size={16} />
          </Button>
        </HStack>
      ) : null}

      {mode === 'expert' ? (
        <VStack gap="8" max>
          <Select
            aria-label={t('routes.chain.conditions.source', 'Источник')}
            disabled={readOnly}
            value={condition?.source ?? 'dialstatus'}
            onChange={(e) => {
              const source = e.target.value;
              if (source === 'queuestatus') {
                onChange({ source: 'queuestatus', values: condition?.source === 'queuestatus' ? condition.values : ['FULL'] });
              } else {
                onChange({
                  source: 'dialstatus',
                  values: condition?.source === 'dialstatus' ? condition.values : ['NOANSWER'],
                });
              }
            }}
          >
            <option value="dialstatus">{t('routes.chain.conditions.group.dial', 'Результат набора')}</option>
            <option value="queuestatus">{t('routes.chain.conditions.group.queue', 'Результат очереди')}</option>
          </Select>
          <Select
            aria-label={t('routes.chain.conditions.value', 'Значение')}
            disabled={readOnly}
            value={condition?.source === 'variable' || condition?.source === 'http_result' || condition?.source === 'device_state'
              ? ''
              : (condition?.values?.[0] ?? '')}
            onChange={(e) => {
              if (condition?.source === 'queuestatus') {
                onChange({ source: 'queuestatus', values: [e.target.value as QueuestatusValue] });
              } else {
                onChange({ source: 'dialstatus', values: [e.target.value as DialstatusValue] });
              }
            }}
          >
            {(condition?.source === 'queuestatus' ? QUEUESTATUS_VALUES : DIALSTATUS_VALUES).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </VStack>
      ) : null}
    </VStack>
  );
}
