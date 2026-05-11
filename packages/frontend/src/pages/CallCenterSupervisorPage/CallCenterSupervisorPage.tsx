import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Monitor, Users, Phone, PhoneIncoming, TrendingDown,
  Eye, MessageSquare, Megaphone, Pause, Play, LogOut,
  Clock, BarChart3, Headphones,
} from 'lucide-react';
import { VStack, Flex, Text, Button } from '@/shared/ui';
import { useCallCenterSSE } from '@/features/callcenter/lib/useCallCenterSSE';
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
} from '@/shared/api/endpoints/callCenterApi';
import type { IAgent, ICall } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './CallCenterSupervisorPage.module.scss';

type TabId = 'agents' | 'calls' | 'queues';

export function CallCenterSupervisorPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('agents');

  // SSE connection
  useCallCenterSSE(true);

  // Redux state
  const agents = useSelector(selectCcAgents);
  const queues = useSelector(selectCcQueues);
  const calls = useSelector(selectCcCalls);
  const connected = useSelector(selectCcConnected);

  // Mutations
  const [supervisorSpy] = useSupervisorSpyMutation();
  const [supervisorForcePause] = useSupervisorForcePauseMutation();
  const [supervisorForceUnpause] = useSupervisorForceUnpauseMutation();

  // KPI calculations
  const kpis = useMemo(() => {
    const totalWaiting = queues.reduce((s, q) => s + q.waiting, 0);
    const totalTalking = queues.reduce((s, q) => s + q.talking, 0);
    const freeAgents = agents.filter(a => a.status === 'READY').length;
    const pausedAgents = agents.filter(a => a.status === 'PAUSED').length;
    const totalAbandoned = queues.reduce((s, q) => s + q.calls.abandoned, 0);
    const totalAnswered = queues.reduce((s, q) => s + q.calls.answered, 0);
    const avgSla = queues.length > 0
      ? Math.round(queues.reduce((s, q) => s + q.sla, 0) / queues.length)
      : 100;
    const avgWait = queues.length > 0
      ? Math.round(queues.reduce((s, q) => s + q.avgWait, 0) / queues.length)
      : 0;

    return {
      totalWaiting, totalTalking, freeAgents, pausedAgents,
      totalAbandoned, totalAnswered, avgSla, avgWait,
      totalAgents: agents.length,
    };
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

  const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
    { id: 'agents', label: t('callcenter.supervisor.tabAgents', 'Agents'), icon: Users },
    { id: 'calls', label: t('callcenter.supervisor.tabCalls', 'Live Calls'), icon: Phone },
    { id: 'queues', label: t('callcenter.supervisor.tabQueues', 'Queues'), icon: BarChart3 },
  ];

  return (
    <VStack gap="16" className={styles.wrapper}>
      {/* Page Header */}
      <Flex justify="between" align="center" className="px-2 sm:px-2">
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
          <Text variant="muted" className="text-xs">
            {connected ? 'Live' : 'Connecting...'}
          </Text>
          <div className={`${styles.agentStatusDot} ${connected ? styles.agentStatusReady : styles.agentStatusOffline}`} style={{ width: 8, height: 8 }} />
        </Flex>
      </Flex>

      {/* KPI Strip */}
      <div className={styles.kpiStrip}>
        <div className={`${styles.kpiCard} ${kpis.totalWaiting > 5 ? styles.kpiDanger : kpis.totalWaiting > 2 ? styles.kpiWarning : ''}`}>
          <Text className={styles.kpiLabel}>
            <PhoneIncoming className="w-3 h-3 inline mr-1" />
            {t('callcenter.supervisor.waiting', 'Waiting')}
          </Text>
          <Text className={styles.kpiValue}>{kpis.totalWaiting}</Text>
        </div>

        <div className={styles.kpiCard}>
          <Text className={styles.kpiLabel}>
            <Phone className="w-3 h-3 inline mr-1" />
            {t('callcenter.supervisor.inCall', 'In Call')}
          </Text>
          <Text className={styles.kpiValue}>{kpis.totalTalking}</Text>
        </div>

        <div className={`${styles.kpiCard} ${kpis.freeAgents < 2 ? styles.kpiDanger : styles.kpiSuccess}`}>
          <Text className={styles.kpiLabel}>
            <Users className="w-3 h-3 inline mr-1" />
            {t('callcenter.supervisor.freeAgents', 'Free')}
          </Text>
          <Text className={styles.kpiValue}>{kpis.freeAgents}</Text>
        </div>

        <div className={`${styles.kpiCard} ${kpis.avgSla < 80 ? styles.kpiDanger : styles.kpiSuccess}`}>
          <Text className={styles.kpiLabel}>SLA %</Text>
          <Text className={styles.kpiValue}>{kpis.avgSla}%</Text>
        </div>

        <div className={styles.kpiCard}>
          <Text className={styles.kpiLabel}>
            <Clock className="w-3 h-3 inline mr-1" />
            {t('callcenter.supervisor.avgWait', 'Avg Wait')}
          </Text>
          <Text className={styles.kpiValue}>{formatTime(kpis.avgWait)}</Text>
        </div>

        <div className={`${styles.kpiCard} ${kpis.totalAbandoned > 5 ? styles.kpiDanger : ''}`}>
          <Text className={styles.kpiLabel}>
            <TrendingDown className="w-3 h-3 inline mr-1" />
            {t('callcenter.supervisor.abandoned', 'Lost')}
          </Text>
          <Text className={styles.kpiValue}>{kpis.totalAbandoned}</Text>
        </div>

        <div className={styles.kpiCard}>
          <Text className={styles.kpiLabel}>
            <Headphones className="w-3 h-3 inline mr-1" />
            {t('callcenter.supervisor.totalAgents', 'Agents')}
          </Text>
          <Text className={styles.kpiValue}>{kpis.totalAgents}</Text>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabsRow}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon className="w-4 h-4 inline mr-1.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'agents' && (
        <div className={styles.agentGrid}>
          {agents.length > 0 ? agents.map((agent: IAgent) => (
            <div key={agent.interface} className={styles.agentCard}>
              <div className={styles.agentCardHeader}>
                <div className={`${styles.agentStatusDot} ${agentStatusDot(agent.status)}`} />
                <Text className={styles.agentName}>{agent.name}</Text>
              </div>
              <span className={styles.agentStatus} style={{
                color: agent.status === 'READY' ? 'var(--color-success)' :
                       agent.status === 'IN_CALL' || agent.status === 'RINGING' ? 'var(--color-destructive)' :
                       agent.status === 'PAUSED' ? 'var(--color-warning)' : 'var(--color-muted-foreground)'
              }}>
                {agent.status}{agent.pauseReason ? ` (${agent.pauseReason})` : ''}
              </span>
              <Text className={styles.agentMeta}>
                {t('callcenter.supervisor.callsTaken', 'Calls')}: {agent.callsTaken}
                {agent.queues.length > 0 && ` | ${agent.queues.join(', ')}`}
              </Text>

              <div className={styles.agentActions}>
                {(agent.status === 'IN_CALL' || agent.status === 'RINGING') && (
                  <>
                    <button
                      className={`${styles.agentActionBtn} ${styles.agentActionSpy}`}
                      onClick={() => supervisorSpy({ agentInterface: agent.interface, mode: 'spy' })}
                    >
                      <Eye className="w-3 h-3 inline mr-0.5" /> Spy
                    </button>
                    <button
                      className={`${styles.agentActionBtn} ${styles.agentActionSpy}`}
                      onClick={() => supervisorSpy({ agentInterface: agent.interface, mode: 'whisper' })}
                    >
                      <MessageSquare className="w-3 h-3 inline mr-0.5" /> Whisper
                    </button>
                    <button
                      className={`${styles.agentActionBtn} ${styles.agentActionSpy}`}
                      onClick={() => supervisorSpy({ agentInterface: agent.interface, mode: 'barge' })}
                    >
                      <Megaphone className="w-3 h-3 inline mr-0.5" /> Barge
                    </button>
                  </>
                )}
                {agent.status === 'READY' && (
                  <button
                    className={`${styles.agentActionBtn} ${styles.agentActionPause}`}
                    onClick={() => supervisorForcePause({ agentInterface: agent.interface })}
                  >
                    <Pause className="w-3 h-3 inline mr-0.5" /> {t('callcenter.supervisor.pause', 'Pause')}
                  </button>
                )}
                {agent.status === 'PAUSED' && (
                  <button
                    className={`${styles.agentActionBtn}`}
                    onClick={() => supervisorForceUnpause({ agentInterface: agent.interface })}
                  >
                    <Play className="w-3 h-3 inline mr-0.5" /> {t('callcenter.supervisor.unpause', 'Resume')}
                  </button>
                )}
              </div>
            </div>
          )) : (
            <div className={styles.emptyState}>
              <Users className="w-10 h-10 opacity-30" />
              <Text variant="muted">{t('callcenter.supervisor.noAgents', 'No agents online')}</Text>
            </div>
          )}
        </div>
      )}

      {activeTab === 'calls' && (
        calls.length > 0 ? (
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
              {calls.map((call: ICall, i) => (
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
                    {call.agent && (
                      <button
                        className={`${styles.agentActionBtn} ${styles.agentActionSpy}`}
                        onClick={() => supervisorSpy({ agentInterface: call.agent!, mode: 'spy' })}
                      >
                        <Eye className="w-3 h-3 inline mr-0.5" /> Spy
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={styles.emptyState}>
            <Phone className="w-10 h-10 opacity-30" />
            <Text variant="muted">{t('callcenter.supervisor.noCalls', 'No active calls')}</Text>
          </div>
        )
      )}

      {activeTab === 'queues' && (
        queues.length > 0 ? (
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
        ) : (
          <div className={styles.emptyState}>
            <BarChart3 className="w-10 h-10 opacity-30" />
            <Text variant="muted">{t('callcenter.supervisor.noQueues', 'No queues configured')}</Text>
          </div>
        )
      )}
    </VStack>
  );
}
