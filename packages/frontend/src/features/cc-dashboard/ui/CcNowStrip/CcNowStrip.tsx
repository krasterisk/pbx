import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import type { CcDashboardNow } from '@krasterisk/shared';
import { Button, Flex, Text, VStack } from '@/shared/ui';
import { availableTone, slaTone, type KpiThresholds, type KpiTone } from '@/features/callcenter/lib/kpiThresholds';
import { waitTone } from '@/features/callcenter/lib/queueTiles';
import { formatClock } from '@/features/callcenter/lib/liveCallTiming';
import styles from './CcNowStrip.module.scss';
import { CcMetricLabel } from '@/features/callcenter/ui/CcMetricLabel/CcMetricLabel';

export interface CcNowStripProps {
  now: CcDashboardNow;
  thresholds: KpiThresholds;
  /** Drill-down: the live cockpit. */
  onOpen: () => void;
}

function Stat({ label, value, tone = 'default', testId }: { label: string; value: string; tone?: KpiTone; testId: string }) {
  return (
    <VStack gap="2" className={styles.stat}>
      <Text as="span" className={clsx(styles.value, styles[`tone_${tone}`])} data-testid={testId} data-tone={tone}>
        {value}
      </Text>
      <Text as="span" variant="xs"><CcMetricLabel metric={testId === 'cc-now-sla30' ? 'slaPct' : testId === 'cc-now-longest' ? 'longestWait' : testId === 'cc-now-busy' ? 'talking' : testId.replace('cc-now-', '')}>{label}</CcMetricLabel></Text>
    </VStack>
  );
}

/** "Right now" for a dashboard of today: queue pressure, who can answer, and the last 30 minutes. */
export const CcNowStrip = memo(function CcNowStrip({ now, thresholds, onOpen }: CcNowStripProps) {
  const { t } = useTranslation();
  const { agents } = now;
  return (
    <Button
      type="button"
      variant="ghost"
      className={styles.strip}
      onClick={onOpen}
      data-testid="cc-now-strip"
    >
      <span className="sr-only">{t('callcenter.dashboard.now.open', 'Open the live supervisor screen')} </span>
      <Flex wrap="wrap" gap="24" align="start" className={styles.row}>
        <Stat
          label={t('callcenter.dashboard.now.waiting', 'In queue')}
          value={String(now.waiting)}
          tone={now.waiting > 0 ? 'warning' : 'default'}
          testId="cc-now-waiting"
        />
        <Stat
          label={t('callcenter.dashboard.now.longestWait', 'Longest wait')}
          value={formatClock(now.longestWaitSec)}
          tone={waitTone(now.longestWaitSec, thresholds)}
          testId="cc-now-longest"
        />
        <Stat
          label={t('callcenter.dashboard.now.ready', 'Ready')}
          value={String(agents.ready)}
          tone={availableTone(agents.ready, thresholds)}
          testId="cc-now-ready"
        />
        <Stat label={t('callcenter.dashboard.now.busy', 'In call')} value={String(agents.busy)} testId="cc-now-busy" />
        <Stat label={t('callcenter.dashboard.now.paused', 'Paused')} value={String(agents.paused)} testId="cc-now-paused" />
        <Stat label={t('callcenter.dashboard.now.wrapup', 'Wrap-up')} value={String(agents.wrapup)} testId="cc-now-wrapup" />
        <Stat label={t('callcenter.dashboard.now.offline', 'Offline')} value={String(agents.offline)} testId="cc-now-offline" />
        <Stat
          label={t('callcenter.dashboard.now.slaLast30', 'SLA, last 30 min')}
          value={now.slaLast30 === null ? '—' : `${now.slaLast30}%`}
          tone={now.slaLast30 === null ? 'default' : slaTone(now.slaLast30, thresholds)}
          testId="cc-now-sla30"
        />
      </Flex>
    </Button>
  );
});
