import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { CcDashboardLosses } from '@krasterisk/shared';
import { Flex, Text, VStack } from '@/shared/ui';
import { Progress } from '@/shared/ui/Progress/Progress';
import { buildLossesView, type WaitBucketId } from '../../lib/lossesView';
import { formatDelta } from '../../lib/kpiCards';
import styles from './CcLossesPanel.module.scss';

export interface CcLossesPanelProps {
  losses: CcDashboardLosses;
  /** Whether the user asked for a comparison (changes the "no comparison" wording). */
  compare: boolean;
}

const BUCKET_LABEL: Record<WaitBucketId, [string, string]> = {
  upTo5: ['callcenter.dashboard.losses.bucket.upTo5', 'Up to 5 s'],
  upTo20: ['callcenter.dashboard.losses.bucket.upTo20', '5-20 s'],
  upTo60: ['callcenter.dashboard.losses.bucket.upTo60', '20-60 s'],
  over60: ['callcenter.dashboard.losses.bucket.over60', 'Over 60 s'],
};

const TREND_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

function Stat({ label, value, tone = 'default', testId }: { label: string; value: string; tone?: 'default' | 'warning' | 'success'; testId: string }) {
  return (
    <VStack gap="2" className={styles.stat}>
      <Text as="span" className={clsx(styles.value, styles[`tone_${tone}`])} data-testid={testId} data-tone={tone}>
        {value}
      </Text>
      <Text as="span" variant="xs">{label}</Text>
    </VStack>
  );
}

const pct = (value: number | null): string => (value === null ? '—' : `${value}%`);

/**
 * Lost calls: how many, how many were called back in time, what is still waiting for a callback,
 * and when callers give up. Read-only; every lost call is in exactly one of three states.
 */
export const CcLossesPanel = memo(function CcLossesPanel({ losses, compare }: CcLossesPanelProps) {
  const { t } = useTranslation();
  const view = buildLossesView(losses);
  const TrendIcon = view.delta ? TREND_ICON[view.delta.trend] : null;

  if (view.total === 0) {
    return (
      <Text variant="muted" data-testid="cc-losses-empty">
        {t('callcenter.dashboard.losses.empty', 'No lost calls in this period')}
      </Text>
    );
  }

  return (
    <VStack gap="12" data-testid="cc-losses">
      <Flex wrap="wrap" gap="24" align="start">
        <VStack gap="2" className={styles.stat}>
          <Text as="span" className={styles.value} data-testid="cc-losses-total">{String(view.total)}</Text>
          <Text as="span" variant="xs">{t('callcenter.dashboard.losses.total', 'Lost calls')}</Text>
          {view.delta && TrendIcon ? (
            <Flex align="center" gap="2" className={clsx(styles.delta, styles[`delta_${view.delta.tone}`])} data-testid="cc-losses-delta" data-tone={view.delta.tone}>
              <TrendIcon size={12} aria-hidden="true" />
              <Text as="span" variant="xs">{formatDelta(view.delta, 'relative', '')}</Text>
            </Flex>
          ) : (
            <Text as="span" variant="xs" data-testid="cc-losses-nocompare">
              {compare ? t('callcenter.dashboard.kpi.noData', 'No data to compare') : t('callcenter.dashboard.kpi.compareOff', 'Comparison is off')}
            </Text>
          )}
        </VStack>
        <Stat label={t('callcenter.dashboard.losses.back15', 'Called back in 15 min')} value={pct(view.within15Pct)} testId="cc-losses-15" />
        <Stat label={t('callcenter.dashboard.losses.back60', 'Called back in 60 min')} value={pct(view.within60Pct)} testId="cc-losses-60" />
        <Stat label={t('callcenter.dashboard.losses.byClient', 'Client called back')} value={String(view.clientCalledBack)} testId="cc-losses-client" />
        <Stat
          label={t('callcenter.dashboard.losses.pending', 'Waiting for a callback')}
          value={String(view.pending)}
          tone={view.pending > 0 ? 'warning' : 'success'}
          testId="cc-losses-pending"
        />
      </Flex>

      <VStack gap="6" data-testid="cc-losses-buckets">
        <Text variant="xs">{t('callcenter.dashboard.losses.waitTitle', 'How long callers waited before hanging up')}</Text>
        {view.buckets.map((bucket) => {
          const [key, fallback] = BUCKET_LABEL[bucket.id];
          return (
            <Flex key={bucket.id} align="center" gap="8" className={styles.bucket} data-testid={`cc-losses-bucket-${bucket.id}`}>
              <Text as="span" variant="xs" className={styles.bucketLabel}>{t(key, fallback)}</Text>
              <Progress value={bucket.pct} tone={bucket.id === 'over60' ? 'destructive' : 'info'} className={styles.bar} aria-label={t(key, fallback)} />
              <Text as="span" variant="xs" className={styles.bucketCount}>{`${bucket.count} · ${bucket.pct}%`}</Text>
            </Flex>
          );
        })}
      </VStack>
    </VStack>
  );
});
