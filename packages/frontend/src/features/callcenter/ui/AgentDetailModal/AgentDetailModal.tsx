import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Text,
  Skeleton,
  Avatar,
  InfoTooltip,
} from '@/shared/ui';
import { useLazyGetAgentDetailQuery } from '@/shared/api/endpoints/callCenterApi';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import type { AgentStatus, IAgent } from '@/features/callcenter/model/types/callCenterSchema';
import { selectCcQueues } from '@/features/callcenter/model/selectors/callCenterSelectors';
import {
  formatPauseReason,
  agentLabelWithExt,
  agentStatusLabel,
  queueDisplayName,
} from '@/features/callcenter/lib/displayLabels';
import { AgentTimeline } from '@/features/callcenter/ui/AgentTimeline/AgentTimeline';
import styles from './AgentDetailModal.module.scss';

export interface AgentDetailModalProps {
  agent: IAgent | null;
  open: boolean;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface KpiItem {
  key: string;
  label: string;
  hint: string;
  value: string;
  wide?: boolean;
}

export function AgentDetailModal({ agent, open, onClose }: AgentDetailModalProps) {
  const { t } = useTranslation();
  const [fetchDetail, { data: detail, isLoading, isError, isFetching }] = useLazyGetAgentDetailQuery();
  const ccQueues = useSelector(selectCcQueues);
  const { data: queueList = [] } = useGetQueuesQuery(undefined, { skip: !open });

  const queueLabelSources = useMemo(
    () => [
      ...ccQueues.map((q) => ({ name: q.name, displayName: q.displayName })),
      ...queueList.map((q) => ({
        name: q.name,
        displayName: q.display_name || q.name,
        exten: q.exten,
      })),
    ],
    [ccQueues, queueList],
  );

  useEffect(() => {
    if (open && agent?.interface) {
      fetchDetail({ interface: agent.interface });
    }
  }, [open, agent?.interface, fetchDetail]);

  const status = (detail?.stats.status ?? agent?.status ?? 'OFFLINE') as AgentStatus;
  const title = agent ? agentLabelWithExt(agent) : t('callcenter.supervisor.agentDetail.title', 'Agent details');
  const translate = (key: string, fallback?: string) => t(key, fallback ?? key);

  const queuesLabel = useMemo(() => {
    const raw = detail?.stats.queues?.length
      ? detail.stats.queues
      : (agent?.queues ?? []);
    if (!raw.length) return '—';
    return raw.map((q) => queueDisplayName(q, queueLabelSources)).join(', ');
  }, [detail?.stats.queues, agent?.queues, queueLabelSources]);

  const kpiItems: KpiItem[] = detail
    ? [
        {
          key: 'shiftIn',
          label: t('callcenter.supervisor.agentDetail.shiftAnswered', 'Shift inbound'),
          hint: t(
            'callcenter.supervisor.agentDetail.hints.shiftAnswered',
            'Answered inbound queue calls since shift login',
          ),
          value: String(detail.stats.shiftAnswered ?? detail.stats.callsTaken ?? 0),
        },
        {
          key: 'shiftOut',
          label: t('callcenter.supervisor.agentDetail.shiftMade', 'Shift outbound'),
          hint: t(
            'callcenter.supervisor.agentDetail.hints.shiftMade',
            'Outbound / internal calls made during the current shift',
          ),
          value: String(detail.stats.shiftMade ?? detail.stats.callsMade ?? 0),
        },
        {
          key: 'shiftMissed',
          label: t('callcenter.supervisor.agentDetail.shiftMissed', 'Shift missed'),
          hint: t(
            'callcenter.supervisor.agentDetail.hints.shiftMissed',
            'Missed / abandoned / RONA attempts attributed to the agent this shift',
          ),
          value: String(detail.stats.shiftMissed ?? detail.stats.callsMissed ?? 0),
        },
        {
          key: 'dayHandled',
          label: t('callcenter.supervisor.agentDetail.callsHandled', 'Handled today'),
          hint: t(
            'callcenter.supervisor.agentDetail.hints.callsHandled',
            'Answered queue calls since midnight (calendar day)',
          ),
          value: String(detail.stats.callsHandled),
        },
        {
          key: 'dayIn',
          label: t('callcenter.supervisor.agentDetail.dayAnswered', 'Day inbound'),
          hint: t(
            'callcenter.supervisor.agentDetail.hints.dayAnswered',
            'Answered inbound calls since midnight across all shifts',
          ),
          value: String(detail.stats.dayAnswered ?? 0),
        },
        {
          key: 'dayOut',
          label: t('callcenter.supervisor.agentDetail.dayMade', 'Day outbound'),
          hint: t(
            'callcenter.supervisor.agentDetail.hints.dayMade',
            'Outbound / internal calls since midnight',
          ),
          value: String(detail.stats.dayMade ?? 0),
        },
        {
          key: 'dayMissed',
          label: t('callcenter.supervisor.agentDetail.dayMissed', 'Day missed'),
          hint: t(
            'callcenter.supervisor.agentDetail.hints.dayMissed',
            'Missed / abandoned attempts since midnight',
          ),
          value: String(detail.stats.dayMissed ?? 0),
        },
        {
          key: 'aht',
          label: t('callcenter.supervisor.agentDetail.aht', 'AHT'),
          hint: t(
            'callcenter.supervisor.agentDetail.hints.aht',
            'Average Handle Time — mean talk time of answered calls today',
          ),
          value: formatDuration(detail.stats.aht),
        },
        {
          key: 'asa',
          label: t('callcenter.supervisor.agentDetail.asa', 'ASA'),
          hint: t(
            'callcenter.supervisor.agentDetail.hints.asa',
            'Average Speed of Answer — mean caller wait before answer today',
          ),
          value: formatDuration(detail.stats.asa ?? 0),
        },
        {
          key: 'talk',
          label: t('callcenter.supervisor.agentDetail.totalTalk', 'Talk time'),
          hint: t(
            'callcenter.supervisor.agentDetail.hints.totalTalk',
            'Sum of talk time on answered calls today',
          ),
          value: formatDuration(detail.stats.totalTalk),
        },
        {
          key: 'hold',
          label: t('callcenter.supervisor.agentDetail.totalHold', 'Hold time'),
          hint: t(
            'callcenter.supervisor.agentDetail.hints.totalHold',
            'Sum of hold time on calls today',
          ),
          value: formatDuration(detail.stats.totalHold),
        },
        {
          key: 'occupancy',
          label: t('callcenter.supervisor.agentDetail.occupancy', 'Occupancy'),
          hint: t(
            'callcenter.supervisor.agentDetail.hints.occupancy',
            'Share of productive time (talk + wrap-up) vs talk + wrap-up + READY idle',
          ),
          value: `${detail.stats.occupancy ?? 0}%`,
        },
        {
          key: 'login',
          label: t('callcenter.supervisor.agentDetail.loginDuration', 'Shift duration'),
          hint: t(
            'callcenter.supervisor.agentDetail.hints.loginDuration',
            'Time since current shift login',
          ),
          value: formatDuration(detail.stats.loginDurationSec ?? 0),
        },
        {
          key: 'pause',
          label: t('callcenter.supervisor.agentDetail.pauseTotal', 'Pause time'),
          hint: t(
            'callcenter.supervisor.agentDetail.hints.pauseTotal',
            'Total time in PAUSED state today (from status timeline)',
          ),
          value: formatDuration(detail.stats.pauseTotalSec ?? 0),
        },
        {
          key: 'wrapup',
          label: t('callcenter.supervisor.agentDetail.wrapupTotal', 'Wrap-up time'),
          hint: t(
            'callcenter.supervisor.agentDetail.hints.wrapupTotal',
            'Total WRAPUP / ACW time today (from status timeline)',
          ),
          value: formatDuration(detail.stats.wrapupTotalSec ?? 0),
        },
        {
          key: 'queues',
          label: t('callcenter.supervisor.agentDetail.currentQueues', 'Queues'),
          hint: t(
            'callcenter.supervisor.agentDetail.hints.currentQueues',
            'Queues assigned for this shift / live membership',
          ),
          value: queuesLabel,
          wide: true,
        },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent size="xl" className={styles.content}>
        <DialogHeader>
          <DialogTitle className={styles.titleRow}>
            {agent && <Avatar name={title} size={40} />}
            <span>{title}</span>
            <span
              className={styles.statusChip}
              data-status={status}
            >
              {agentStatusLabel(status, translate)}
              {detail?.stats.pauseReason
                ? ` (${formatPauseReason(detail.stats.pauseReason, translate)})`
                : ''}
            </span>
          </DialogTitle>
        </DialogHeader>

        {isLoading || isFetching ? (
          <div className={styles.statsGrid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className={styles.statSkeleton} />
            ))}
          </div>
        ) : isError ? (
          <div className={styles.errorCard}>
            <Text>{t('callcenter.settings.loadError', 'Failed to load data')}</Text>
            <Button
              variant="outline"
              size="sm"
              onClick={() => agent?.interface && fetchDetail({ interface: agent.interface })}
            >
              {t('callcenter.settings.retry', 'Retry')}
            </Button>
          </div>
        ) : detail ? (
          <>
            <div className={styles.statsGrid}>
              {kpiItems.map((item) => (
                <div
                  key={item.key}
                  className={item.wide ? `${styles.statItem} ${styles.statItemWide}` : styles.statItem}
                >
                  <div className={styles.statLabelRow}>
                    <Text className={styles.statLabel}>{item.label}</Text>
                    <InfoTooltip text={item.hint} />
                  </div>
                  <Text className={styles.statValue}>{item.value}</Text>
                </div>
              ))}
            </div>

            <div className={styles.timelineSection}>
              <Text className={styles.sectionTitle}>
                {t('callcenter.supervisor.agentDetail.timeline', 'Day timeline')}
              </Text>
              <AgentTimeline segments={detail.segments} live />
            </div>
          </>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('callcenter.supervisor.cancel', 'Cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
