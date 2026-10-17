import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/shared/ui';
import { useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { PhoneIncoming, Phone, Users, Hand, Headphones } from 'lucide-react';
import { Button, Text, Flex } from '@/shared/ui';
import {
  useAgentPickCallMutation,
  useGetMyOperatorSettingsQuery,
} from '@/shared/api/endpoints/callCenterApi';
import {
  selectMyAgent,
  selectCcAgents,
  selectCcQueues,
  selectQueueMonitorCalls,
} from '@/features/callcenter/model/selectors/callCenterSelectors';
import {
  agentDisplayName,
  queueDisplayName,
  callerDisplayLabel,
} from '@/features/callcenter/lib/displayLabels';
import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import styles from './WaitingTab.module.scss';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Waiting tab (Surface 7) - extraction of the pre-09-08 queueMonitor table,
 * preserving the 30s/60s wait-timer warning/danger thresholds and the
 * pickup_enabled-gated "Pick" action verbatim. Scoped to the operator's own
 * queues (D-31 convention); a logged-out operator sees the empty state.
 */
export function WaitingTab({ summaryOnly = false }: { summaryOnly?: boolean } = {}) {
  const { t } = useTranslation();
  const myAgent = useSelector(selectMyAgent);
  const agents = useSelector(selectCcAgents);
  const queues = useSelector(selectCcQueues);
  const allMonitorCalls = useSelector(selectQueueMonitorCalls);
  const { data: operatorSettings } = useGetMyOperatorSettingsQuery();
  const [agentPickCall] = useAgentPickCallMutation();
  const pickingRef = useRef(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [pickError, setPickError] = useState('');

  const monitorCalls = useMemo(() => {
    if (!myAgent) return [];
    return allMonitorCalls.filter((c) => myAgent.queues.includes(c.queue));
  }, [allMonitorCalls, myAgent]);

  const totalWaiting = useMemo(() => monitorCalls.filter((c) => c.status === 'WAITING' || c.status === 'RINGING').length, [monitorCalls]);
  const totalTalking = useMemo(() => monitorCalls.filter((c) => c.status === 'TALKING' || c.status === 'HOLD').length, [monitorCalls]);
  const freeAgents = useMemo(
    () => agents.filter((a) => a.status === 'READY' && a.phoneOnline !== false && myAgent?.queues.some((q) => a.queues.includes(q))).length,
    [agents, myAgent],
  );

  const handlePickCall = async (uniqueid: string) => {
    if (pickingRef.current) return;
    pickingRef.current = true;
    setPicking(uniqueid);
    setPickError('');
    try {
      await agentPickCall({ uniqueid }).unwrap();
    } catch (err: any) {
      const status = err?.status;
      setPickError(status === 404 || status === 409
        ? t('callcenter.agent.pickCallGone', 'This call has already been taken or has ended.')
        : status === 403
          ? t('callcenter.agent.pickCallDenied', 'You do not have permission to take this call.')
          : t('callcenter.agent.pickCallFailed', 'Could not take the call. Check your status and phone, then try again.'));
    } finally {
      pickingRef.current = false;
      setPicking(null);
    }
  };

  const stats = (
    <div className={summaryOnly ? styles.statsInline : styles.stats}>
      <div className={`${styles.stat} ${totalWaiting > 5 ? styles.statDanger : ''}`}>
        <PhoneIncoming className="w-3.5 h-3.5" />
        <Text className={styles.statValue}>{totalWaiting}</Text>
        <Text className={styles.statLabel}>{t('callcenter.agent.waiting_lbl', 'waiting')}</Text>
      </div>
      <div className={styles.stat}>
        <Phone className="w-3.5 h-3.5" />
        <Text className={styles.statValue}>{totalTalking}</Text>
        <Text className={styles.statLabel}>{t('callcenter.agent.talking', 'talking')}</Text>
      </div>
      <div className={styles.stat}>
        <Users className="w-3.5 h-3.5" />
        <Text className={styles.statValue}>{freeAgents}</Text>
        <Text className={styles.statLabel}>{t('callcenter.agent.free', 'free')}</Text>
      </div>
    </div>
  );

  if (summaryOnly) {
    return <div data-testid="waiting-tab-summary">{stats}</div>;
  }

  return (
    <div className={styles.wrap} data-testid="waiting-tab">
      {stats}

      {(pickError || myAgent?.pickupFailed) && <Text variant="error" role="alert">{pickError || t('callcenter.agent.pickCallNoAnswer', 'Your phone did not answer. The caller is still waiting in the queue.')}</Text>}

      {monitorCalls.length === 0 ? (
        <div className={styles.empty}>
          <Headphones className="w-8 h-8 opacity-30" />
          <Text className="font-semibold">{t('callcenter.waitingTab.emptyTitle', 'No calls waiting')}</Text>
          <Text variant="muted" className="text-sm">
            {t('callcenter.waitingTab.emptyBody', 'Calls will appear here as customers wait in queue')}
          </Text>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <Table className={styles.table}>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t('callcenter.agent.status', 'Status')}</TableHead>
                <TableHead>{t('callcenter.agent.caller', 'Caller')}</TableHead>
                <TableHead>{t('callcenter.agent.queue', 'Queue')}</TableHead>
                <TableHead>{t('callcenter.agent.operator', 'Operator')}</TableHead>
                <TableHead>{t('callcenter.agent.wait', 'Wait')}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monitorCalls.map((call, i) => {
                const isTalking = call.status === 'TALKING' || call.status === 'HOLD';
                const waitSec = Math.floor((Date.now() - new Date(call.enterTime).getTime()) / 1000);
                const canPick = !isTalking
                  && operatorSettings?.pickup_enabled
                  && myAgent?.status === 'READY' && myAgent.phoneOnline !== false
                  && myAgent.queues.includes(call.queue);
                const agent = call.agent
                  ? agents.find((a) => a.interface === call.agent)
                  : undefined;
                const operatorLabel = agent
                  ? agentDisplayName(agent)
                  : (call.agent ? interfaceToExtension(call.agent) : '-');
                return (
                  <TableRow
                    key={call.uniqueid}
                    className={isTalking ? styles.rowTalking : styles.rowWaiting}
                    data-status={call.status}
                  >
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <span className={isTalking ? styles.badgeTalking : styles.badgeWaiting}>
                        {isTalking
                          ? (call.status === 'HOLD'
                            ? t('callcenter.agent.onHold', 'Hold')
                            : t('callcenter.agent.talking', 'talking'))
                          : (call.status === 'RINGING'
                            ? t('callcenter.agent.ringing', 'Ringing')
                            : t('callcenter.agent.waiting_lbl', 'waiting'))}
                      </span>
                    </TableCell>
                    <TableCell>{callerDisplayLabel(call.callerIdNum, call.callerIdName)}</TableCell>
                    <TableCell title={call.queue}>{queueDisplayName(call.queue, queues)}</TableCell>
                    <TableCell title={call.agent || undefined}>{operatorLabel}</TableCell>
                    <TableCell className={`${styles.waitTime} ${
                      !isTalking && waitSec > 60 ? styles.waitTimeDanger :
                      !isTalking && waitSec > 30 ? styles.waitTimeWarning : ''
                    }`}>
                      {formatTime(waitSec)}
                    </TableCell>
                    <TableCell>
                      {operatorSettings?.pickup_enabled && !isTalking && (
                        <Flex>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canPick || !!picking}
                            onClick={() => handlePickCall(call.uniqueid)}
                            title={canPick
                              ? t('callcenter.agent.pickCallHint', 'Take this call now')
                              : t('callcenter.agent.pickCallBlocked', 'Pickup is only available while Waiting for call in that queue')}
                          >
                            <Hand className="w-3.5 h-3.5 mr-1" />
                            {picking === call.uniqueid
                              ? t('callcenter.agent.pickingCall', 'Taking call…')
                              : t('callcenter.agent.pickCall', 'Pick')}
                          </Button>
                        </Flex>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
