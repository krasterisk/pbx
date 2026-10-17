import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { AlertTriangle, Check } from 'lucide-react';
import { Button, Flex, Text, VStack } from '@/shared/ui';
import { CcMetricLabel } from '../CcMetricLabel/CcMetricLabel';
import type { ICall, IQueueStats } from '../../model/types/callCenterSchema';
import type { KpiThresholds } from '../../lib/kpiThresholds';
import { formatClock, longestWaitSec } from '../../lib/liveCallTiming';
import { queueTileMetrics } from '../../lib/queueTiles';
import { useNowTick } from '../../lib/useNowTick';
import type { QueueSlaTrend } from '../../lib/queueTrend';
import styles from './QueueTiles.module.scss';

export interface QueueTilesProps {
  layout?: 'cards' | 'compact';
  queues: readonly IQueueStats[];
  calls: readonly ICall[];
  thresholds: KpiThresholds;
  /** Whether the queue is part of the current page filter. */
  isQueueActive: (queueName: string) => boolean;
  queueLabel: (queueName: string) => string;
  onToggleQueue: (queueName: string) => void;
  /** SLA of the last half hour per queue (see `buildSlaTrends`); a queue without an entry shows no trend. */
  trends?: Readonly<Record<string, QueueSlaTrend>>;
}

/**
 * One tile per queue for the supervisor: longest wait (ticking) is the headline number, then SLA,
 * abandon rate, ASA/AHT and agent availability. Colours come from the tenant thresholds.
 * Selecting a tile filters the whole page.
 */
