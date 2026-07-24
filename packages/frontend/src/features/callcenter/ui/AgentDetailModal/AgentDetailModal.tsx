import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
} from '@/shared/ui';
import { useLazyGetAgentDetailQuery } from '@/shared/api/endpoints/callCenterApi';
import type { IAgent } from '@/features/callcenter/model/types/callCenterSchema';
import { formatPauseReason } from '@/features/callcenter/lib/displayLabels';
import { AgentTimeline } from '@/features/callcenter/ui/AgentTimeline/AgentTimeline';
import styles from './AgentDetailModal.module.scss';

export interface AgentDetailModalProps {
  agent: IAgent | null;
  open: boolean;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function AgentDetailModal({ agent, open, onClose }: AgentDetailModalProps) {
  const { t } = useTranslation();
  const [fetchDetail, { data: detail, isLoading, isError, isFetching }] = useLazyGetAgentDetailQuery();

  useEffect(() => {
    if (open && agent?.interface) {
      fetchDetail({ interface: agent.interface });
    }
  }, [open, agent?.interface, fetchDetail]);

  const status = detail?.stats.status ?? agent?.status ?? 'OFFLINE';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent size="xl" className={styles.content}>
        <DialogHeader>
          <DialogTitle className={styles.titleRow}>
            {agent && <Avatar name={agent.name} size={40} />}
            <span>{agent?.name ?? t('callcenter.supervisor.agentDetail.title', 'Agent details')}</span>
            <span
              className={styles.statusChip}
              data-status={status}
            >
              {status}
              {detail?.stats.pauseReason
                ? ` (${formatPauseReason(detail.stats.pauseReason, t)})`
                : ''}
            </span>
          </DialogTitle>
        </DialogHeader>

        {isLoading || isFetching ? (
          <div className={styles.statsGrid}>
            {Array.from({ length: 5 }).map((_, i) => (
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
              <div className={styles.statItem}>
                <Text className={styles.statLabel}>
                  {t('callcenter.supervisor.agentDetail.callsHandled', 'Calls handled today')}
                </Text>
                <Text className={styles.statValue}>{detail.stats.callsHandled}</Text>
              </div>
              <div className={styles.statItem}>
                <Text className={styles.statLabel}>
                  {t('callcenter.supervisor.agentDetail.aht', 'AHT')}
                </Text>
                <Text className={styles.statValue}>{formatDuration(detail.stats.aht)}</Text>
              </div>
              <div className={styles.statItem}>
                <Text className={styles.statLabel}>
                  {t('callcenter.supervisor.agentDetail.totalTalk', 'Talk time')}
                </Text>
                <Text className={styles.statValue}>{formatDuration(detail.stats.totalTalk)}</Text>
              </div>
              <div className={styles.statItem}>
                <Text className={styles.statLabel}>
                  {t('callcenter.supervisor.agentDetail.totalHold', 'Hold time')}
                </Text>
                <Text className={styles.statValue}>{formatDuration(detail.stats.totalHold)}</Text>
              </div>
              <div className={styles.statItem}>
                <Text className={styles.statLabel}>
                  {t('callcenter.supervisor.agentDetail.currentQueues', 'Queues')}
                </Text>
                <Text className={styles.statValue}>
                  {detail.stats.queues.length > 0 ? detail.stats.queues.join(', ') : '-'}
                </Text>
              </div>
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
