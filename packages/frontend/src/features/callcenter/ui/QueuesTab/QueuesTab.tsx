import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { PhoneIncoming, Phone, Users } from 'lucide-react';
import { Text, Tooltip } from '@/shared/ui';
import { useWarmTransferToQueueMutation } from '@/shared/api/endpoints/callCenterApi';
import { selectMyAgent, selectCcQueues } from '@/features/callcenter/model/selectors/callCenterSelectors';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import styles from './QueuesTab.module.scss';

interface QueuesTabProps {
  /** uniqueid of the operator's own active call — enables warm-transfer-to-queue. */
  activeCallUniqueid?: string | null;
}

/** all free = success; none = danger; partial = warning */
function freeLevelClass(available: number, total: number): string {
  if (available <= 0) return styles.badgeDanger;
  if (total > 0 && available >= total) return styles.badgeOk;
  return styles.badgeWarning;
}

function freeTextClass(available: number, total: number): string {
  if (available <= 0) return styles.freeDanger;
  if (total > 0 && available >= total) return styles.freeOk;
  return styles.freeWarning;
}

/**
 * Queues tab — fixed-size badges; click transfers the active call into the queue.
 * Answered/abandoned are queue-wide totals (not personal KPI).
 */
export function QueuesTab({ activeCallUniqueid }: QueuesTabProps) {
  const { t } = useTranslation();
  const myAgent = useSelector(selectMyAgent);
  const allQueues = useSelector(selectCcQueues);
  const [warmTransferToQueue] = useWarmTransferToQueueMutation();

  const myQueues = myAgent?.queues ?? [];

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

  const rows = myQueues.map((queueName) => {
    const queue = allQueues.find((q) => q.name === queueName);
    const available = queue?.agents.available ?? 0;
    const total = queue?.agents.total ?? 0;
    return {
      queueName,
      label: queueDisplayName(queueName, allQueues),
      waiting: queue?.waiting ?? 0,
      talking: queue?.talking ?? 0,
      available,
      total,
      sla: queue?.sla ?? 0,
      answered: queue?.calls.answered ?? 0,
      abandoned: queue?.calls.abandoned ?? 0,
      badgeClass: freeLevelClass(available, total),
      freeClass: freeTextClass(available, total),
    };
  });

  return (
    <div className={styles.wrap} data-testid="queues-tab">
      <div className={styles.badgeGrid}>
        {rows.map((row) => {
          const clickable = Boolean(activeCallUniqueid);
          return (
            <button
              type="button"
              key={row.queueName}
              className={`${styles.badge} ${row.badgeClass}${clickable ? ` ${styles.badgeClickable}` : ''}`}
              disabled={!clickable}
              onClick={() => void handleWarmTransfer(row.queueName)}
              title={
                clickable
                  ? t('callcenter.queuesTab.transferHereHint', 'Transfer active call to this queue')
                  : undefined
              }
            >
              <Text as="h3" className={styles.name}>{row.label}</Text>
              <div className={styles.kpiGrid}>
                <Tooltip content={t('callcenter.queuesTab.hintWaiting', 'Callers waiting in queue')}>
                  <span>
                    <PhoneIncoming className="w-3.5 h-3.5 inline mr-1" />
                    {row.waiting} {t('callcenter.queuesTab.waiting', 'waiting')}
                  </span>
                </Tooltip>
                <Tooltip content={t('callcenter.queuesTab.hintTalking', 'Agents currently talking')}>
                  <span>
                    <Phone className="w-3.5 h-3.5 inline mr-1" />
                    {row.talking} {t('callcenter.queuesTab.talking', 'talking')}
                  </span>
                </Tooltip>
                <Tooltip content={t('callcenter.queuesTab.hintFree', 'Agents ready to take a call')}>
                  <span className={row.freeClass}>
                    <Users className="w-3.5 h-3.5 inline mr-1" />
                    {row.available} {t('callcenter.queuesTab.free', 'free')}
                  </span>
                </Tooltip>
                <Tooltip content={t('callcenter.queuesTab.hintSla', 'Service level within threshold')}>
                  <span>{t('callcenter.queuesTab.sla', 'SLA')} {row.sla}%</span>
                </Tooltip>
                <Tooltip content={t('callcenter.queuesTab.hintAnswered', 'Calls answered in this queue')}>
                  <span>
                    {t('callcenter.queuesTab.answered', 'Answered')}: <strong>{row.answered}</strong>
                  </span>
                </Tooltip>
                <Tooltip content={t('callcenter.queuesTab.hintMissed', 'Calls abandoned / missed in this queue')}>
                  <span>
                    {t('callcenter.queuesTab.missed', 'Abandoned')}: <strong>{row.abandoned}</strong>
                  </span>
                </Tooltip>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
