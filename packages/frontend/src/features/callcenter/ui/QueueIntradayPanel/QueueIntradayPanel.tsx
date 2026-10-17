import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Flex, SegmentedControl, Skeleton, Text, VStack } from '@/shared/ui';
import {
  useGetQueueIntervalsQuery,
  type QueueIntervalGranularity,
  type QueueIntervalsParams,
} from '@/shared/api/endpoints/callCenterReportsApi';
import {
  buildIntradayChartData,
  formatIntervalLabel,
  hasIntradayTraffic,
  summarizeIntraday,
} from '../../lib/intradayChartData';
import { IntradayChart } from '../IntradayChart';
import styles from './QueueIntradayPanel.module.scss';

/** The backend refreshes the open buckets every minute - polling faster only repeats the same answer. */
export const INTRADAY_POLL_MS = 60_000;

type GranularityKey = '15' | '30' | '60';
const GRANULARITIES: readonly GranularityKey[] = ['15', '30', '60'];

export interface QueueIntradayPanelProps {
  /** Single queue to chart; omit for all queues of the tenant. */
  queueName?: string;
  /** Display name of `queueName` (falls back to the name itself). */
  queueLabel?: string;
}

/**
 * "How is today going" for the supervisor: calls per 15/30/60 minutes in the tenant timezone, running
 * service level, busiest interval, and the same weekday last week as a pacing reference.
 */
export const QueueIntradayPanel = memo(function QueueIntradayPanel({ queueName, queueLabel }: QueueIntradayPanelProps) {
  const { t } = useTranslation();
  const [granularity, setGranularity] = useState<GranularityKey>('30');
  const [compare, setCompare] = useState(false);

  const params = useMemo<QueueIntervalsParams>(() => {
    const p: QueueIntervalsParams = { granularityMin: Number(granularity) as QueueIntervalGranularity };
    if (queueName) p.queueName = queueName;
    if (compare) p.compare = 'weekAgo';
    return p;
  }, [granularity, queueName, compare]);

  const { data, isLoading, isError, refetch } = useGetQueueIntervalsQuery(params, {
    pollingInterval: INTRADAY_POLL_MS,
    skipPollingIfUnfocused: true,
  });

  const points = useMemo(() => buildIntradayChartData(data), [data]);
  const summary = useMemo(() => summarizeIntraday(data?.rows), [data]);
  const hasTraffic = hasIntradayTraffic(data?.rows);

  const options = GRANULARITIES.map((value) => ({
    value,
    label: t('callcenter.supervisor.intraday.minutes', { defaultValue: '{{minutes}} min', minutes: Number(value) }),
  }));

  const chartLabels = {
    chart: t('callcenter.supervisor.intraday.chartLabel', 'Calls and service level by time of day'),
    answered: t('callcenter.supervisor.intraday.answered', 'Handled'),
    abandoned: t('callcenter.supervisor.intraday.abandoned', 'Abandoned'),
    shortAbandoned: t('callcenter.supervisor.intraday.shortAbandoned', 'Short abandon'),
    sla: t('callcenter.supervisor.intraday.sla', 'Service level (running)'),
    previousOffered: t('callcenter.supervisor.intraday.previousOffered', 'Offered a week ago'),
  };

  return (
    <VStack gap="12" className={styles.panel} data-testid="queue-intraday-panel">
      <Flex align="center" justify="between" gap="12" wrap="wrap">
        <VStack gap="2">
          <Text variant="large">
            {t('callcenter.supervisor.intraday.title', 'Today by time of day')}
            {queueName ? ` · ${queueLabel ?? queueName}` : ''}
          </Text>
          {data && hasTraffic && (
            <Text variant="xs" data-testid="intraday-summary">
              {t('callcenter.supervisor.intraday.summary', {
                defaultValue: 'Offered {{offered}} · handled {{answered}} · abandoned {{abandoned}}',
                offered: summary.offered,
                answered: summary.answered,
                abandoned: summary.abandoned,
              })}
              {summary.sla !== null ? ` · SLA ${summary.sla}%` : ''}
              {summary.peak
                ? ` · ${t('callcenter.supervisor.intraday.peak', {
                    defaultValue: 'peak {{time}} ({{calls}})',
                    time: formatIntervalLabel(summary.peak.at, data.timezone),
                    calls: summary.peak.offered,
                  })}`
                : ''}
            </Text>
          )}
        </VStack>
        <Flex align="center" gap="8" wrap="wrap">
          <SegmentedControl
            options={options}
            value={granularity}
            onChange={setGranularity}
            ariaLabel={t('callcenter.supervisor.intraday.granularity', 'Interval length')}
          />
          <Button
            variant={compare ? 'default' : 'outline'}
            size="sm"
            aria-pressed={compare}
            onClick={() => setCompare((prev) => !prev)}
            data-testid="intraday-compare"
          >
            {t('callcenter.supervisor.intraday.compare', 'vs. last week')}
          </Button>
        </Flex>
      </Flex>

      {isLoading && <Skeleton className="h-[220px] w-full" />}

      {isError && !data && (
        <Flex align="center" gap="12" wrap="wrap" data-testid="intraday-error">
          <Text variant="error">{t('callcenter.supervisor.intraday.error', 'Could not load the intraday series')}</Text>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t('common.retry', 'Retry')}
          </Button>
        </Flex>
      )}

      {data && !hasTraffic && (
        <Text variant="muted" data-testid="intraday-empty">
          {t('callcenter.supervisor.intraday.empty', 'No queue calls yet today')}
        </Text>
      )}

      {data && hasTraffic && <IntradayChart points={points} labels={chartLabels} showPrevious={compare} />}
    </VStack>
  );
});
