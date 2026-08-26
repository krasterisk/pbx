import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import {
  Monitor, Users, Phone, PhoneIncoming, TrendingDown,
  Eye, MessageSquare, Megaphone, Pause, Play,
  Clock, BarChart3, Headphones, LayoutGrid, Table2,
  PhoneForwarded, PhoneOff, Info, ListPlus, History,
  ChevronDown, ChevronUp, UserPlus, X, LogIn, Trash2,
} from 'lucide-react';
import {
  VStack, Flex, Text, Button, SegmentedControl, Sparkline,
  DataTable, Avatar, Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, Checkbox, Label, TableRowActions, TableRowAction,
} from '@/shared/ui';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useCallCenterSSE } from '@/features/callcenter/lib/useCallCenterSSE';
import { useKpiSamples } from '@/features/callcenter/lib/useKpiSamples';
import { ChatPanelHost } from '@/features/callcenter/ui/ChatPanel/ChatPanel';
import { AgentDetailModal } from '@/features/callcenter/ui/AgentDetailModal/AgentDetailModal';
import { QueueManagementModal } from '@/features/callcenter/ui/QueueManagementModal/QueueManagementModal';
import { BulkActionsBar } from '@/features/callcenter/ui/BulkActionsBar/BulkActionsBar';
import { CallHistoryPanel } from '@/features/callcenter/ui/CallHistoryPanel';
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
  useSupervisorQueueAddMutation,
  useSupervisorForceLogoutMutation,
  useSupervisorRedirectCallMutation,
  useSupervisorHangupCallMutation,
  useGetSupervisorAccessScopeQuery,
  useGetSupervisorWatchedAgentsQuery,
  useSetSupervisorWatchedAgentsMutation,
  useSupervisorStartShiftMutation,
} from '@/shared/api/endpoints/callCenterApi';
import { ShiftLoginModal } from '@/features/callcenter/ui/ShiftLoginModal/ShiftLoginModal';
import type { ShiftLoginResult } from '@/features/callcenter/ui/ShiftLoginModal/ShiftLoginModal';
import {
  agentLabelWithExt,
  coworkerActivityLabel,
  formatStatusElapsed,
  queueDisplayName,
  queueNumberFromName,
} from '@/features/callcenter/lib/displayLabels';
import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import { buildUserAvatarUrl } from '@/shared/lib/userAvatarUrl';
import type { IAgent, ICall, IQueueStats } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './CallCenterSupervisorPage.module.scss';

type TabId = 'agents' | 'calls' | 'queues' | 'history';
type AgentView = 'grid' | 'table';

const VIEW_STORAGE_KEY = 'cc:supervisor:view';
const CALLS_COLLAPSED_KEY = 'cc:supervisor:callsCollapsed';
const QUEUE_FILTER_KEY = 'cc:supervisor:queueFilter';

function readStoredView(): AgentView {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === 'grid' || v === 'table') return v;
  } catch { /* ignore */ }
  return 'grid';
}

