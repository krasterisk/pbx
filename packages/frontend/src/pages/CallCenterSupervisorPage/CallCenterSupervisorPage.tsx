import { useState, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import {
  Monitor, Users, Phone, PhoneIncoming, TrendingDown,
  Eye, MessageSquare, Megaphone, Pause, Play,
  Clock, BarChart3, Headphones, LayoutGrid, Table2,
  PhoneForwarded, PhoneOff, Info, ListPlus,
} from 'lucide-react';
import {
  VStack, Flex, Text, Button, SegmentedControl, Sparkline,
  DataTable, Avatar, Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter,
} from '@/shared/ui';
import { useCallCenterSSE } from '@/features/callcenter/lib/useCallCenterSSE';
import { useKpiSamples } from '@/features/callcenter/lib/useKpiSamples';
import { ChatPanelHost } from '@/features/callcenter/ui/ChatPanel/ChatPanel';
import { AgentDetailModal } from '@/features/callcenter/ui/AgentDetailModal/AgentDetailModal';
import { QueueManagementModal } from '@/features/callcenter/ui/QueueManagementModal/QueueManagementModal';
import { BulkActionsBar } from '@/features/callcenter/ui/BulkActionsBar/BulkActionsBar';
import {
  selectCcAgents,
  selectCcQueues,
  selectCcCalls,
  selectCcConnected,
} from '@/features/callcenter/model/selectors/callCenterSelectors';
import {
  useSupervisorSpyMutation,
  useSupervisorForcePauseMutation,
  useSupervisorForceUnpauseMutation,
  useSupervisorRedirectCallMutation,
  useSupervisorHangupCallMutation,
} from '@/shared/api/endpoints/callCenterApi';
import type { IAgent, ICall } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './CallCenterSupervisorPage.module.scss';

type TabId = 'agents' | 'calls' | 'queues';
type AgentView = 'grid' | 'table';

const VIEW_STORAGE_KEY = 'cc:supervisor:view';

function readStoredView(): AgentView {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === 'grid' || v === 'table') return v;
  } catch { /* ignore */ }
  return 'grid';
}

