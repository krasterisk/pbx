import { useLayoutEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Phone, PhoneIncoming, Users } from 'lucide-react';
import { Button, Flex, Table, TableBody, TableHead, TableHeader, TableRow, Text } from '@/shared/ui';
import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import type { IAgent, ICall, IQueueStats } from '@/features/callcenter/model/types/callCenterSchema';
import { agentLabelWithExt, queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import type { TransferTargetOption } from '@/features/callcenter/ui/TransferTargetPicker';
import { SupervisorCallRow, type SupervisorCallRowActions } from './SupervisorCallRow';
import styles from './CallCenterSupervisorPage.module.scss';

export interface SupervisorCallsPanelProps {
  calls: readonly ICall[];
  agents: readonly IAgent[];
  queues: readonly IQueueStats[];
  readyAgents: readonly IAgent[];
  transferOptions: readonly TransferTargetOption[];
  maxWaitSec: number;
  waitingCount: number;
  talkingCount: number;
  freeAgentsCount: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onRedirect: (call: ICall, target: string) => void;
  onSpy: (agentInterface: string) => void;
  onRequestHangup: (call: ICall) => void;
}

function normalizeToken(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  if (s.includes('/')) return interfaceToExtension(s).toLowerCase();
  const q = s.match(/^q(.+)_\d+$/i);
  if (q) return q[1].toLowerCase();
  if (/^e(w)?.+_\d+$/i.test(s)) return interfaceToExtension(`PJSIP/${s}`).toLowerCase();
  return s.toLowerCase();
}

export function SupervisorCallsPanel({
  calls,
  agents,
  queues,
  readyAgents,
  transferOptions,
  maxWaitSec,
  waitingCount,
  talkingCount,
  freeAgentsCount,
  collapsed,
  onToggleCollapsed,
  onRedirect,
  onSpy,
  onRequestHangup,
}: SupervisorCallsPanelProps) {
  const { t } = useTranslation();

  // Labels/availability are stable across queue counter and duration updates.
  const transferKey = JSON.stringify(transferOptions);
  const readyKey = JSON.stringify(readyAgents.map(a => ({ value: a.interface, label: agentLabelWithExt(a), group: 'agent' })));
  const stableTransferOptions = useMemo(() => JSON.parse(transferKey) as TransferTargetOption[], [transferKey]);
  const stableReadyOptions = useMemo(() => JSON.parse(readyKey) as TransferTargetOption[], [readyKey]);
  const agentsByToken = useMemo(() => {
    const map = new Map<string, IAgent>();
    agents.forEach(agent => { const token = normalizeToken(agent.interface); if (!map.has(token)) map.set(token, agent); });
    return map;
  }, [agents]);
  const latestActions = useRef({ onRedirect, onSpy, onRequestHangup });
  useLayoutEffect(() => { latestActions.current = { onRedirect, onSpy, onRequestHangup }; }, [onRedirect, onSpy, onRequestHangup]);
  const actions = useMemo<SupervisorCallRowActions>(() => ({
    onRedirect: (call, target) => latestActions.current.onRedirect(call, target),
    onSpy: iface => latestActions.current.onSpy(iface),
    onRequestHangup: call => latestActions.current.onRequestHangup(call),
  }), []);

  return (
    <div className={styles.callsPanel} data-testid="supervisor-calls-panel">
      <Flex justify="between" align="center" className={styles.callsPanelHeader}>
        <div className={styles.callsSummary}>
          <div className={`${styles.callsStat} ${waitingCount > 5 ? styles.callsStatDanger : ''}`}>
            <PhoneIncoming className="w-3.5 h-3.5" />
            <span className={styles.callsStatValue}>{waitingCount}</span>
            <span>{t('callcenter.supervisor.waiting', 'Waiting')}</span>
          </div>
          <div className={styles.callsStat}>
            <Phone className="w-3.5 h-3.5" />
            <span className={styles.callsStatValue}>{talkingCount}</span>
            <span>{t('callcenter.supervisor.inCall', 'In Call')}</span>
          </div>
          <div className={styles.callsStat}>
            <Users className="w-3.5 h-3.5" />
            <span className={styles.callsStatValue}>{freeAgentsCount}</span>
            <span>{t('callcenter.supervisor.queueOverview.watchedReady', 'Ready in watchlist')}</span>
          </div>
        </div>
        <Button
          type="button"
          variant="unstyled"
          size="none"
          className={styles.collapseBtn}
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          title={
            collapsed
              ? t('callcenter.supervisor.expandCalls', 'Expand calls')
              : t('callcenter.supervisor.collapseCalls', 'Collapse calls')
          }
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </Button>
      </Flex>

      {!collapsed && (
        calls.length > 0 ? (
          <div
            className={`${styles.tableScroll} overflow-x-auto`}
            data-testid="hybrid-table"
            data-hybrid="overflow-x-auto"
          >
            <Table className={styles.liveCallsTable} showSearch={false} showExport={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t('callcenter.supervisor.waitCol', 'Wait')}</TableHead>
                  <TableHead>{t('callcenter.supervisor.talkCol', 'Talk')}</TableHead>
                  <TableHead>{t('callcenter.supervisor.caller', 'Caller')}</TableHead>
                  <TableHead>{t('callcenter.supervisor.queue_lbl', 'Queue')}</TableHead>
                  <TableHead>{t('callcenter.supervisor.status', 'Status')}</TableHead>
                  <TableHead>{t('callcenter.supervisor.agent_lbl', 'Agent')}</TableHead>
                  <TableHead>{t('callcenter.supervisor.actions_lbl', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call, index) => {
                  const agent = call.agent ? agentsByToken.get(normalizeToken(call.agent)) : undefined;
                  return <SupervisorCallRow key={call.uniqueid} call={call} index={index}
                    agentLabel={agent ? agentLabelWithExt(agent) : call.agent ? interfaceToExtension(call.agent) : '-'}
                    queueLabel={queueDisplayName(call.queue, queues)} maxWaitSec={maxWaitSec}
                    readyTargetOptions={stableReadyOptions} transferOptions={stableTransferOptions} actions={actions} />;
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className={styles.callsEmpty}>
            <Phone className="w-4 h-4 opacity-50" />
            <Text variant="muted">{t('callcenter.supervisor.noCalls', 'No active calls')}</Text>
          </div>
        )
      )}
    </div>
  );
}
