import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Flex, Sheet, SheetContent, SheetHeader, SheetTitle, Table, Text, VStack } from '@/shared/ui';
import type { ColumnDef } from '@tanstack/react-table';
import type { IQueueStats } from '@/features/callcenter/model/types/callCenterSchema';
import type { SupervisorKpiPeriodMeta, SupervisorKpiRollup } from '@/features/callcenter/lib/supervisorKpiRollup';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import type { SupervisorMetric } from './SupervisorKpiStrip';
import styles from './SupervisorPulse.module.scss';

interface Props {
  metric: Exclude<SupervisorMetric, 'waiting'> | null;
  rollup: SupervisorKpiRollup;
  periodMeta: SupervisorKpiPeriodMeta;
  queues: readonly IQueueStats[];
  onClose: () => void;
  onHistory: () => void;
}

/** Read-only breakdown uses the same queue snapshots and weighted denominator as the overview. */
export function SupervisorMetricSheet({ metric, rollup, periodMeta, queues, onClose, onHistory }: Props) {
  const { t } = useTranslation();
  const period = periodMeta.mode === 'business_day'
    ? t('callcenter.supervisor.pulse.businessDay', { time: periodMeta.boundaryTime })
    : t('callcenter.supervisor.pulse.calendarDay');
  const title = metric === 'sla' ? 'SLA' : metric === 'answered'
    ? t('callcenter.supervisor.answered', 'Answered') : t('callcenter.supervisor.abandoned', 'Lost');
  const columns = useMemo<ColumnDef<IQueueStats>[]>(() => [
    { id: 'queue', header: t('callcenter.supervisor.queueOverview.title', 'Queue'), cell: ({ row }) => queueDisplayName(row.original.name, queues) },
    { id: 'value', header: title, cell: ({ row }) => metric === 'sla'
      ? (row.original.calls.total - (row.original.calls.shortAbandoned ?? 0) > 0 ? `${row.original.sla}%` : '—')
      : metric === 'answered' ? row.original.calls.answered : row.original.calls.abandoned },
    ...(metric === 'sla' ? [{ id: 'denominator', header: t('callcenter.supervisor.pulse.slaCount'),
      cell: ({ row }: { row: { original: IQueueStats } }) => Math.max(0, row.original.calls.total - (row.original.calls.shortAbandoned ?? 0)) }] : []),
  ], [t, title, metric, queues]);
  return <Sheet open={metric !== null} onOpenChange={value => { if (!value) onClose(); }}>
    <SheetContent side="right" aria-describedby={undefined} data-testid="supervisor-metric-sheet">
      <SheetHeader><SheetTitle>{title}</SheetTitle><Text variant="muted">{period} · {t('callcenter.supervisor.pulse.queueScope')}</Text></SheetHeader>
      <VStack gap="20" className={styles.detailBody}>
        <Text className={styles.detailValue}>{metric === 'sla'
          ? (rollup.period.effectiveOffered > 0 ? `${rollup.period.sla}%` : '—')
          : metric === 'answered' ? rollup.period.answered : rollup.period.abandoned}</Text>
        <Text variant="small">{t(`callcenter.supervisor.pulse.${metric === 'sla' ? 'slaDefinition' : metric === 'answered' ? 'answeredDefinition' : 'lostDefinition'}`)}</Text>
        {metric === 'sla' && <VStack gap="8" className={styles.formula}>
          <Flex justify="between" gap="12"><Text variant="small">{t('callcenter.supervisor.pulse.offered')}</Text><Text>{rollup.period.offered}</Text></Flex>
          <Flex justify="between" gap="12"><Text variant="small">{t('callcenter.supervisor.pulse.shortAbandoned')}</Text><Text>{rollup.period.offered - rollup.period.effectiveOffered}</Text></Flex>
          <Text variant="small">{t('callcenter.supervisor.pulse.slaSource', { count: rollup.period.effectiveOffered })}</Text>
        </VStack>}
        <VStack gap="8"><Text as="h3">{t('callcenter.supervisor.pulse.queueBreakdown')}</Text>
          <Table columns={columns} data={[...queues]} getRowId={queue => queue.name} surface={false} showSearch={false} showExport={false} />
        </VStack>
        <Button variant="outline" onClick={onHistory}>{t('callcenter.supervisor.pulse.history')}</Button>
      </VStack>
    </SheetContent>
  </Sheet>;
}
