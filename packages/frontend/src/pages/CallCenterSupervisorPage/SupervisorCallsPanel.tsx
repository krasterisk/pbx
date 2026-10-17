import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  MoreHorizontal,
  Phone,
  PhoneIncoming,
  PhoneOff,
  Users,
} from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Flex,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@/shared/ui';
import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import type { IAgent, ICall, IQueueStats } from '@/features/callcenter/model/types/callCenterSchema';
import { agentLabelWithExt, queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import { callStatusLabel, formatPhone } from '@/features/callcenter/lib/ccFormat';
import { LiveDuration } from '@/features/callcenter/ui/LiveDuration';
import {
  TransferTargetPicker,
  type TransferTargetOption,
} from '@/features/callcenter/ui/TransferTargetPicker';
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

  const callStatusBadge = (status: string): string => {
    if (status === 'WAITING' || status === 'RINGING') return styles.badgeWaiting;
    if (status === 'TALKING') return styles.badgeTalking;
    if (status === 'HOLD') return styles.badgeHold;
    return '';
  };

  const readyTargetOptions: TransferTargetOption[] = readyAgents.map((a) => ({
    value: a.interface,
    label: agentLabelWithExt(a),
    group: 'agent',
  }));

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
                {calls.map((call: ICall, i) => {
                  const isWaiting = call.status === 'WAITING' || call.status === 'RINGING';
                  const isActive = call.status === 'TALKING' || call.status === 'HOLD';
                  const agentRow = call.agent
                    ? agents.find(
                        (a) =>
                          a.interface === call.agent
                          || normalizeToken(a.interface) === normalizeToken(call.agent!),
                      )
                    : undefined;
                  const translateStatus = (key: string, fallback?: string) => t(key, fallback ?? key);

                  return (
                    <TableRow key={call.uniqueid} data-testid={`supervisor-call-row-${call.uniqueid}`}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>
                        <LiveDuration call={call} kind="wait" limitSec={maxWaitSec} />
                      </TableCell>
                      <TableCell>
                        <LiveDuration call={call} kind="talk" />
                      </TableCell>
                      <TableCell>{formatPhone(call.callerIdNum)}</TableCell>
                      <TableCell>{queueDisplayName(call.queue, queues)}</TableCell>
                      <TableCell>
                        <span className={`${styles.callStatusBadge} ${callStatusBadge(call.status)}`}>
                          {callStatusLabel(call.status, translateStatus)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {agentRow
                          ? agentLabelWithExt(agentRow)
                          : call.agent
                            ? interfaceToExtension(call.agent)
                            : '-'}
                      </TableCell>
                      <TableCell>
                        <Flex align="center" gap="6" wrap="wrap">
                          {isWaiting && (
                            <TransferTargetPicker
                              options={(readyTargetOptions.length > 0 ? readyTargetOptions : transferOptions).filter((o) => o.value !== call.queue && o.value !== call.agent)}
                              triggerLabel={t('callcenter.supervisor.pickup', 'Direct')}
                              placeholder={t('callcenter.supervisor.transferTarget', 'Target...')}
                              onSelect={(target) => onRedirect(call, target)}
                              testId={`call-redirect-${call.uniqueid}`}
                            />
                          )}
                          {isActive && call.agent && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => onSpy(call.agent!)}
                              data-testid={`call-spy-${call.uniqueid}`}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              {t('callcenter.supervisor.spy', 'Spy')}
                            </Button>
                          )}
                          {isActive && (
                            <>
                              <TransferTargetPicker
                                options={transferOptions.filter((o) => o.value !== call.queue && o.value !== call.agent)}
                                triggerLabel={t('callcenter.supervisor.transfer', 'Transfer')}
                                placeholder={t('callcenter.supervisor.transferTarget', 'Target...')}
                                onSelect={(target) => onRedirect(call, target)}
                                testId={`call-transfer-${call.uniqueid}`}
                              />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    aria-label={t('callcenter.supervisor.moreActions', 'Actions')}
                                    data-testid={`call-more-${call.uniqueid}`}
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => onRequestHangup(call)}
                                  >
                                    <PhoneOff />
                                    {t('callcenter.supervisor.hangupCall', 'Hang up')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </>
                          )}
                        </Flex>
                      </TableCell>
                    </TableRow>
                  );
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