function readCallsCollapsed(): boolean {
  try {
    return localStorage.getItem(CALLS_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function readQueueFilter(): string[] {
  try {
    const raw = localStorage.getItem(QUEUE_FILTER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
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

function agentExten(agent: Pick<IAgent, 'interface'>): string {
  return normalizeToken(agent.interface);
}

function hasLiveAgentInterface(iface: string): boolean {
  return Boolean(iface) && !iface.startsWith('user:');
}

function operatorWatchLabel(name: string, exten: string, noExten: string): string {
  const n = name.trim();
  const ext = exten.trim();
  if (n && ext) return `${n} (${ext})`;
  if (n) return `${n} (${noExten})`;
  return ext || noExten;
}

function queueMatchesFilter(queueName: string, filter: Set<string>): boolean {
  if (filter.size === 0) return true;
  const num = queueNumberFromName(queueName)?.toLowerCase();
  return filter.has(queueName.toLowerCase()) || (num != null && filter.has(num));
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
  const [callsCollapsed, setCallsCollapsed] = useState(readCallsCollapsed);
  const [queueFilter, setQueueFilter] = useState<string[]>(readQueueFilter);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [draftUserIds, setDraftUserIds] = useState<number[]>([]);
  const [shiftAgent, setShiftAgent] = useState<IAgent | null>(null);

  useCallCenterSSE(true);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const agents = useSelector(selectCcAgents);
  const queues = useSelector(selectCcQueues);
  const calls = useSelector(selectCcCalls);
  const connected = useSelector(selectCcConnected);
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  const { data: accessScope } = useGetSupervisorAccessScopeQuery();
  const { data: watched } = useGetSupervisorWatchedAgentsQuery();
  const [setWatchedAgents, { isLoading: savingWatchlist }] = useSetSupervisorWatchedAgentsMutation();
  const [supervisorStartShift] = useSupervisorStartShiftMutation();

  const [supervisorSpy] = useSupervisorSpyMutation();
  const [supervisorForcePause] = useSupervisorForcePauseMutation();
  const [supervisorForceUnpause] = useSupervisorForceUnpauseMutation();
  const [supervisorQueueAdd] = useSupervisorQueueAddMutation();
  const [supervisorForceLogout] = useSupervisorForceLogoutMutation();
  const [supervisorRedirectCall] = useSupervisorRedirectCallMutation();
  const [supervisorHangupCall] = useSupervisorHangupCallMutation();

  const watchedUserIds = useMemo(
    () => new Set(watched?.userIds ?? []),
    [watched],
  );

  const avatarByUserId = useMemo(() => {
    const map = new Map<number, string | null>();
    for (const c of accessScope?.candidates ?? []) {
      map.set(c.userId, c.avatar ?? null);
    }
    return map;
  }, [accessScope]);

  const agentAvatarSrc = useCallback((agent: IAgent) => {
    if (!agent.userId) return undefined;
    return buildUserAvatarUrl(agent.userId, avatarByUserId.get(agent.userId), accessToken);
  }, [avatarByUserId, accessToken]);

  const allowedQueueTokens = useMemo(() => {
    if (!accessScope || accessScope.queues == null) return null;
    return new Set(accessScope.queues.map((q) => q.toLowerCase()));
  }, [accessScope]);

  const filterableQueues = useMemo(() => {
    if (allowedQueueTokens == null) return queues;
    return queues.filter((q) => {
      const num = queueNumberFromName(q.name)?.toLowerCase();
      return allowedQueueTokens.has(q.name.toLowerCase())
        || (num != null && allowedQueueTokens.has(num));
    });
  }, [queues, allowedQueueTokens]);

  const queueFilterSet = useMemo(
    () => new Set(queueFilter.map((q) => q.toLowerCase())),
    [queueFilter],
  );

  const watchedAgents = useMemo(() => {
    const live = agents.filter((a) => a.userId > 0 && watchedUserIds.has(a.userId));
    const liveIds = new Set(live.map((a) => a.userId));
    const stubs: IAgent[] = [];
    for (const c of accessScope?.candidates ?? []) {
      if (!watchedUserIds.has(c.userId) || liveIds.has(c.userId)) continue;
      stubs.push({
        interface: c.interface || `user:${c.userId}`,
        name: c.name,
        status: 'OFFLINE',
        queues: [],
        callsTaken: 0,
        callsMade: 0,
        callsMissed: 0,
        kpiDay: { answered: 0, made: 0, missed: 0 },
        userUid: 0,
        userId: c.userId,
      });
    }
    return [...live, ...stubs];
  }, [agents, watchedUserIds, accessScope]);

  const filteredAgents = useMemo(() => {
    let list = watchedAgents;
    if (queueFilterSet.size > 0) {
      list = list.filter((a) => a.queues.some((q) => queueMatchesFilter(q, queueFilterSet)));
    }
    if (showActiveOnly) {
      list = list.filter((a) => a.status !== 'OFFLINE');
    }
    return list;
  }, [watchedAgents, queueFilterSet, showActiveOnly]);

  const filteredQueues = useMemo(() => {
    let list = filterableQueues;
    if (queueFilterSet.size > 0) {
      list = list.filter((q) => queueMatchesFilter(q.name, queueFilterSet));
    }
    return list;
  }, [filterableQueues, queueFilterSet]);

  const filteredCalls = useMemo(() => {
    let list = calls;
    if (queueFilterSet.size > 0) {
      list = list.filter((c) => queueMatchesFilter(c.queue, queueFilterSet));
    }
    if (watchedUserIds.size > 0) {
      const watchedIfaces = new Set(
        watchedAgents
          .filter((a) => hasLiveAgentInterface(a.interface))
          .map((a) => a.interface),
      );
      const watchedExtens = new Set(
        watchedAgents
          .filter((a) => hasLiveAgentInterface(a.interface))
          .map((a) => agentExten(a)),
      );
      list = list.filter((c) => {
        if (!c.agent) return true;
        return watchedIfaces.has(c.agent) || watchedExtens.has(normalizeToken(c.agent));
      });
    }
    return list;
  }, [calls, queueFilterSet, watchedUserIds, watchedAgents]);

  const kpis = useMemo(() => {
    const qs = filteredQueues;
    const totalWaiting = qs.reduce((s, q) => s + q.waiting, 0);
    const totalTalking = qs.reduce((s, q) => s + q.talking, 0);
    const freeAgents = filteredAgents.filter((a) => a.status === 'READY').length;
    const totalAbandoned = qs.reduce((s, q) => s + q.calls.abandoned, 0);
    const avgSla = qs.length > 0
      ? Math.round(qs.reduce((s, q) => s + q.sla, 0) / qs.length)
      : 100;
    const avgWait = qs.length > 0
      ? Math.round(qs.reduce((s, q) => s + q.avgWait, 0) / qs.length)
      : 0;

    return {
      waiting: totalWaiting,
      talking: totalTalking,
      freeAgents,
      sla: avgSla,
      avgWait,
      abandoned: totalAbandoned,
      totalAgents: filteredAgents.length,
    };
  }, [filteredAgents, filteredQueues]);

  const samples = useKpiSamples(kpis);

  const readyAgents = useMemo(
    () => filteredAgents.filter((a) => a.status === 'READY'),
    [filteredAgents],
  );

  const transferOptions = useMemo(() => {
    const agentOpts = filteredAgents.map((a) => ({
      value: a.interface,
      label: agentLabelWithExt(a),
    }));
    const queueOpts = filteredQueues.map((q) => ({
      value: q.name,
      label: queueDisplayName(q.name, filteredQueues),
    }));
    return [...agentOpts, ...queueOpts];
  }, [filteredAgents, filteredQueues]);

  const callByAgent = useMemo(() => {
    const map = new Map<string, ICall>();
    for (const call of calls) {
      if (!call.agent) continue;
      map.set(normalizeToken(call.agent), call);
      map.set(call.agent.toLowerCase(), call);
    }
    return map;
  }, [calls]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const agentStatusDot = (status: string): string => {
    const map: Record<string, string> = {
      READY: styles.agentStatusWaiting,
      OUTBOUND_WORK: styles.agentStatusWaiting,
      RINGING: styles.agentStatusCalling,
      DIALING: styles.agentStatusCalling,
      CONSULT: styles.agentStatusCalling,
      IN_CALL: styles.agentStatusTalking,
      OFFLINE: styles.agentStatusDown,
      PAUSED: styles.agentStatusDown,
      WRAPUP: styles.agentStatusDown,
      ACW: styles.agentStatusDown,
    };
    return map[status] || styles.agentStatusDown;
  };

  const agentStatusBadge = (agent: IAgent): string => {
    if (agent.queuesDetached) return styles.agentBadgeCalling;
    const status = agent.status;
    const map: Record<string, string> = {
      READY: styles.agentBadgeWaiting,
      OUTBOUND_WORK: styles.agentBadgeWaiting,
      RINGING: styles.agentBadgeCalling,
      DIALING: styles.agentBadgeCalling,
      CONSULT: styles.agentBadgeCalling,
      IN_CALL: styles.agentBadgeTalking,
      OFFLINE: styles.agentBadgeDown,
      PAUSED: styles.agentBadgeDown,
      WRAPUP: styles.agentBadgeDown,
      ACW: styles.agentBadgeDown,
    };
    return map[status] || styles.agentBadgeDown;
  };

  const agentStatusDotFor = (agent: IAgent): string => {
    if (agent.queuesDetached) return styles.agentStatusCalling;
    return agentStatusDot(agent.status);
  };

  const callStatusBadge = (status: string): string => {
    if (status === 'WAITING' || status === 'RINGING') return styles.badgeWaiting;
    if (status === 'TALKING') return styles.badgeTalking;
    if (status === 'HOLD') return styles.badgeHold;
    return '';
  };

  const agentStatusElapsed = useCallback((agent: IAgent): string => {
    if (agent.status === 'OFFLINE' || !agent.statusSince) return '-';
    const sinceMs = Date.parse(agent.statusSince);
    if (!Number.isFinite(sinceMs)) return '-';
    const elapsed = Math.max(0, Math.floor((nowTick - sinceMs) / 1000));
    return formatStatusElapsed(elapsed);
  }, [nowTick]);

  const agentActivity = useCallback((agent: IAgent) => {
    const call = callByAgent.get(agentExten(agent))
      || callByAgent.get(agent.interface.toLowerCase());
    const translate = (key: string, fallback?: string) => t(key, fallback ?? key);
    return coworkerActivityLabel(agent, call, queues, translate);
  }, [callByAgent, queues, t]);

  const handleViewChange = useCallback((v: AgentView) => {
    setAgentView(v);
    if (v !== 'table') setRowSelection({});
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch { /* ignore */ }
  }, []);

  const toggleCallsCollapsed = useCallback(() => {
    setCallsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CALLS_COLLAPSED_KEY, next ? '1' : '0');
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggleQueueFilter = useCallback((queueName: string) => {
    setQueueFilter((prev) => {
      const token = normalizeToken(queueName) || queueName.toLowerCase();
      const next = prev.includes(token)
        ? prev.filter((x) => x !== token)
        : [...prev, token];
      try {
        localStorage.setItem(QUEUE_FILTER_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const clearQueueFilter = useCallback(() => {
    setQueueFilter([]);
    try {
      localStorage.setItem(QUEUE_FILTER_KEY, '[]');
    } catch { /* ignore */ }
  }, []);

  const selectedInterfaces = useMemo(
    () => Object.keys(rowSelection).filter((k) => rowSelection[k]),
    [rowSelection],
  );

  const selectedAgents = useMemo(
    () => filteredAgents.filter((a) => selectedInterfaces.includes(a.interface)),
    [filteredAgents, selectedInterfaces],
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

  const openWatchlist = useCallback(() => {
    setDraftUserIds([...(watched?.userIds ?? [])]);
    setWatchlistOpen(true);
  }, [watched]);

  const toggleDraftUser = useCallback((userId: number) => {
    setDraftUserIds((prev) => (
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    ));
  }, []);

  const saveWatchlist = useCallback(async () => {
    await setWatchedAgents({ userIds: draftUserIds }).unwrap();
    setWatchlistOpen(false);
  }, [draftUserIds, setWatchedAgents]);

  const removeFromWatchlist = useCallback(async (agent: IAgent) => {
    if (!agent.userId) return;
    const next = (watched?.userIds ?? []).filter((id) => id !== agent.userId);
    await setWatchedAgents({ userIds: next });
  }, [setWatchedAgents, watched]);

  const handleSupervisorStartShift = useCallback(async (result: ShiftLoginResult) => {
    if (!shiftAgent?.userId) return;
    await supervisorStartShift({
      operatorUserId: shiftAgent.userId,
      interface: result.interface,
      queues: result.queues,
    }).unwrap();
    setShiftAgent(null);
  }, [shiftAgent, supervisorStartShift]);

  const renderAgentActions = useCallback((agent: IAgent) => {
    const live = hasLiveAgentInterface(agent.interface);
    // Inverted pair: start XOR end shift
    const showStartShift =
      agent.userId > 0
      && (!live || agent.status === 'OFFLINE');
    const showEndShift =
      agent.userId > 0
      && !showStartShift
      && live
      && agent.status !== 'OFFLINE';
    // Inverted pair: pause XOR unpause
    const showPause = live && agent.status === 'READY';
    const showUnpause = live && agent.status === 'PAUSED';

    return (
    <div className={styles.agentActions}>
      {showStartShift && (
        <button
          type="button"
          className={styles.agentActionBtn}
          onClick={(e) => { e.stopPropagation(); setShiftAgent(agent); }}
          title={t('callcenter.supervisor.startShift', 'Start shift')}
        >
          <LogIn className="w-3 h-3 inline mr-0.5" />
          {t('callcenter.supervisor.startShift', 'Start shift')}
        </button>
      )}
      <button
        type="button"
        className={styles.agentActionBtn}
        onClick={(e) => { e.stopPropagation(); openAgentDetail(agent); }}
        title={t('callcenter.supervisor.agentDetail.title', 'Agent details')}
      >
        <Info className="w-3 h-3 inline mr-0.5" />
      </button>
      {live && (
        <button
          type="button"
          className={styles.agentActionBtn}
          onClick={(e) => { e.stopPropagation(); openQueueMgmt(agent); }}
          title={t('callcenter.supervisor.queueMgmt.queues', 'Queues')}
        >
          <ListPlus className="w-3 h-3 inline mr-0.5" />
          {t('callcenter.supervisor.queueMgmt.queues', 'Queues')}
        </button>
      )}
      {live && (agent.status === 'IN_CALL' || agent.status === 'RINGING') && (
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
      {showPause && (
        <button
          type="button"
          className={`${styles.agentActionBtn} ${styles.agentActionPause}`}
          onClick={(e) => { e.stopPropagation(); supervisorForcePause({ agentInterface: agent.interface }); }}
        >
          <Pause className="w-3 h-3 inline mr-0.5" /> {t('callcenter.supervisor.pause', 'Pause')}
        </button>
      )}
      {showUnpause && (
        <button
          type="button"
          className={styles.agentActionBtn}
          onClick={(e) => { e.stopPropagation(); supervisorForceUnpause({ agentInterface: agent.interface }); }}
        >
          <Play className="w-3 h-3 inline mr-0.5" /> {t('callcenter.supervisor.unpause', 'Resume')}
        </button>
      )}
      {showEndShift && (
        <button
          type="button"
          className={`${styles.agentActionBtn} ${styles.agentActionDanger}`}
          onClick={(e) => {
            e.stopPropagation();
            void supervisorForceLogout({ agentInterface: agent.interface });
          }}
          title={t('callcenter.supervisor.bulk.endShift', 'End shift')}
        >
          {t('callcenter.supervisor.bulk.endShift', 'End shift')}
        </button>
      )}
    </div>
    );
  }, [
    openAgentDetail, openQueueMgmt,
    supervisorSpy, supervisorForcePause, supervisorForceUnpause,
    supervisorQueueAdd, supervisorForceLogout, t,
  ]);

  const agentColumns = useMemo<ColumnDef<IAgent>[]>(() => [
    {
      id: 'status',
      header: t('callcenter.supervisor.status', 'Status'),
      cell: ({ row }) => {
        const activity = agentActivity(row.original);
        const statusText = row.original.queuesDetached
          ? t('callcenter.supervisor.queuesDetached', 'Outside queues')
          : activity.text;
        return (
          <span className={`${styles.callStatusBadge} ${agentStatusBadge(row.original)}`}>
            <span className={`${styles.agentStatusDot} ${agentStatusDotFor(row.original)}`} style={{ width: 8, height: 8 }} />
            {statusText}
          </span>
        );
      },
    },
    {
      id: 'statusTime',
      header: t('callcenter.supervisor.statusTime', 'Time'),
      cell: ({ row }) => (
        <span
          className={styles.statusTimer}
          title={t('callcenter.supervisor.statusDuration', 'Time in current status')}
        >
          {agentStatusElapsed(row.original)}
        </span>
      ),
    },
    {
      id: 'name',
      header: t('callcenter.supervisor.agent_lbl', 'Agent'),
      cell: ({ row }) => (
        <Flex align="center" gap="8">
          <Avatar
            name={agentLabelWithExt(row.original)}
            src={agentAvatarSrc(row.original)}
            size={24}
          />
          <span>{agentLabelWithExt(row.original)}</span>
        </Flex>
      ),
    },
    {
      id: 'queues',
      header: t('callcenter.supervisor.queue_lbl', 'Queue'),
      cell: ({ row }) => (
        row.original.queues.map((q) => queueDisplayName(q, queues)).join(', ') || '-'
      ),
    },
    {
      id: 'kpiIn',
      header: t('callcenter.supervisor.kpiIn', 'Inbound'),
      cell: ({ row }) => row.original.kpiDay?.answered ?? 0,
    },
    {
      id: 'kpiOut',
      header: t('callcenter.supervisor.kpiOut', 'Outbound'),
      cell: ({ row }) => row.original.kpiDay?.made ?? 0,
    },
    {
      id: 'kpiMissed',
      header: t('callcenter.supervisor.kpiMissed', 'Missed'),
      cell: ({ row }) => row.original.kpiDay?.missed ?? 0,
    },
    {
      id: 'actions',
      header: t('callcenter.supervisor.actions_lbl', 'Actions'),
      cell: ({ row }) => renderAgentActions(row.original),
    },
    {
      id: 'remove',
      header: '',
      cell: ({ row }) => (
        <TableRowActions>
          <TableRowAction
            danger
            title={t('callcenter.supervisor.removeAgent', 'Remove')}
            aria-label={t('callcenter.supervisor.removeAgent', 'Remove')}
            onClick={() => removeFromWatchlist(row.original)}
          >
            <Trash2 />
          </TableRowAction>
        </TableRowActions>
      ),
    },
  ], [t, renderAgentActions, removeFromWatchlist, agentActivity, agentStatusElapsed, agentAvatarSrc, queues, agentStatusDotFor]);

  const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
    { id: 'agents', label: t('callcenter.supervisor.tabAgents', 'Agents'), icon: Users },
    { id: 'calls', label: t('callcenter.supervisor.tabCalls', 'Live Calls'), icon: Phone },
    { id: 'queues', label: t('callcenter.supervisor.tabQueues', 'Queues'), icon: BarChart3 },
    { id: 'history', label: t('callcenter.supervisor.tabHistory', 'History'), icon: History },
  ];

  const kpiCards = [
    {
      key: 'waiting',
      label: t('callcenter.supervisor.waiting', 'Waiting'),
      value: kpis.waiting,
      icon: PhoneIncoming,
      danger: kpis.waiting > 5,
      warning: kpis.waiting > 2,
      spark: samples.map((s) => s.waiting),
    },
    {
      key: 'talking',
      label: t('callcenter.supervisor.inCall', 'In Call'),
      value: kpis.talking,
      icon: Phone,
      spark: samples.map((s) => s.talking),
    },
    {
      key: 'free',
      label: t('callcenter.supervisor.freeAgents', 'Free'),
      value: kpis.freeAgents,
      icon: Users,
      danger: kpis.freeAgents < 2,
      success: kpis.freeAgents >= 2,
      spark: samples.map((s) => s.freeAgents),
    },
    {
      key: 'sla',
      label: 'SLA %',
      value: `${kpis.sla}%`,
      danger: kpis.sla < 80,
      success: kpis.sla >= 80,
      spark: samples.map((s) => s.sla),
    },
    {
      key: 'avgWait',
      label: t('callcenter.supervisor.avgWait', 'Avg Wait'),
      value: formatTime(kpis.avgWait),
      icon: Clock,
      spark: samples.map((s) => s.avgWait),
    },
    {
      key: 'abandoned',
      label: t('callcenter.supervisor.abandoned', 'Lost'),
      value: kpis.abandoned,
      icon: TrendingDown,
      danger: kpis.abandoned > 5,
      spark: samples.map((s) => s.abandoned),
    },
    {
      key: 'totalAgents',
      label: t('callcenter.supervisor.totalAgents', 'Agents'),
      value: kpis.totalAgents,
      icon: Headphones,
      spark: samples.map((s) => s.freeAgents),
    },
  ];

  const callsSummary = (
    <div className={styles.callsSummary}>
      <div className={`${styles.callsStat} ${kpis.waiting > 5 ? styles.callsStatDanger : ''}`}>
        <PhoneIncoming className="w-3.5 h-3.5" />
        <span className={styles.callsStatValue}>{kpis.waiting}</span>
        <span>{t('callcenter.supervisor.waiting', 'Waiting')}</span>
      </div>
      <div className={styles.callsStat}>
        <Phone className="w-3.5 h-3.5" />
        <span className={styles.callsStatValue}>{kpis.talking}</span>
        <span>{t('callcenter.supervisor.inCall', 'In Call')}</span>
      </div>
      <div className={styles.callsStat}>
        <Users className="w-3.5 h-3.5" />
        <span className={styles.callsStatValue}>{kpis.freeAgents}</span>
        <span>{t('callcenter.supervisor.freeAgents', 'Free')}</span>
      </div>
    </div>
  );

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
            {connected
              ? t('callcenter.supervisor.live', 'Live')
              : t('callcenter.supervisor.connecting', 'Connecting...')}
          </Text>
          <div className={`${styles.agentStatusDot} ${connected ? styles.agentStatusReady : styles.agentStatusOffline}`} style={{ width: 8, height: 8 }} />
        </Flex>
      </Flex>

      <div className={styles.kpiStrip}>
        {kpiCards.map((card) => {
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

      {filterableQueues.length > 0 && (
        <Flex align="center" gap="8" wrap="wrap" className={styles.queueFilterRow}>
          <Text variant="muted" className="text-xs whitespace-nowrap">
            {t('callcenter.supervisor.filterQueues', 'Queue filter')}:
          </Text>
          <button
            type="button"
            className={`${styles.queueChip} ${queueFilter.length === 0 ? styles.queueChipActive : ''}`}
            onClick={clearQueueFilter}
          >
            {t('callcenter.supervisor.filterAllQueues', 'All queues')}
          </button>
          {filterableQueues.map((q: IQueueStats) => {
            const token = normalizeToken(q.name) || q.name.toLowerCase();
            const active = queueFilterSet.has(token);
            return (
              <button
                key={q.name}
                type="button"
                className={`${styles.queueChip} ${active ? styles.queueChipActive : ''}`}
                onClick={() => toggleQueueFilter(q.name)}
              >
                {queueDisplayName(q.name, filterableQueues)}
              </button>
            );
          })}
        </Flex>
      )}

      <div className={styles.tabsRow}>
        {tabs.map((tab) => (
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
          <Flex justify="between" align="center" wrap="wrap" gap="8">
            <Button variant="outline" size="sm" onClick={openWatchlist}>
              <UserPlus className="w-4 h-4 mr-1.5" />
              {t('callcenter.supervisor.manageAgents', 'Manage list')}
            </Button>
            <Flex align="center" gap="12" wrap="wrap">
              <Label className="flex items-center gap-2 cursor-pointer text-sm font-normal">
                <Checkbox
                  checked={showActiveOnly}
                  onChange={(e) => setShowActiveOnly(e.target.checked)}
                />
                {t('callcenter.supervisor.showActiveOnly', 'Show active only')}
              </Label>
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
          </Flex>

          {filteredAgents.length === 0 ? (
            <div className={styles.emptyState}>
              <Users className="w-10 h-10 opacity-30" />
              {showActiveOnly && watchedAgents.length > 0 ? (
                <Text variant="muted">
                  {t('callcenter.supervisor.noActiveAgents', 'No active operators')}
                </Text>
              ) : (
                <>
                  <Text variant="muted">{t('callcenter.supervisor.noWatchedAgents', 'No supervised agents')}</Text>
                  <Text variant="muted" className="text-xs">
                    {t('callcenter.supervisor.noWatchedAgentsHint', 'Add agents from your access list')}
                  </Text>
                  <Button variant="outline" size="sm" onClick={openWatchlist}>
                    <UserPlus className="w-4 h-4 mr-1.5" />
                    {t('callcenter.supervisor.addAgents', 'Add agents')}
                  </Button>
                </>
              )}
            </div>
          ) : agentView === 'grid' ? (
            <div className={styles.agentGrid}>
              {filteredAgents.map((agent: IAgent) => {
                const activity = agentActivity(agent);
                return (
                  <div
                    key={agent.interface}
                    className={styles.agentCard}
                    role="button"
                    tabIndex={0}
                    onClick={() => openAgentDetail(agent)}
                    onKeyDown={(e) => { if (e.key === 'Enter') openAgentDetail(agent); }}
                  >
                    <button
                      type="button"
                      className={styles.agentCardClose}
                      title={t('callcenter.supervisor.removeAgent', 'Remove')}
                      aria-label={t('callcenter.supervisor.removeAgent', 'Remove')}
                      onClick={(e) => { e.stopPropagation(); removeFromWatchlist(agent); }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className={styles.agentCardHeader}>
                      <div className={`${styles.agentStatusDot} ${agentStatusDot(agent.status)}`} />
                      <Avatar
                        name={agentLabelWithExt(agent)}
                        src={agentAvatarSrc(agent)}
                        size={24}
                      />
                      <span className={styles.agentName}>{agentLabelWithExt(agent)}</span>
                    </div>
                    <span className={styles.agentStatus}>
                      {agent.queuesDetached
                        ? t('callcenter.supervisor.queuesDetached', 'Outside queues')
                        : activity.text}
                      <span
                        className={styles.statusTimer}
                        title={t('callcenter.supervisor.statusDuration', 'Time in current status')}
                      >
                        {' · '}
                        {agentStatusElapsed(agent)}
                      </span>
                    </span>
                    <Text className={styles.agentMeta}>
                      {t('callcenter.supervisor.kpiIn', 'Inbound')}: {agent.kpiDay?.answered ?? 0}
                      {' · '}
                      {t('callcenter.supervisor.kpiOut', 'Outbound')}: {agent.kpiDay?.made ?? 0}
                      {' · '}
                      {t('callcenter.supervisor.kpiMissed', 'Missed')}: {agent.kpiDay?.missed ?? 0}
                    </Text>
                    {agent.queues.length > 0 && (
                      <Text className={styles.agentMeta}>
                        {agent.queues.map((q) => queueDisplayName(q, queues)).join(', ')}
                      </Text>
                    )}
                    {renderAgentActions(agent)}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className={`${styles.tableScroll} overflow-x-auto`}
              data-testid="hybrid-table"
              data-hybrid="overflow-x-auto"
            >
              <DataTable<IAgent>
                data={filteredAgents}
                columns={agentColumns}
                getRowId={(row) => row.interface}
                selectable
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
              />
            </div>
          )}
        </>
      )}

      {activeTab === 'calls' && (
        <div className={styles.callsPanel}>
          <Flex justify="between" align="center" className={styles.callsPanelHeader}>
            {callsSummary}
            <button
              type="button"
              className={styles.collapseBtn}
              onClick={toggleCallsCollapsed}
              aria-expanded={!callsCollapsed}
              title={callsCollapsed
                ? t('callcenter.supervisor.expandCalls', 'Expand calls')
                : t('callcenter.supervisor.collapseCalls', 'Collapse calls')}
            >
              {callsCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </Flex>

          {!callsCollapsed && (
            filteredCalls.length > 0 ? (
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
                    {filteredCalls.map((call: ICall, i) => {
                      const target = transferTarget[call.uniqueid] ?? '';
                      const isWaiting = call.status === 'WAITING' || call.status === 'RINGING';
                      const isActive = call.status === 'TALKING' || call.status === 'HOLD';
                      const redirectOptions = isWaiting
                        ? readyAgents.map((a) => ({ value: a.interface, label: agentLabelWithExt(a) }))
                        : transferOptions;
                      const agentRow = call.agent
                        ? agents.find((a) => a.interface === call.agent || agentExten(a) === normalizeToken(call.agent!))
                        : undefined;
                      return (
                        <tr key={call.uniqueid}>
                          <td>{i + 1}</td>
                          <td>{call.callerIdNum || '-'}</td>
                          <td>{queueDisplayName(call.queue, queues)}</td>
                          <td>
                            <span className={`${styles.callStatusBadge} ${callStatusBadge(call.status)}`}>
                              {call.status}
                            </span>
                          </td>
                          <td>{agentRow ? agentLabelWithExt(agentRow) : (call.agent ? interfaceToExtension(call.agent) : '-')}</td>
                          <td>
                            <Flex align="center" gap="6" wrap="wrap">
                              {(isWaiting || isActive) && (
                                <>
                                  <select
                                    className={styles.transferSelect}
                                    value={target}
                                    onChange={(e) => setTransferTarget((prev) => ({ ...prev, [call.uniqueid]: e.target.value }))}
                                  >
                                    <option value="">{t('callcenter.supervisor.transferTarget', 'Target...')}</option>
                                    {redirectOptions.map((o) => (
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
        </div>
      )}

      {activeTab === 'queues' && (
        filteredQueues.length > 0 ? (
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
                {filteredQueues.map((q) => (
                  <tr key={q.name}>
                    <td>{queueDisplayName(q.name, filteredQueues)}</td>
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

      {activeTab === 'history' && (
        <CallHistoryPanel source="supervisor" kpiDisplay="day" />
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
        allowedQueues={accessScope?.queues ?? null}
      />

      {agentView === 'table' && selectedAgents.length > 0 && (
        <BulkActionsBar
          selectedAgents={selectedAgents}
          onClear={clearRowSelection}
          onStartShift={(agent) => setShiftAgent(agent)}
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

      <Dialog open={watchlistOpen} onOpenChange={(v) => { if (!v) setWatchlistOpen(false); }}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>{t('callcenter.supervisor.watchlistTitle', 'Supervised agents')}</DialogTitle>
          </DialogHeader>
          <Text variant="muted" className="text-xs mb-2">
            {t(
              'callcenter.supervisor.watchlistHint',
              'Pick users. An extension is assigned only when the shift starts.',
            )}
          </Text>
          <div className={styles.watchlistList}>
            {(accessScope?.candidates ?? []).length === 0 ? (
              <Text variant="muted">{t('callcenter.supervisor.candidatesEmpty', 'No available agents')}</Text>
            ) : (
              (accessScope?.candidates ?? []).map((c) => {
                const checked = draftUserIds.includes(c.userId);
                return (
                  <label key={c.userId} className={styles.watchlistItem}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDraftUser(c.userId)}
                    />
                    <span>
                      {operatorWatchLabel(
                        c.name,
                        c.exten,
                        t('callcenter.supervisor.noExtension', 'no number'),
                      )}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWatchlistOpen(false)}>
              {t('callcenter.supervisor.cancel', 'Cancel')}
            </Button>
            <Button onClick={saveWatchlist} disabled={savingWatchlist}>
              {t('callcenter.supervisor.watchlistSave', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShiftLoginModal
        open={shiftAgent != null}
        onOpenChange={(open) => { if (!open) setShiftAgent(null); }}
        onConfirm={handleSupervisorStartShift}
        remoteAgent
        title={t('callcenter.supervisor.startShiftFor', 'Start shift for {{name}}', {
          name: shiftAgent?.name || '',
        })}
        subtitle={t(
          'callcenter.supervisor.startShiftHint',
          'Choose how the operator works (SIP phone or browser WebRTC), then the extension and queues.',
        )}
        allowedQueues={accessScope?.queues ?? null}
      />
    </VStack>
  );
}
