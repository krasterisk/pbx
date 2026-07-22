import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { PhoneIncoming, Phone, Users, PhoneForwarded, Pause, Play, ArrowRight } from 'lucide-react';
import { Button, Text, Flex } from '@/shared/ui';
import {
  useAgentPauseMutation,
  useAgentUnpauseMutation,
  useWarmTransferToQueueMutation,
  useGetAgentQueuesStatsQuery,
} from '@/shared/api/endpoints/callCenterApi';
import { selectMyAgent, selectCcQueues } from '@/features/callcenter/model/selectors/callCenterSelectors';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import styles from './QueuesTab.module.scss';

interface QueuesTabProps {
  /** uniqueid of the operator's own active call, if any — enables warm-transfer-to-queue (D-33). */
  activeCallUniqueid?: string | null;
  /** Switches the parent's active tab/panel to Waiting, scoped to this queue (deep link). */
  onGoToWaiting?: (queueName: string) => void;
}

function freeOperatorsClass(available: number, total: number): string {
  if (available <= 0) return styles.freeDanger;
  if (total > 0 && available / total < 0.5) return styles.freeWarning;
  return styles.freeOk;
}

/**
 * Queues tab (Surface 6, D-31/D-32/D-33) — one card per operator queue: aggregate
 * waiting/talking/SLA, free-operator count (3-state color), personal shift·day
 * answered/missed, and queue actions (pause/unpause this queue, go-to-Waiting,
 * warm-transfer-active-call-to-this-queue).
 *
 * Self-service join/leave is intentionally omitted: no backend endpoint exists yet
 * for an agent to join/leave their own queue membership (only supervisor-driven
 * add/remove via QueueManagementModal). Revisit once that endpoint ships.
 */
export function QueuesTab({ activeCallUniqueid, onGoToWaiting }: QueuesTabProps) {
  const { t } = useTranslation();
  const myAgent = useSelector(selectMyAgent);
  const allQueues = useSelector(selectCcQueues);
  const { data: personalStats } = useGetAgentQueuesStatsQuery();
  const [agentPause] = useAgentPauseMutation();
  const [agentUnpause] = useAgentUnpauseMutation();
  const [warmTransferToQueue] = useWarmTransferToQueueMutation();

  const myQueues = myAgent?.queues ?? [];
  const isPaused = myAgent?.status === 'PAUSED';

  const handleTogglePause = async (queueName: string) => {
    try {
      if (isPaused) {
        await agentUnpause({ queue: queueName }).unwrap();
      } else {
        await agentPause({ queue: queueName }).unwrap();
      }
    } catch (err: any) {
      console.warn('Toggle pause failed:', err?.data?.message || err?.message);
    }
  };

  const handleWarmTransfer = async (queueName: string) => {
    if (!activeCallUniqueid) return;
    try {
      await warmTransferToQueue({ uniqueid: activeCallUniqueid, queue: queueName }).unwrap();
    } catch (err: any) {
      console.warn('Warm transfer to queue failed:', err?.data?.message || err?.message);
    }
  };

  if (myQueues.length === 0) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>
          <Users className="w-8 h-8 opacity-30" />
          <Text className="font-semibold">{t('callcenter.queuesTab.emptyTitle', 'No queues assigned')}</Text>
          <Text variant="muted" className="text-sm">
            {t('callcenter.queuesTab.emptyBody', 'You are not a member of any queue yet')}
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap} data-testid="queues-tab">
      {myQueues.map((queueName) => {
        const queue = allQueues.find((q) => q.name === queueName);
        const personal = personalStats?.[queueName];
        const available = queue?.agents.available ?? 0;
        const total = queue?.agents.total ?? 0;
        return (
          <div key={queueName} className={styles.card}>
            <div className={styles.header}>
              <Text as="h3" className={styles.name}>{queueDisplayName(queueName, allQueues)}</Text>
              <span className={`${styles.freeOps} ${freeOperatorsClass(available, total)}`}>
                <Users className="w-3.5 h-3.5" />
                {available}
                {' '}
                {t('callcenter.queuesTab.free', 'free')}
              </span>
            </div>

            <div className={styles.aggregate}>
              <span><PhoneIncoming className="w-3.5 h-3.5 inline mr-1" />{queue?.waiting ?? 0} {t('callcenter.agent.waiting_lbl', 'waiting')}</span>
              <span><Phone className="w-3.5 h-3.5 inline mr-1" />{queue?.talking ?? 0} {t('callcenter.agent.talking', 'talking')}</span>
              <span>SLA {queue?.sla ?? 0}%</span>
            </div>

            <div className={styles.personal}>
              <span>
                {t('callcenter.queuesTab.answered', 'Answered')}:{' '}
                <span className={styles.personalValue}>
                  {personal?.answered.shift ?? 0} · {personal?.answered.day ?? 0}
                </span>
              </span>
              <span>
                {t('callcenter.queuesTab.missed', 'Missed')}:{' '}
                <span className={styles.personalValue}>
                  {personal?.missed.shift ?? 0} · {personal?.missed.day ?? 0}
                </span>
              </span>
            </div>

            <Flex className={styles.actions}>
              <Button size="sm" variant="outline" onClick={() => handleTogglePause(queueName)}>
                {isPaused ? <Play className="w-3.5 h-3.5 mr-1" /> : <Pause className="w-3.5 h-3.5 mr-1" />}
                {isPaused ? t('callcenter.queuesTab.unpause', 'Unpause') : t('callcenter.queuesTab.pause', 'Pause')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onGoToWaiting?.(queueName)}>
                <ArrowRight className="w-3.5 h-3.5 mr-1" />
                {t('callcenter.queuesTab.goToWaiting', 'Go to Waiting')}
              </Button>
              {activeCallUniqueid && (
                <Button size="sm" variant="outline" onClick={() => handleWarmTransfer(queueName)}>
                  <PhoneForwarded className="w-3.5 h-3.5 mr-1" />
                  {t('callcenter.queuesTab.transferHere', 'Transfer call here')}
                </Button>
              )}
            </Flex>
          </div>
        );
      })}
    </div>
  );
}
