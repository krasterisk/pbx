import { useTranslation } from 'react-i18next';
import type { ITimeGroupInterval } from '@krasterisk/shared';
import { Button, Input, Label, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { Plus, Trash2 } from 'lucide-react';
import type { FieldSchema } from '../schema.types';
import styles from './schedule.module.scss';

const EMPTY_INTERVAL: ITimeGroupInterval = {
  time_start: '09:00',
  time_end: '18:00',
  days_of_week: 'mon-fri',
  days_of_month: '*',
  months: '*',
};

type TFn = (key: string, fallback?: string) => string;

export function summarizeSchedule(params: Record<string, unknown>, t: TFn): string {
  const intervals = Array.isArray(params.intervals) ? params.intervals : [];
  if (!intervals.length) return t('routes.chain.schedule.summaryEmpty', 'Расписание без интервалов');
  return t('routes.chain.schedule.summary', 'Расписание: {{count}} интервал(ов)')
    .replace('{{count}}', String(intervals.length));
}

export function buildScheduleSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'intervals',
      kind: 'custom',
      required: true,
      labelKey: 'routes.chain.schedule.intervals',
      label: t('routes.chain.schedule.intervals', 'Интервалы'),
      render: ({ params, onChange, readOnly }) => (
        <ScheduleIntervalsEditor
          intervals={Array.isArray(params.intervals) ? params.intervals as ITimeGroupInterval[] : []}
          readOnly={readOnly}
          onChange={(intervals) => onChange({ intervals })}
        />
      ),
    },
  ];
}

function ScheduleIntervalsEditor({
  intervals,
  onChange,
  readOnly,
}: {
  intervals: ITimeGroupInterval[];
  onChange: (intervals: ITimeGroupInterval[]) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const update = (index: number, patch: Partial<ITimeGroupInterval>) => {
    onChange(intervals.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <VStack gap="12" max>
      <Text variant="muted">
        {t(
          'routes.chain.schedule.hint',
          'Те же интервалы, что у временных групп маршрута: время, дни недели, дни месяца, месяцы',
        )}
      </Text>
      {intervals.map((interval, index) => (
        <VStack key={index} gap="8" className={styles.interval}>
          <HStack justify="between" align="center">
            <Text>{t('routes.chain.schedule.interval', 'Интервал')} {index + 1}</Text>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={readOnly}
              aria-label={t('routes.chain.schedule.remove', 'Удалить интервал')}
              onClick={() => onChange(intervals.filter((_, i) => i !== index))}
            >
              <Trash2 size={16} />
            </Button>
          </HStack>
          <HStack gap="8" align="center">
            <Label htmlFor={`sched-from-${index}`}>{t('routes.chain.schedule.from', 'С')}</Label>
            <Input
              id={`sched-from-${index}`}
              type="time"
              value={interval.time_start}
              disabled={readOnly}
              onChange={(e) => update(index, { time_start: e.target.value })}
            />
            <Label htmlFor={`sched-to-${index}`}>{t('routes.chain.schedule.to', 'По')}</Label>
            <Input
              id={`sched-to-${index}`}
              type="time"
              value={interval.time_end}
              disabled={readOnly}
              onChange={(e) => update(index, { time_end: e.target.value })}
            />
          </HStack>
          <Label htmlFor={`sched-dow-${index}`}>{t('routes.chain.schedule.dow', 'Дни недели')}</Label>
          <Input
            id={`sched-dow-${index}`}
            value={interval.days_of_week}
            disabled={readOnly}
            onChange={(e) => update(index, { days_of_week: e.target.value })}
          />
          <Label htmlFor={`sched-dom-${index}`}>{t('routes.chain.schedule.dom', 'Дни месяца')}</Label>
          <Input
            id={`sched-dom-${index}`}
            value={interval.days_of_month}
            disabled={readOnly}
            onChange={(e) => update(index, { days_of_month: e.target.value })}
          />
          <Label htmlFor={`sched-months-${index}`}>{t('routes.chain.schedule.months', 'Месяцы')}</Label>
          <Input
            id={`sched-months-${index}`}
            value={interval.months}
            disabled={readOnly}
            onChange={(e) => update(index, { months: e.target.value })}
          />
        </VStack>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={readOnly}
        onClick={() => onChange([...intervals, { ...EMPTY_INTERVAL }])}
      >
        <Plus size={16} />
        {t('routes.chain.schedule.add', 'Добавить интервал')}
      </Button>
    </VStack>
  );
}