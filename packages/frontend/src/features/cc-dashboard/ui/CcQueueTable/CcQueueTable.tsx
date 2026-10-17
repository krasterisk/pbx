import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import type { ColumnDef } from '@tanstack/react-table';
import type { CcDashboardQueueRow, CcServiceKpis } from '@krasterisk/shared';
import { DataTable, Flex, Text } from '@/shared/ui';
import { abandonTone, slaTone, type KpiThresholds, type KpiTone } from '@/features/callcenter/lib/kpiThresholds';
import { formatClock } from '@/features/callcenter/lib/liveCallTiming';
import { kpiDelta, signed } from '../../lib/kpiDelta';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import styles from './CcQueueTable.module.scss';

export interface CcQueueTableProps {
  rows: readonly CcDashboardQueueRow[];
  thresholds: KpiThresholds;
  onOpenQueue: (queueName: string) => void;
}

/** Short abandons do not count towards the verdict: a queue with only those has no SLA yet. */
const hasVerdict = (k: CcServiceKpis): boolean => k.offered - k.shortAbandoned > 0;

function Tone({ tone, testId, children }: { tone: KpiTone; testId: string; children: string }) {
  return (
    <Text as="span" className={clsx(styles.cell, styles[`tone_${tone}`])} data-testid={testId} data-tone={tone}>
      {children}
    </Text>
  );
}

/** Queues, worst service first (the server sorts), with the change in SLA versus the previous period. */
export const CcQueueTable = memo(function CcQueueTable({ rows, thresholds, onOpenQueue }: CcQueueTableProps) {
  const { t } = useTranslation();
  const points = t('callcenter.dashboard.unit.points', 'pp');

  const columns = useMemo<ColumnDef<CcDashboardQueueRow>[]>(
    () => [
      {
        id: 'queue',
        header: t('callcenter.dashboard.queues.queue', 'Queue'),
        enableSorting: false,
        cell: ({ row }) => <Text as="span" className={styles.name}>{queueDisplayName(row.original.queueName, [])}</Text>,
      },
      {
        id: 'offered',
        header: t('callcenter.dashboard.queues.offered', 'Offered'),
        enableSorting: false,
        cell: ({ row }) => (
          <Text as="span" className={styles.cell}>
            {row.original.current.offered}
            {row.original.current.shortAbandoned > 0 ? ` (${row.original.current.shortAbandoned})` : ''}
          </Text>
        ),
      },
      {
        id: 'sla',
        header: 'SLA',
        enableSorting: false,
        cell: ({ row }) => {
          const k = row.original.current;
          if (!hasVerdict(k)) return <Text as="span" className={styles.cell}>—</Text>;
          const delta = row.original.previous && hasVerdict(row.original.previous)
            ? kpiDelta(k.sla, row.original.previous.sla, 'higherIsBetter')
            : null;
          return (
            <Flex align="center" gap="4" wrap="wrap">
              <Tone tone={slaTone(k.sla, thresholds)} testId={`cc-queue-sla-${row.original.queueName}`}>{`${k.sla}%`}</Tone>
              {delta && delta.trend !== 'flat' && (
                <Text
                  as="span"
                  variant="xs"
                  className={styles[`delta_${delta.tone}`]}
                  data-testid={`cc-queue-sla-delta-${row.original.queueName}`}
                >
                  {`${signed(delta.abs)} ${points}`}
                </Text>
              )}
            </Flex>
          );
        },
      },
      {
        id: 'abandon',
        header: t('callcenter.dashboard.queues.abandon', 'Abandon'),
        enableSorting: false,
        cell: ({ row }) => {
          const k = row.original.current;
          if (!hasVerdict(k)) return <Text as="span" className={styles.cell}>—</Text>;
          return (
            <Tone tone={abandonTone(k.abandoned, k.offered - k.shortAbandoned, thresholds)} testId={`cc-queue-abandon-${row.original.queueName}`}>
              {`${k.abandonRate}%`}
            </Tone>
          );
        },
      },
      {
        id: 'asa',
        header: 'ASA',
        enableSorting: false,
        cell: ({ row }) => <Text as="span" className={styles.cell}>{row.original.current.handled > 0 ? formatClock(row.original.current.asa) : '—'}</Text>,
      },
      {
        id: 'aht',
        header: 'AHT',
        enableSorting: false,
        cell: ({ row }) => <Text as="span" className={styles.cell}>{row.original.current.handled > 0 ? formatClock(row.original.current.aht) : '—'}</Text>,
      },
    ],
    [t, thresholds, points],
  );

  return (
    <DataTable<CcDashboardQueueRow>
      data={[...rows]}
      columns={columns}
      getRowId={(row) => row.queueName}
      showSearch={false}
      showExport={false}
      surface={false}
      pageSize={50}
      emptyText={t('callcenter.dashboard.queues.empty', 'No queue calls in this period')}
      onRowClick={(row) => onOpenQueue(row.queueName)}
      getRowAriaLabel={(row) => row.queueName}
      getRowTestId={(row) => `cc-queue-row-${row.queueName}`}
    />
  );
});
