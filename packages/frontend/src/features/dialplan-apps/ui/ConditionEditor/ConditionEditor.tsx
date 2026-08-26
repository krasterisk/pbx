import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DIALSTATUS_VALUES,
  QUEUESTATUS_VALUES,
  type ConditionSource,
  type DialstatusValue,
  type IRouteActionCondition,
  type QueuestatusValue,
} from '@krasterisk/shared';
import { InfoTooltip, Label, MultiSelect, type MultiSelectOption } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { toConditionSource, toRouteCondition } from '../../model/conditionMap';
import { TimeGroupSelect } from '../TimeGroupSelect';
import styles from './ConditionEditor.module.scss';

const DIAL_PREFIX = 'dial:';
const QUEUE_PREFIX = 'queue:';

const DIAL_LABELS: Record<string, string> = {
  CHANUNAVAIL: 'Недоступен',
  CONGESTION: 'Перегрузка',
  BUSY: 'Занято',
  NOANSWER: 'Не отвечает',
  ANSWER: 'Ответили',
  CANCEL: 'Отмена',
  DONTCALL: 'Не звонить',
  TORTURE: 'Torture',
  INVALIDARGS: 'Неверные аргументы',
};

const QUEUE_LABELS: Record<string, string> = {
  TIMEOUT: 'Таймаут очереди',
  FULL: 'Очередь переполнена',
  JOINEMPTY: 'Нет операторов при входе',
  LEAVEEMPTY: 'Не осталось операторов',
  CONTINUE: 'Продолжить',
};

function encodeDial(value: string) {
  return `${DIAL_PREFIX}${value}`;
}

function encodeQueue(value: string) {
  return `${QUEUE_PREFIX}${value}`;
}

export function sourceToSelection(source: ConditionSource | undefined): string[] {
  if (!source) return [];
  if (source.source === 'dialstatus') return source.values.map(encodeDial);
  if (source.source === 'queuestatus') return source.values.map(encodeQueue);
  return [];
}

/** Keep a single source group; prefer the group of the last newly added value. */
export function selectionToSource(
  values: string[],
  previous: string[],
): ConditionSource | undefined {
  if (!values.length) return undefined;

  const added = values.filter((item) => !previous.includes(item));
  const pivot = added[added.length - 1] ?? values[values.length - 1];
  const preferQueue = pivot.startsWith(QUEUE_PREFIX);
  const filtered = values.filter((item) =>
    (preferQueue ? item.startsWith(QUEUE_PREFIX) : item.startsWith(DIAL_PREFIX)),
  );

  if (!filtered.length) return undefined;

  if (preferQueue) {
    return {
      source: 'queuestatus',
      values: filtered.map((item) => item.slice(QUEUE_PREFIX.length) as QueuestatusValue),
    };
  }

  return {
    source: 'dialstatus',
    values: filtered.map((item) => item.slice(DIAL_PREFIX.length) as DialstatusValue),
  };
}

export interface ConditionEditorProps {
  /** Full step condition (status source + optional time group). */
  condition?: IRouteActionCondition;
  onChange: (next: IRouteActionCondition) => void;
  readOnly?: boolean;
}

export function ConditionEditor({ condition, onChange, readOnly }: ConditionEditorProps) {
  const { t } = useTranslation();
  const source = toConditionSource(condition);
  const [selection, setSelection] = useState(() => sourceToSelection(source));

  useEffect(() => {
    setSelection(sourceToSelection(toConditionSource(condition)));
  }, [condition]);

  const options: MultiSelectOption[] = useMemo(() => {
    const dialOpts = DIALSTATUS_VALUES.map((value) => ({
      value: encodeDial(value),
      label: t(
        `routes.chain.conditions.dial.${value.toLowerCase()}`,
        `${DIAL_LABELS[value] ?? value} (набор)`,
      ),
    }));
    const queueOpts = QUEUESTATUS_VALUES.map((value) => ({
      value: encodeQueue(value),
      label: t(
        `routes.chain.conditions.queue.${value.toLowerCase()}`,
        `${QUEUE_LABELS[value] ?? value} (очередь)`,
      ),
    }));
    return [...dialOpts, ...queueOpts];
  }, [t]);

  const handleStatusesChange = (nextEncoded: string[]) => {
    if (readOnly) return;
    const nextSource = selectionToSource(nextEncoded, selection);
    const normalized = sourceToSelection(nextSource);
    setSelection(normalized);
    const base = toRouteCondition(nextSource);
    onChange({
      ...base,
      ...(condition?.time_group_uid != null
        ? { time_group_uid: condition.time_group_uid }
        : {}),
    });
  };

  const handleTimeGroupChange = (uid: number | undefined) => {
    if (readOnly) return;
    const base = toRouteCondition(source);
    if (uid == null) {
      const next: IRouteActionCondition = { ...condition, ...base };
      delete next.time_group_uid;
      onChange(next);
      return;
    }
    onChange({ ...condition, ...base, time_group_uid: uid });
  };

  return (
    <VStack gap="12" max className={styles.root}>
      <VStack gap="8" max className={styles.field}>
        <HStack gap="4" align="center">
          <Label className={styles.fieldLabel}>
            {t('routes.chain.conditions.statusLabel', 'Результат предыдущего шага')}
          </Label>
          <InfoTooltip
            text={t(
              'routes.chain.conditions.statusHint',
              'Можно выбрать несколько статусов одного типа.\n**Набор** и **очередь** не смешиваются: при выборе другого типа предыдущие снимаются.\nБез условия шаг выполняется всегда.',
            )}
          />
        </HStack>
        <MultiSelect
          value={selection}
          onChange={handleStatusesChange}
          options={options}
          placeholder={t('routes.chain.conditions.placeholder', 'Выберите условие')}
        />
      </VStack>

      <VStack gap="8" max className={styles.field}>
        <HStack gap="4" align="center">
          <Label className={styles.fieldLabel}>
            {t('routes.chain.conditions.scheduleLabel', 'Расписание (группа времени)')}
          </Label>
          <InfoTooltip
            text={t(
              'routes.chain.conditions.scheduleHint',
              'Шаг выполнится только в рамках выбранной группы времени.\n**Всегда** - без ограничения по расписанию.',
            )}
          />
        </HStack>
        <TimeGroupSelect
          value={condition?.time_group_uid}
          onChange={handleTimeGroupChange}
          showHint={false}
        />
      </VStack>
    </VStack>
  );
}