export function CallCenterSupervisorPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('agents');
  const [agentView, setAgentView] = useState<AgentView>(readStoredView);
  const [detailAgent, setDetailAgent] = useState<IAgent | null>(null);
  const [queueMgmtAgent, setQueueMgmtAgent] = useState<IAgent | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [hangupCall, setHangupCall] = useState<ICall | null>(null);
  const [transferTarget, setTransferTarget] = useState<Record<string, string>>({});

  useCallCenterSSE(true);

  const agents = useSelector(selectCcAgents);
  const queues = useSelector(selectCcQueues);
  const calls = useSelector(selectCcCalls);
  const connected = useSelector(selectCcConnected);

  const [supervisorSpy] = useSupervisorSpyMutation();
  const [supervisorForcePause] = useSupervisorForcePauseMutation();
  const [supervisorForceUnpause] = useSupervisorForceUnpauseMutation();
  const [supervisorRedirectCall] = useSupervisorRedirectCallMutation();
  const [supervisorHangupCall] = useSupervisorHangupCallMutation();

  const kpis = useMemo(() => {
    const totalWaiting = queues.reduce((s, q) => s + q.waiting, 0);
    const totalTalking = queues.reduce((s, q) => s + q.talking, 0);
    const freeAgents = agents.filter(a => a.status === 'READY').length;
    const totalAbandoned = queues.reduce((s, q) => s + q.calls.abandoned, 0);
    const avgSla = queues.length > 0
      ? Math.round(queues.reduce((s, q) => s + q.sla, 0) / queues.length)
      : 100;
    const avgWait = queues.length > 0
      ? Math.round(queues.reduce((s, q) => s + q.avgWait, 0) / queues.length)
      : 0;

    return {
      waiting: totalWaiting,
      talking: totalTalking,
      freeAgents,
      sla: avgSla,
      avgWait,
      abandoned: totalAbandoned,
      totalAgents: agents.length,
    };
  }, [agents, queues]);

  const samples = useKpiSamples(kpis);

  const readyAgents = useMemo(
    () => agents.filter(a => a.status === 'READY'),
    [agents],
  );

  const transferOptions = useMemo(() => {
    const agentOpts = agents.map(a => ({ value: a.interface, label: a.name }));
    const queueOpts = queues.map(q => ({ value: q.name, label: q.displayName || q.name }));
    return [...agentOpts, ...queueOpts];
  }, [agents, queues]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const agentStatusDot = (status: string): string => {
    const map: Record<string, string> = {
      READY: styles.agentStatusReady,
      IN_CALL: styles.agentStatusInCall,
      RINGING: styles.agentStatusInCall,
      PAUSED: styles.agentStatusPaused,
      WRAPUP: styles.agentStatusWrapup,
      OFFLINE: styles.agentStatusOffline,
    };
    return map[status] || styles.agentStatusOffline;
  };

  const callStatusBadge = (status: string): string => {
    if (status === 'WAITING' || status === 'RINGING') return styles.badgeWaiting;
    if (status === 'TALKING') return styles.badgeTalking;
    if (status === 'HOLD') return styles.badgeHold;
    return '';
  };

  const handleViewChange = useCallback((v: AgentView) => {
    setAgentView(v);
    if (v !== 'table') setRowSelection({});
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch { /* ignore */ }
  }, []);

  const selectedInterfaces = useMemo(
    () => Object.keys(rowSelection).filter((k) => rowSelection[k]),
    [rowSelection],
  );

  const clearRowSelection = useCallback(() => setRowSelection({}), []);

  const openAgentDetail = useCallback((agent: IAgent) => {
    setDetailAgent(agent);
  }, []);

  const openQueueMgmt = useCallback((agent: IAgent) => {
    setQueueMgmtAgent(agent);
  }, []);

  const handleRedirect = useCallback(async (call: ICall, target: string) => {
    if (!target) return;
    await supervisorRedirectCall({ uniqueid: call.uniqueid, target });
  }, [supervisorRedirectCall]);

  const handleConfirmHangup = useCallback(async () => {
    if (!hangupCall) return;
    await supervisorHangupCall({ uniqueid: hangupCall.uniqueid });
    setHangupCall(null);
  }, [hangupCall, supervisorHangupCall]);

  const renderAgentActions = useCallback((agent: IAgent) => (
    <div className={styles.agentActions}>
      <button
        type="button"
        className={styles.agentActionBtn}
        onClick={(e) => { e.stopPropagation(); openAgentDetail(agent); }}
        title={t('callcenter.supervisor.agentDetail.title', 'Agent details')}
      >
        <Info className="w-3 h-3 inline mr-0.5" />
      </button>
      <button
        type="button"
        className={styles.agentActionBtn}
        onClick={(e) => { e.stopPropagation(); openQueueMgmt(agent); }}
        title={t('callcenter.supervisor.queueMgmt.queues', 'Queues')}
      >
        <ListPlus className="w-3 h-3 inline mr-0.5" />
        {t('callcenter.supervisor.queueMgmt.queues', 'Queues')}
      </button>
      {(agent.status === 'IN_CALL' || agent.status === 'RINGING') && (
        <>
          <button
            type="button"
            className={`${styles.agentActionBtn} ${styles.agentActionSpy}`}
            onClick={(e) => { e.stopPropagation(); supervisorSpy({ agentInterface: agent.interface, mode: 'spy' }); }}
          >
            <Eye className="w-3 h-3 inline mr-0.5" /> {t('callcenter.supervisor.spy', 'Spy')}
          </button>
          <button
            type="button"
            className={`${styles.agentActionBtn} ${styles.agentActionSpy}`}
            onClick={(e) => { e.stopPropagation(); supervisorSpy({ agentInterface: agent.interface, mode: 'whisper' }); }}
          >
            <MessageSquare className="w-3 h-3 inline mr-0.5" /> {t('callcenter.supervisor.whisper', 'Whisper')}
          </button>
          <button
            type="button"
            className={`${styles.agentActionBtn} ${styles.agentActionSpy}`}
            onClick={(e) => { e.stopPropagation(); supervisorSpy({ agentInterface: agent.interface, mode: 'barge' }); }}
          >
            <Megaphone className="w-3 h-3 inline mr-0.5" /> {t('callcenter.supervisor.barge', 'Barge')}
          </button>
        </>
      )}
      {agent.status === 'READY' && (
        <button
          type="button"
          className={`${styles.agentActionBtn} ${styles.agentActionPause}`}
          onClick={(e) => { e.stopPropagation(); supervisorForcePause({ agentInterface: agent.interface }); }}
        >
          <Pause className="w-3 h-3 inline mr-0.5" /> {t('callcenter.supervisor.pause', 'Pause')}
        </button>
      )}
      {agent.status === 'PAUSED' && (
        <button
          type="button"
          className={styles.agentActionBtn}
          onClick={(e) => { e.stopPropagation(); supervisorForceUnpause({ agentInterface: agent.interface }); }}
        >
          <Play className="w-3 h-3 inline mr-0.5" /> {t('callcenter.supervisor.unpause', 'Resume')}
        </button>
      )}
    </div>
  ), [openAgentDetail, openQueueMgmt, supervisorSpy, supervisorForcePause, supervisorForceUnpause, t]);

  const agentColumns = useMemo<ColumnDef<IAgent>[]>(() => [
    {
      id: 'status',
      header: t('callcenter.supervisor.status', 'Status'),
      cell: ({ row }) => (
        <span className={`${styles.callStatusBadge} ${agentStatusDot(row.original.status)}`} style={{ paddingLeft: 14 }}>
          <span className={`${styles.agentStatusDot} ${agentStatusDot(row.original.status)}`} style={{ width: 8, height: 8, marginRight: 6 }} />
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'name',
      header: t('callcenter.supervisor.agent_lbl', 'Agent'),
      cell: ({ row }) => (
        <Flex align="center" gap="8">
          <Avatar name={row.original.name} size={28} />
          <Text>{row.original.name}</Text>
        </Flex>
      ),
    },
    {
      id: 'queues',
      header: t('callcenter.supervisor.queue_lbl', 'Queue'),
      cell: ({ row }) => row.original.queues.join(', ') || '-',
    },
    {
      id: 'calls',
      header: t('callcenter.supervisor.callsTaken', 'Calls'),
      cell: ({ row }) => row.original.callsTaken,
    },
    {
      id: 'currentCall',
      header: t('callcenter.supervisor.agentCurrentCall', 'Current call'),
      cell: ({ row }) => row.original.currentCall || '-',
    },
    {
      id: 'actions',
      header: t('callcenter.supervisor.actions_lbl', 'Actions'),
      cell: ({ row }) => renderAgentActions(row.original),
    },
  ], [t, renderAgentActions]);

  const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
    { id: 'agents', label: t('callcenter.supervisor.tabAgents', 'Agents'), icon: Users },
    { id: 'calls', label: t('callcenter.supervisor.tabCalls', 'Live Calls'), icon: Phone },
    { id: 'queues', label: t('callcenter.supervisor.tabQueues', 'Queues'), icon: BarChart3 },
  ];

  const kpiCards = [
    {
      key: 'waiting',
      label: t('callcenter.supervisor.waiting', 'Waiting'),
      value: kpis.waiting,
      icon: PhoneIncoming,
      danger: kpis.waiting > 5,
      warning: kpis.waiting > 2,
      spark: samples.map(s => s.waiting),
    },
    {
      key: 'talking',
      label: t('callcenter.supervisor.inCall', 'In Call'),
      value: kpis.talking,
      icon: Phone,
      spark: samples.map(s => s.talking),
    },
    {
      key: 'free',
      label: t('callcenter.supervisor.freeAgents', 'Free'),
      value: kpis.freeAgents,
      icon: Users,
      danger: kpis.freeAgents < 2,
      success: kpis.freeAgents >= 2,
      spark: samples.map(s => s.freeAgents),
    },
    {
      key: 'sla',
      label: 'SLA %',
      value: `${kpis.sla}%`,
      danger: kpis.sla < 80,
      success: kpis.sla >= 80,
      spark: samples.map(s => s.sla),
    },
    {
      key: 'avgWait',
      label: t('callcenter.supervisor.avgWait', 'Avg Wait'),
      value: formatTime(kpis.avgWait),
      icon: Clock,
      spark: samples.map(s => s.avgWait),
    },
    {
      key: 'abandoned',
      label: t('callcenter.supervisor.abandoned', 'Lost'),
      value: kpis.abandoned,
      icon: TrendingDown,
      danger: kpis.abandoned > 5,
      spark: samples.map(s => s.abandoned),
    },
    {
      key: 'totalAgents',
      label: t('callcenter.supervisor.totalAgents', 'Agents'),
      value: kpis.totalAgents,
      icon: Headphones,
      spark: samples.map(s => s.freeAgents),
    },
  ];

  return (
    <VStack gap="16" className={styles.wrapper} data-testid="cc-supervisor-responsive">
      <Flex justify="between" align="center" className="px-2 sm:px-2 flex-col sm:flex-row gap-3 min-w-0">
        <Flex align="center" gap="12">
          <Flex align="center" justify="center" className="p-2 sm:p-2.5 bg-indigo-500/10 rounded-xl">
            <Monitor className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
          </Flex>
          <VStack>
            <Text variant="h1" className="text-lg sm:text-2xl bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t('callcenter.supervisor.title', 'Supervisor Dashboard')}
            </Text>
            <Text variant="muted" className="mt-0.5 sm:mt-1 text-xs sm:text-sm">
              {t('callcenter.supervisor.subtitle', 'Real-time call center monitoring')}
            </Text>
          </VStack>
        </Flex>

        <Flex align="center" gap="8">
          <ChatPanelHost />
          <Text variant="muted" className="text-xs">
            {connected ? 'Live' : 'Connecting...'}
          </Text>
          <div className={`${styles.agentStatusDot} ${connected ? styles.agentStatusReady : styles.agentStatusOffline}`} style={{ width: 8, height: 8 }} />
        </Flex>
      </Flex>

      <div className={styles.kpiStrip}>
        {kpiCards.map(card => {
          const Icon = card.icon;
          const cardClass = [
            styles.kpiCard,
            card.danger ? styles.kpiDanger : '',
            card.warning ? styles.kpiWarning : '',
            card.success ? styles.kpiSuccess : '',
          ].filter(Boolean).join(' ');
          return (
            <div key={card.key} className={cardClass}>
              <Text className={styles.kpiLabel}>
                {Icon && <Icon className="w-3 h-3 inline mr-1" />}
                {card.label}
              </Text>
              <Flex align="center" justify="between" gap="8">
                <Text className={styles.kpiValue}>{card.value}</Text>
                <Sparkline data={card.spark} />
              </Flex>
            </div>
          );
        })}
      </div>

      <div className={styles.tabsRow}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon className="w-4 h-4 inline mr-1.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'agents' && (
        <>
          <Flex justify="end">
            <SegmentedControl<AgentView>
              ariaLabel={t('callcenter.supervisor.viewToggle', 'Agent view')}
              value={agentView}
              onChange={handleViewChange}
              options={[
                { value: 'grid', icon: LayoutGrid, label: t('callcenter.supervisor.viewGrid', 'Grid') },
                { value: 'table', icon: Table2, label: t('callcenter.supervisor.viewTable', 'Table') },
              ]}
            />
          </Flex>

          {agentView === 'grid' ? (
            <div className={styles.agentGrid}>
              {agents.length > 0 ? agents.map((agent: IAgent) => (
                <div
                  key={agent.interface}
                  className={styles.agentCard}
                  role="button"
                  tabIndex={0}
                  onClick={() => openAgentDetail(agent)}
                  onKeyDown={(e) => { if (e.key === 'Enter') openAgentDetail(agent); }}
                >
                  <div className={styles.agentCardHeader}>
                    <div className={`${styles.agentStatusDot} ${agentStatusDot(agent.status)}`} />
                    <Avatar name={agent.name} size={28} />
                    <Text className={styles.agentName}>{agent.name}</Text>
                  </div>
                  <span className={styles.agentStatus} style={{
                    color: agent.status === 'READY' ? 'var(--color-success)' :
                           agent.status === 'IN_CALL' || agent.status === 'RINGING' ? 'var(--color-destructive)' :
                           agent.status === 'PAUSED' ? 'var(--color-warning)' : 'var(--color-muted-foreground)',
                  }}>
                    {agent.status}{agent.pauseReason ? ` (${agent.pauseReason})` : ''}
                  </span>
                  <Text className={styles.agentMeta}>
                    {t('callcenter.supervisor.callsTaken', 'Calls')}: {agent.callsTaken}
                    {agent.queues.length > 0 && ` | ${agent.queues.join(', ')}`}
                  </Text>
                  {renderAgentActions(agent)}
                </div>
              )) : (
                <div className={styles.emptyState}>
                  <Users className="w-10 h-10 opacity-30" />
                  <Text variant="muted">{t('callcenter.supervisor.noAgents', 'No agents online')}</Text>
                </div>
              )}
            </div>
          ) : (
            agents.length > 0 ? (
              <div
                className={`${styles.tableScroll} overflow-x-auto`}
                data-testid="hybrid-table"
                data-hybrid="overflow-x-auto"
              >
                <DataTable<IAgent>
                  data={agents}
                  columns={agentColumns}
                  getRowId={(row) => row.interface}
                  selectable
                  rowSelection={rowSelection}
                  onRowSelectionChange={setRowSelection}
                />
              </div>
            ) : (
              <div className={styles.emptyState}>
                <Users className="w-10 h-10 opacity-30" />
                <Text variant="muted">{t('callcenter.supervisor.noAgents', 'No agents online')}</Text>
              </div>
            )
          )}
        </>
      )}

      {activeTab === 'calls' && (
        calls.length > 0 ? (
          <div
            className={`${styles.tableScroll} overflow-x-auto`}
            data-testid="hybrid-table"
            data-hybrid="overflow-x-auto"
          >
          <table className={styles.liveCallsTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>{t('callcenter.supervisor.caller', 'Caller')}</th>
                <th>{t('callcenter.supervisor.queue_lbl', 'Queue')}</th>
                <th>{t('callcenter.supervisor.status', 'Status')}</th>
                <th>{t('callcenter.supervisor.agent_lbl', 'Agent')}</th>
                <th>{t('callcenter.supervisor.actions_lbl', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call: ICall, i) => {
                const target = transferTarget[call.uniqueid] ?? '';
                const isWaiting = call.status === 'WAITING' || call.status === 'RINGING';
                const isActive = call.status === 'TALKING' || call.status === 'HOLD';
                const redirectOptions = isWaiting
                  ? readyAgents.map(a => ({ value: a.interface, label: a.name }))
                  : transferOptions;
                return (
                  <tr key={call.uniqueid}>
                    <td>{i + 1}</td>
                    <td>{call.callerIdNum || '-'}</td>
                    <td>{call.queue}</td>
                    <td>
                      <span className={`${styles.callStatusBadge} ${callStatusBadge(call.status)}`}>
                        {call.status}
                      </span>
                    </td>
                    <td>{call.agent || '-'}</td>
                    <td>
                      <Flex align="center" gap="6" wrap="wrap">
                        {(isWaiting || isActive) && (
                          <>
                            <select
                              className={styles.transferSelect}
                              value={target}
                              onChange={(e) => setTransferTarget(prev => ({ ...prev, [call.uniqueid]: e.target.value }))}
                            >
                              <option value="">{t('callcenter.supervisor.transferTarget', 'Target...')}</option>
                              {redirectOptions.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            {isWaiting && (
                              <button
                                type="button"
                                className={styles.agentActionBtn}
                                disabled={!target}
                                onClick={() => handleRedirect(call, target)}
                              >
                                <PhoneForwarded className="w-3 h-3 inline mr-0.5" />
                                {t('callcenter.supervisor.pickup', 'Pickup')}
                              </button>
                            )}
                            <button
                              type="button"
                              className={styles.agentActionBtn}
                              disabled={!target}
                              onClick={() => handleRedirect(call, target)}
                            >
                              <PhoneForwarded className="w-3 h-3 inline mr-0.5" />
                              {t('callcenter.supervisor.transfer', 'Transfer')}
                            </button>
                          </>
                        )}
                        {isActive && (
                          <button
                            type="button"
                            className={`${styles.agentActionBtn} ${styles.agentActionDanger}`}
                            onClick={() => setHangupCall(call)}
                          >
                            <PhoneOff className="w-3 h-3 inline mr-0.5" />
                            {t('callcenter.supervisor.hangupCall', 'Hang up')}
                          </button>
                        )}
                        {call.agent && (
                          <button
                            type="button"
                            className={`${styles.agentActionBtn} ${styles.agentActionSpy}`}
                            onClick={() => supervisorSpy({ agentInterface: call.agent!, mode: 'spy' })}
                          >
                            <Eye className="w-3 h-3 inline mr-0.5" /> {t('callcenter.supervisor.spy', 'Spy')}
                          </button>
                        )}
                      </Flex>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Phone className="w-10 h-10 opacity-30" />
            <Text variant="muted">{t('callcenter.supervisor.noCalls', 'No active calls')}</Text>
          </div>
        )
      )}

      {activeTab === 'queues' && (
        queues.length > 0 ? (
          <div
            className={`${styles.tableScroll} overflow-x-auto`}
            data-testid="hybrid-table"
            data-hybrid="overflow-x-auto"
          >
          <table className={styles.liveCallsTable}>
            <thead>
              <tr>
                <th>{t('callcenter.supervisor.queueName', 'Queue')}</th>
                <th>{t('callcenter.supervisor.waiting', 'Waiting')}</th>
                <th>{t('callcenter.supervisor.inCall', 'Talking')}</th>
                <th>{t('callcenter.supervisor.agents_lbl', 'Agents')}</th>
                <th>SLA</th>
                <th>{t('callcenter.supervisor.answered', 'Answered')}</th>
                <th>{t('callcenter.supervisor.abandoned', 'Lost')}</th>
              </tr>
            </thead>
            <tbody>
              {queues.map(q => (
                <tr key={q.name}>
                  <td>{q.displayName || q.name}</td>
                  <td style={{ color: q.waiting > 3 ? 'var(--color-destructive)' : undefined, fontWeight: q.waiting > 0 ? 700 : 400 }}>
                    {q.waiting}
                  </td>
                  <td>{q.talking}</td>
                  <td>
                    {q.agents.available}/{q.agents.total}
                    {q.agents.paused > 0 && ` (${q.agents.paused} paused)`}
                  </td>
                  <td style={{ color: q.sla < 80 ? 'var(--color-destructive)' : 'var(--color-success)', fontWeight: 600 }}>
                    {q.sla}%
                  </td>
                  <td>{q.calls.answered}</td>
                  <td style={{ color: q.calls.abandoned > 0 ? 'var(--color-destructive)' : undefined }}>
                    {q.calls.abandoned}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <BarChart3 className="w-10 h-10 opacity-30" />
            <Text variant="muted">{t('callcenter.supervisor.noQueues', 'No queues configured')}</Text>
          </div>
        )
      )}

      <AgentDetailModal
        agent={detailAgent}
        open={detailAgent != null}
        onClose={() => setDetailAgent(null)}
      />

      <QueueManagementModal
        agent={queueMgmtAgent}
        open={queueMgmtAgent != null}
        onClose={() => setQueueMgmtAgent(null)}
      />

      {agentView === 'table' && selectedInterfaces.length > 0 && (
        <BulkActionsBar
          selectedInterfaces={selectedInterfaces}
          onClear={clearRowSelection}
        />
      )}

      <Dialog open={hangupCall != null} onOpenChange={(v) => { if (!v) setHangupCall(null); }}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>{t('callcenter.supervisor.confirmHangupTitle', 'End call?')}</DialogTitle>
          </DialogHeader>
          <Text>
            {t(
              'callcenter.supervisor.confirmHangupBody',
              'End call {{number}}? The conversation will be terminated',
              { number: hangupCall?.callerIdNum ?? '' },
            )}
          </Text>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHangupCall(null)}>
              {t('callcenter.supervisor.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmHangup}>
              {t('callcenter.supervisor.hangupCall', 'Hang up')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VStack>
  );
}
