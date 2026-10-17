import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { PhoneIncoming, Phone, PhoneForwarded, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button, Text, Tooltip, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/shared/ui';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import type { AgentPanelView } from '../../lib/agentPanelPrefs';
import { CcMetricLabel } from '../CcMetricLabel/CcMetricLabel';
import { useWarmTransferToQueueMutation } from '@/shared/api/endpoints/callCenterApi';
import { selectMyAgent, selectCcQueues } from '@/features/callcenter/model/selectors/callCenterSelectors';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import styles from './QueuesTab.module.scss';

interface QueuesTabProps {
  /** uniqueid of the operator's own active call - enables warm-transfer-to-queue. */
  activeCallUniqueid?: string | null;
  currentQueue?: string;
  view?: AgentPanelView;
}

function freeTextClass(available: number, total: number): string {
  if (available <= 0) return styles.freeDanger;
  if (total > 0 && available >= total) return styles.freeOk;
  return styles.freeWarning;
}

/**
 * Queues tab - live occupancy + today queue answered/abandoned (D-31/D-32).
 * Totals are never Asterisk lifetime Completed counters.
 */
export function QueuesTab({ activeCallUniqueid, currentQueue, view = 'cards' }: QueuesTabProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const myAgent = useSelector(selectMyAgent);
  const allQueues = useSelector(selectCcQueues);
  const [warmTransferToQueue] = useWarmTransferToQueueMutation();

  const myQueues = myAgent?.queues ?? [];

  const handleWarmTransfer = async (queueName: string) => {
    if (!activeCallUniqueid) return;
    try {
      await warmTransferToQueue({ uniqueid: activeCallUniqueid, queue: queueName }).unwrap();
    } catch (err: any) {
      toast.error(t('callcenter.transfer.failed', 'Transfer failed'));
    }
  };

  const rows = useMemo(() => myQueues.map((queueName) => {
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
      /** Queue-wide since midnight (not personal, not Asterisk lifetime). */
      dayAnswered: queue?.calls.answered ?? 0,
      dayAbandoned: queue?.calls.abandoned ?? 0,
      freeClass: freeTextClass(available, total),
    };
  }), [myQueues, allQueues]);

  if (myQueues.length === 0) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>
          <Users className="w-8 h-8 opacity-30" />
          <Text className="font-semibold">{t('callcenter.queuesTab.emptyTitle', 'No queues assigned')}</Text>
          <Text variant="muted" className="text-sm">
            {myAgent
              ? t('callcenter.queuesTab.emptyBody', 'You are not a member of any queue yet')
              : t('callcenter.queuesTab.emptyBodyStartShift', 'Start a shift and select at least one queue')}
          </Text>
        </div>
      </div>
    );
  }

  const transferButton = (row: typeof rows[number]) => activeCallUniqueid && row.queueName !== currentQueue ? (
    <Button size="sm" variant="outline" className={styles.transferAction}
      onClick={() => void handleWarmTransfer(row.queueName)}
      aria-label={t('callcenter.transfer.toNumber', 'Transfer to {{number}}', { number: row.label })}>
      <PhoneForwarded className="w-4 h-4" aria-hidden="true" />
      {t('callcenter.transfer.title', 'Transfer Call')}
    </Button>
  ) : null;

  if (view === 'table' && !isMobile) return <div className={styles.wrap} data-testid="queues-tab">
    <Table surface={false} showSearch={false} showExport={false}>
      <TableHeader><TableRow>
        <TableHead>{t('callcenter.tabs.queues', 'Queues')}</TableHead>
        <TableHead>{t('callcenter.supervisor.kpi.now', 'Now')}</TableHead>
        <TableHead>{t('callcenter.kpi.modeDay', 'Day')}</TableHead>
        <TableHead><CcMetricLabel metric="sla">SLA</CcMetricLabel></TableHead>
        {activeCallUniqueid && <TableHead>{t('common.actions', 'Actions')}</TableHead>}
      </TableRow></TableHeader>
      <TableBody>{rows.map((row) => <TableRow key={row.queueName}>
        <TableCell>{row.label}</TableCell>
        <TableCell>
          <div className={styles.tableMetrics}>
            <span>{row.waiting} {t('callcenter.queuesTab.waiting', 'waiting')}</span>
            <span>{row.talking} {t('callcenter.queuesTab.talking', 'talking')}</span>
            <span className={row.freeClass}>{row.available} {t('callcenter.queuesTab.free', 'free')}</span>
          </div>
        </TableCell>
        <TableCell><div className={styles.tableMetrics}>
          <span>{t('callcenter.queuesTab.answered', 'Answered')}: {row.dayAnswered}</span>
          <span>{t('callcenter.queuesTab.missed', 'Missed')}: {row.dayAbandoned}</span>
        </div></TableCell>
        <TableCell>{row.sla}%</TableCell>
        {activeCallUniqueid && <TableCell>{transferButton(row)}</TableCell>}
      </TableRow>)}</TableBody>
    </Table>
  </div>;

  return (
    <div className={styles.wrap} data-testid="queues-tab">
      <div className={styles.badgeGrid} role="list">
        {rows.map((row) => {
          return (
            <div
              role="listitem"
              key={row.queueName}
              className={styles.badge}
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
                  <span><CcMetricLabel metric="sla">{t('callcenter.queuesTab.sla', 'SLA')}</CcMetricLabel> {row.sla}%</span>
                </Tooltip>
              </div>
              <div className={styles.totalsRow} data-testid="queues-tab-day-totals">
                <Tooltip content={t('callcenter.queuesTab.hintAnsweredDay', 'Answered today since midnight (all agents)')}>
                  <span>
                    {t('callcenter.queuesTab.answered', 'Answered')}: <strong>{row.dayAnswered}</strong>
                  </span>
                </Tooltip>
                <Tooltip content={t('callcenter.queuesTab.hintMissedDay', 'Missed / abandoned today since midnight (all agents)')}>
                  <span>
                    {t('callcenter.queuesTab.missed', 'Missed')}: <strong>{row.dayAbandoned}</strong>
                  </span>
                </Tooltip>
              </div>
              {transferButton(row)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