export const QueueTiles = memo(function QueueTiles({
  layout = 'cards',
  queues,
  calls,
  thresholds,
  isQueueActive,
  queueLabel,
  onToggleQueue,
  trends,
}: QueueTilesProps) {
  const { t } = useTranslation();
  const now = useNowTick();

  if (layout === 'compact') {
    return (
      <div className={styles.overview} data-testid="queue-overview">
        <div className={styles.overviewHeader}>
          <span>{t('callcenter.supervisor.queueOverview.queue', 'Queue')}</span>
          <CcMetricLabel metric="waiting">{t('callcenter.supervisor.queueOverview.waiting', 'Wait')}</CcMetricLabel>
          <CcMetricLabel metric="queueFree">{t('callcenter.supervisor.queueOverview.ready', 'Ready')}</CcMetricLabel>
          <CcMetricLabel metric="sla">SLA</CcMetricLabel>
        </div>
        {queues.map((queue) => {
          const m = queueTileMetrics(queue, longestWaitSec(calls, now, queue.name), thresholds);
          const selected = isQueueActive(queue.name);
          return <Button
            key={queue.name}
            type="button"
            variant="unstyled"
            size="none"
            aria-pressed={selected}
            className={clsx(styles.overviewRow, selected && styles.overviewSelected)}
            onClick={() => onToggleQueue(queue.name)}
            data-testid={`queue-overview-${queue.name}`}
          >
            <span className={styles.overviewName}>
              <span className={styles.overviewTitle} title={queueLabel(queue.name)}>{selected && <Check size={12} aria-hidden="true" />}{queueLabel(queue.name)}</span>
              <span className={clsx(styles.overviewWait, styles[`tone_${m.waitTone}`])}>
                {m.waitTone === 'destructive' && <><AlertTriangle size={10} aria-hidden="true" /><span className="sr-only">{t('callcenter.supervisor.queueOverview.waitExceeded', 'Wait limit exceeded')} </span></>}
                {t('callcenter.supervisor.queueOverview.longest', 'Max wait')} {formatClock(m.longestWaitSec)}
              </span>
            </span>
            <span><span className="sr-only">{t('callcenter.supervisor.queueOverview.waiting', 'Wait')} </span>{queue.waiting}</span>
            <span><span className="sr-only">{t('callcenter.supervisor.queueOverview.ready', 'Ready')} </span>{queue.agents.available}</span>
            <span className={styles[`tone_${m.slaTone}`]}><span className="sr-only">SLA </span>{m.hasTraffic ? `${m.sla}%` : '—'}</span>
          </Button>;
        })}
      </div>
    );
  }

  return (
    <Flex wrap="wrap" gap="12" align="stretch" className={styles.grid} data-testid="queue-tiles">
      {queues.map((queue) => {
        const m = queueTileMetrics(queue, longestWaitSec(calls, now, queue.name), thresholds);
        const selected = isQueueActive(queue.name);
        return (
          <VStack
            key={queue.name}
            gap="8"
            role="button"
            tabIndex={0}
            className={clsx(styles.tile, selected && styles.selected)}
            aria-pressed={selected}
            onClick={() => onToggleQueue(queue.name)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggleQueue(queue.name);
              }
            }}
            data-testid={`queue-tile-${queue.name}`}
          >
            <Flex align="center" justify="between" gap="8" className={styles.head}>
              <Text variant="large" className={styles.name}>{queueLabel(queue.name)}</Text>
              <Text as="span" variant="xs" data-testid={`queue-tile-waiting-${queue.name}`}>
                {t('callcenter.supervisor.queueTile.waiting', { defaultValue: 'In queue: {{count}}', count: queue.waiting })}
              </Text>
            </Flex>

            <VStack gap="2" className={styles.headline}>
              <Text
                as="span"
                className={clsx(styles.longest, styles[`tone_${m.waitTone}`])}
                data-testid={`queue-tile-longest-${queue.name}`}
                data-tone={m.waitTone}
              >
                {formatClock(m.longestWaitSec)}
              </Text>
              <Text variant="xs">{t('callcenter.supervisor.queueTile.longestWait', 'Longest wait')}</Text>
            </VStack>

            <Flex gap="16" wrap="wrap" align="start" className={styles.metrics}>
              <Metric
                label="SLA"
                value={m.hasTraffic ? `${m.sla}%` : '—'}
                tone={m.slaTone}
                testId={`queue-tile-sla-${queue.name}`}
              />
              <Metric
                label={t('callcenter.supervisor.queueTile.abandon', 'Abandon')}
                value={m.hasTraffic ? `${m.abandonPct}%` : '—'}
                tone={m.abandonTone}
                testId={`queue-tile-abandon-${queue.name}`}
              />
              <Metric label="ASA" value={formatClock(m.asaSec)} tone="default" />
              <Metric label="AHT" value={formatClock(m.ahtSec)} tone="default" />
            </Flex>

            {trends?.[queue.name] && (
              <Text
                variant="xs"
                className={clsx(styles.trend, styles[`trend_${trends[queue.name].direction}`])}
                data-testid={`queue-tile-trend-${queue.name}`}
                data-direction={trends[queue.name].direction}
              >
                {trends[queue.name].delta === null
                  ? t('callcenter.supervisor.queueTile.trendLevel', {
                      defaultValue: 'Last 30 min: {{sla}}%',
                      sla: trends[queue.name].sla,
                    })
                  : t('callcenter.supervisor.queueTile.trend', {
                      defaultValue: 'Last 30 min: {{sla}}% ({{delta}} pp)',
                      sla: trends[queue.name].sla,
                      delta: `${(trends[queue.name].delta as number) > 0 ? '+' : ''}${trends[queue.name].delta}`,
                    })}
              </Text>
            )}

            <Text variant="xs" data-testid={`queue-tile-agents-${queue.name}`}>
              {t('callcenter.supervisor.queueTile.agents', {
                defaultValue: 'Ready {{ready}} · busy {{busy}} · paused {{paused}}',
                ready: queue.agents.available,
                busy: queue.agents.busy,
                paused: queue.agents.paused,
              })}
            </Text>
          </VStack>
        );
      })}
    </Flex>
  );
});

function Metric({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'destructive' | 'default';
  testId?: string;
}) {
  return (
    <VStack gap="2" className={styles.metric}>
      <Text as="span" variant="small" className={clsx(styles.metricValue, styles[`tone_${tone}`])} data-testid={testId} data-tone={tone}>
        {value}
      </Text>
      <Text as="span" variant="xs"><CcMetricLabel metric={label === 'SLA' ? 'sla' : label === 'ASA' ? 'asa' : label === 'AHT' ? 'aht' : 'abandon'}>{label}</CcMetricLabel></Text>
    </VStack>
  );
}
