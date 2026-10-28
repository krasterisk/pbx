import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import type { RowSelectionState } from '@tanstack/react-table';
import { BarChart3, LayoutGrid, List } from 'lucide-react';
import {
  VStack, Flex, Text, Button, Skeleton, Sheet, SheetContent, SheetHeader, SheetTitle,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { CcPageHeader } from '@/features/callcenter/ui/CcPageHeader';
import { CcConnectionBanner } from '@/features/callcenter/ui/CcConnectionBanner';
import { MonitorSessionBar } from '@/features/callcenter/ui/MonitorSessionBar';
import { AgentSheet } from '@/features/callcenter/ui/AgentSheet';
import { WatchlistSheet } from '@/features/callcenter/ui/WatchlistSheet';
import {
  buildSupervisorSearch,
  parseSupervisorUrl,
  type SupervisorGroupBy,
  type SupervisorSortBy,
  type SupervisorViewId,
} from '@/features/callcenter/lib/supervisorUrlState';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useCallCenterSSE } from '@/features/callcenter/lib/useCallCenterSSE';
import { useVisibleTick } from '@/features/callcenter/lib/useVisibleTick';
import { resolveKpiThresholds } from '@/features/callcenter/lib/kpiThresholds';
import { sortLiveCalls } from '@/features/callcenter/lib/liveCallTiming';
import { filterAndSortAgents } from '@/features/callcenter/lib/agentBoard';
import { AttentionFeed } from '@/features/callcenter/ui/AttentionFeed';
import { QueueTiles } from '@/features/callcenter/ui/QueueTiles';
import { useGetRecentQueueSlaQuery } from '@/shared/api/endpoints/callCenterReportsApi';
import { buildSlaTrends } from '@/features/callcenter/lib/queueTrend';
import { QueueIntradayPanel } from '@/features/callcenter/ui/QueueIntradayPanel';
import { ChatPanelHost } from '@/features/callcenter/ui/ChatPanel/ChatPanel';
import { BulkActionsBar } from '@/features/callcenter/ui/BulkActionsBar/BulkActionsBar';
import { setMonitorSession, updateAgent } from '@/features/callcenter/model/slice/callCenterSlice';
import { supervisorNamedQueues, supervisorStatusActions } from '@/features/callcenter/lib/supervisorPulse';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import {
  selectCcAgents,
  selectCcQueues,
  selectCcCalls,
} from '@/features/callcenter/model/selectors/callCenterSelectors';
import {
  useSupervisorSpyMutation,
  useSupervisorForcePauseMutation,
  useSupervisorForceUnpauseMutation,
  useSupervisorReconcileQueuesMutation,
  useSupervisorForceLogoutMutation,
  useSupervisorRedirectCallMutation,
  useSupervisorHangupCallMutation,
  useGetSupervisorAccessScopeQuery,
  useGetSupervisorWatchedAgentsQuery,
  useSetSupervisorWatchedAgentsMutation,
  useSupervisorStartShiftMutation,
  useGetPauseReasonsQuery,
  useGetTenantSettingsQuery,
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
import {
  resolveSupervisorKpiPeriodMeta,
  rollupSupervisorKpis,
} from '@/features/callcenter/lib/supervisorKpiRollup';
import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import { buildUserAvatarUrl } from '@/shared/lib/userAvatarUrl';
import type { IAgent, ICall } from '@/features/callcenter/model/types/callCenterSchema';
import { SupervisorKpiStrip, type SupervisorMetric } from './SupervisorKpiStrip';
import { SupervisorMetricSheet } from './SupervisorMetricSheet';
import { SupervisorQueuesSheet } from './SupervisorQueuesSheet';
import { SupervisorAgentStatusMenu } from './SupervisorAgentStatusMenu';
import { SupervisorAgentsBoard, type AgentBoardDensity } from './SupervisorAgentsBoard';
import { SupervisorCallsPanel } from './SupervisorCallsPanel';
import { SupervisorQueueFilter } from './SupervisorQueueFilter';
import { SupervisorJournalSheet, type JournalSection } from './SupervisorJournalSheet';
import styles from './CallCenterSupervisorPage.module.scss';
import pulseStyles from './SupervisorPulse.module.scss';
import { SupervisorJournalsMenu } from './SupervisorJournalsMenu';

const VIEW_STORAGE_KEY = 'cc:supervisor:view';
const CALLS_COLLAPSED_KEY = 'cc:supervisor:callsCollapsed';
const QUEUE_FILTER_KEY = 'cc:supervisor:queueFilter';

function readStoredDensity(): AgentBoardDensity {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === 'grid' || v === 'table' || v === 'compact') return v;
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

function persistQueueFilter(next: string[]) {
  try {
    localStorage.setItem(QUEUE_FILTER_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
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

/** Ticks locally so the board is not remounted every second. */
const AgentStatusElapsed = memo(function AgentStatusElapsed({
  status,
  statusSince,
}: Pick<IAgent, 'status' | 'statusSince'>) {
  const ticking = status !== 'OFFLINE' && Boolean(statusSince);
  const { ref, now } = useVisibleTick(ticking);
  if (status === 'OFFLINE' || !statusSince) return <span ref={ref}>-</span>;
  const sinceMs = Date.parse(statusSince);
  return <span ref={ref}>{Number.isFinite(sinceMs)
    ? formatStatusElapsed(Math.max(0, Math.floor((now - sinceMs) / 1000))) : '-'}</span>;
});

function queueMatchesFilter(queueName: string, filter: Set<string>): boolean {
  if (filter.size === 0) return true;
  const num = queueNumberFromName(queueName)?.toLowerCase();
  return filter.has(queueName.toLowerCase()) || (num != null && filter.has(num));
}

const isJournalView = (v: SupervisorViewId): v is JournalSection => v === 'history' || v === 'callbacks';

interface SelectedAgentRef {
  userId: number;
  iface: string;
}

export function CallCenterSupervisorPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const reduxStore = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialUrl] = useState(() => parseSupervisorUrl(searchParams));

  // URL view: agents/calls/queues = mobile segment, history/callbacks = journal sheet.
  const [view, setView] = useState<SupervisorViewId>(initialUrl.view);
  const [groupBy, setGroupBy] = useState<SupervisorGroupBy>(initialUrl.group);
  const [sortBy, setSortBy] = useState<SupervisorSortBy>(() => searchParams.has('sort') ? initialUrl.sort : 'name');
  const [density, setDensity] = useState<AgentBoardDensity>(readStoredDensity);
  const [queueLayout, setQueueLayout] = useState<'compact' | 'cards'>('compact');
  const [selectedRef, setSelectedRef] = useState<SelectedAgentRef | null>(
    initialUrl.agentId ? { userId: initialUrl.agentId, iface: '' } : null,
  );
  const [queueMgmtAgent, setQueueMgmtAgent] = useState<IAgent | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [hangupCall, setHangupCall] = useState<ICall | null>(null);
  const [callsCollapsed, setCallsCollapsed] = useState(readCallsCollapsed);
  const [queueFilter, setQueueFilter] = useState<string[]>(() =>
    initialUrl.queues.length > 0 ? initialUrl.queues : readQueueFilter(),
  );
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [watchlistError, setWatchlistError] = useState('');
  const [draftUserIds, setDraftUserIds] = useState<number[]>([]);
  const [shiftAgent, setShiftAgent] = useState<IAgent | null>(null);
  const [removeAgent, setRemoveAgent] = useState<IAgent | null>(null);
  const [pauseAgent, setPauseAgent] = useState<IAgent | null>(null);
  const [metric, setMetric] = useState<Exclude<SupervisorMetric, 'waiting'> | null>(null);
  const [endShiftAgent, setEndShiftAgent] = useState<IAgent | null>(null);
  const [busyInterfaces, setBusyInterfaces] = useState<string[]>([]);
  const pendingStatus = useRef(new Set<string>());

  const journalSection: JournalSection | null = isJournalView(view) ? view : null;

  useEffect(() => {
    const next = buildSupervisorSearch({
      view,
      queues: queueFilter,
      agentId: selectedRef && selectedRef.userId > 0 ? selectedRef.userId : null,
      group: groupBy,
      sort: sortBy,
    });
    if (next !== searchParams.toString()) {
      setSearchParams(new URLSearchParams(next), { replace: true });
    }
  }, [view, queueFilter, selectedRef, groupBy, sortBy, searchParams, setSearchParams]);

  useCallCenterSSE(true);

  const agents = useSelector(selectCcAgents);
  const liveQueues = useSelector(selectCcQueues);
  const { data: queueDirectory = [] } = useGetQueuesQuery();
  const queues = useMemo(() => supervisorNamedQueues(liveQueues, queueDirectory), [liveQueues, queueDirectory]);
  const calls = useSelector(selectCcCalls);
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  const { data: accessScope, isLoading: scopeLoading, isError: scopeError, refetch: refetchScope } = useGetSupervisorAccessScopeQuery();
  const { data: watched, isLoading: watchedLoading, isError: watchedError, refetch: refetchWatched } = useGetSupervisorWatchedAgentsQuery();
  const [setWatchedAgents, { isLoading: savingWatchlist }] = useSetSupervisorWatchedAgentsMutation();
  const [supervisorStartShift] = useSupervisorStartShiftMutation();

  const [supervisorSpy] = useSupervisorSpyMutation();
  const [supervisorForcePause] = useSupervisorForcePauseMutation();
  const [supervisorForceUnpause] = useSupervisorForceUnpauseMutation();
  const { data: pauseReasons = [] } = useGetPauseReasonsQuery();
  const { data: tenantSettings } = useGetTenantSettingsQuery();
  const [reconcileQueues] = useSupervisorReconcileQueuesMutation();
  useEffect(() => {
    void reconcileQueues({});
  }, [reconcileQueues]);
  const [supervisorForceLogout] = useSupervisorForceLogoutMutation();
  const [supervisorRedirectCall] = useSupervisorRedirectCallMutation();
  const [supervisorHangupCall] = useSupervisorHangupCallMutation();

  const watchedUserIds = useMemo(() => new Set(watched?.userIds ?? []), [watched]);

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
    if (queueFilterSet.size === 0) return filterableQueues;
    return filterableQueues.filter((q) => queueMatchesFilter(q.name, queueFilterSet));
  }, [filterableQueues, queueFilterSet]);

  const filteredCalls = useMemo(() => {
    let list = calls;
    if (queueFilterSet.size > 0) {
      list = list.filter((c) => queueMatchesFilter(c.queue, queueFilterSet));
    }
    if (watchedUserIds.size > 0) {
      const live = watchedAgents.filter((a) => hasLiveAgentInterface(a.interface));
      const watchedIfaces = new Set(live.map((a) => a.interface));
      const watchedExtens = new Set(live.map((a) => agentExten(a)));
      list = list.filter((c) => {
        if (!c.agent) return true;
        return watchedIfaces.has(c.agent) || watchedExtens.has(normalizeToken(c.agent));
      });
    }
    return list;
  }, [calls, queueFilterSet, watchedUserIds, watchedAgents]);

  const kpiRollup = useMemo(
    () => rollupSupervisorKpis(filteredAgents, filteredQueues),
    [filteredAgents, filteredQueues],
  );

  const kpiPeriodMeta = useMemo(
    () => resolveSupervisorKpiPeriodMeta(tenantSettings?.shift_policy),
    [tenantSettings?.shift_policy],
  );

  const kpiThresholds = useMemo(() => {
    const resolved = resolveKpiThresholds(tenantSettings?.alert_thresholds);
    return {
      freeAgentsMin: resolved.agentsAvailableMin,
      slaCriticalPct: resolved.slaCriticalPct,
      waitingDanger: 5,
      waitingWarning: 2,
      abandonedDanger: 5,
    };
  }, [tenantSettings?.alert_thresholds]);

  /** Same tenant thresholds as the KPI strip and the wallboard, in the shared shape. */
  const attentionThresholds = useMemo(
    () => resolveKpiThresholds(tenantSettings?.alert_thresholds),
    [tenantSettings?.alert_thresholds],
  );

  const showQueuesBlock = view === 'queues';

  /** Trend arrows on the queue tiles: fetched only while tiles are on screen, once a minute. */
  const { data: recentSla } = useGetRecentQueueSlaQuery(undefined, {
    skip: !showQueuesBlock,
    pollingInterval: 60_000,
    skipPollingIfUnfocused: true,
  });
  const slaTrends = useMemo(() => buildSlaTrends(recentSla), [recentSla]);

  /** Longest waiting caller first; ticking durations live in leaf cells, so the order is stable. */
  const sortedCalls = useMemo(() => sortLiveCalls(filteredCalls), [filteredCalls]);

  const readyAgents = useMemo(
    () => filteredAgents.filter((a) => a.status === 'READY' && a.phoneOnline !== false),
    [filteredAgents],
  );

  const transferOptions = useMemo(() => {
    const agentOpts = filteredAgents.map((a) => ({
      value: a.interface,
      label: agentLabelWithExt(a),
      group: 'agent' as const,
      disabled: a.status === 'OFFLINE' || a.phoneOnline === false,
      statusLabel: a.phoneOnline === false
        ? t('callcenter.status.phoneUnavailable')
        : t(`callcenter.status.${a.status === 'READY' ? 'ready' : a.status === 'OFFLINE' ? 'offline' : 'inCall'}`),
    }));
    const queueOpts = filteredQueues.map((q) => ({
      value: q.name,
      label: queueDisplayName(q.name, filteredQueues),
      group: 'queue' as const,
    }));
    return [...agentOpts, ...queueOpts];
  }, [filteredAgents, filteredQueues, t]);

  const callByAgent = useMemo(() => {
    const map = new Map<string, ICall>();
    for (const call of calls) {
      if (!call.agent) continue;
      map.set(normalizeToken(call.agent), call);
      map.set(call.agent.toLowerCase(), call);
    }
    return map;
  }, [calls]);

  const agentActivity = useCallback((agent: IAgent) => {
    const call = callByAgent.get(agentExten(agent))
      || callByAgent.get(agent.interface.toLowerCase());
    const translate = (key: string, fallback?: string) => t(key, fallback ?? key);
    return coworkerActivityLabel(agent, call, queues, translate);
  }, [callByAgent, queues, t]);

  const renderElapsed = useCallback(
    (agent: IAgent) => <AgentStatusElapsed status={agent.status} statusSince={agent.statusSince} />,
    [],
  );

  const handleDensityChange = useCallback((next: AgentBoardDensity) => {
    setDensity(next);
    if (next !== 'table') setRowSelection({});
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
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

  const applyQueueFilter = useCallback((next: string[]) => {
    setQueueFilter(next);
    persistQueueFilter(next);
  }, []);

  const toggleQueueFilter = useCallback((queueName: string) => {
    setQueueFilter((prev) => {
      const token = normalizeToken(queueName) || queueName.toLowerCase();
      const next = prev.includes(token) ? prev.filter((x) => x !== token) : [...prev, token];
      persistQueueFilter(next);
      return next;
    });
  }, []);

  /** Cockpit action: narrow the whole page to one queue. */
  const focusQueue = useCallback((queueName: string) => {
    applyQueueFilter([normalizeToken(queueName) || queueName.toLowerCase()]);
  }, [applyQueueFilter]);

  const isQueueFilterActive = useCallback(
    (queueName: string) => queueFilterSet.has(normalizeToken(queueName) || queueName.toLowerCase()),
    [queueFilterSet],
  );

  const attentionQueueLabel = useCallback(
    (queueName: string) => queueDisplayName(queueName, queues),
    [queues],
  );

  const queueFilterOptions = useMemo(
    () =>
      filterableQueues.map((q) => ({
        token: normalizeToken(q.name) || q.name.toLowerCase(),
        label: queueDisplayName(q.name, filterableQueues),
      })),
    [filterableQueues],
  );

  /** The intraday chart follows the page filter only when exactly one queue is selected. */
  const intradayQueueName = useMemo(() => {
    if (queueFilter.length !== 1) return undefined;
    return queues.find((q) => (normalizeToken(q.name) || q.name.toLowerCase()) === queueFilter[0])?.name;
  }, [queueFilter, queues]);

  const startSpy = useCallback(async (agentInterface: string, mode: 'spy' | 'whisper' | 'barge') => {
    try {
      const res = await supervisorSpy({ agentInterface, mode }).unwrap();
      if (res.sessionId) {
        // SSE `monitorSession` confirms; this makes the session bar appear immediately.
        dispatch(setMonitorSession({
          sessionId: res.sessionId,
          agentInterface: res.agentInterface ?? agentInterface,
          agentName: res.agentName ?? agentInterface,
          mode: res.mode ?? mode,
          startedAt: new Date().toISOString(),
        }));
      }
    } catch {
      /* the server error is surfaced by the global API error handler */
    }
  }, [supervisorSpy, dispatch]);

  const runStatusAction = useCallback(async (
    agent: IAgent, status: IAgent['status'], request: () => Promise<unknown>, reason?: string,
  ) => {
    if (pendingStatus.current.has(agent.interface)) return false;
    pendingStatus.current.add(agent.interface);
    setBusyInterfaces([...pendingStatus.current]);
    const optimisticSince = new Date().toISOString();
    dispatch(updateAgent({ interface: agent.interface, status, pauseReason: reason ?? null, statusSince: optimisticSince }));
    try {
      await request();
      return true;
    } catch {
      const current = (reduxStore.getState() as { callCenter?: { agents: IAgent[] } }).callCenter?.agents.find(row => row.interface === agent.interface);
      if (current?.status === status && current.statusSince === optimisticSince) {
        dispatch(updateAgent({ interface: agent.interface, status: agent.status, pauseReason: agent.pauseReason, statusSince: agent.statusSince }));
      }
      toast.error(t('callcenter.supervisor.pulse.statusWriteError'));
      return false;
    } finally {
      pendingStatus.current.delete(agent.interface);
      setBusyInterfaces([...pendingStatus.current]);
    }
  }, [dispatch, reduxStore, t]);

  const unpauseAgent = useCallback((agent: IAgent) => {
    void runStatusAction(agent, 'READY', () => supervisorForceUnpause({ agentInterface: agent.interface }).unwrap());
  }, [runStatusAction, supervisorForceUnpause]);

  const endAgentShift = useCallback((agent: IAgent) => runStatusAction(agent, 'OFFLINE',
    () => supervisorForceLogout({ agentInterface: agent.interface }).unwrap()), [runStatusAction, supervisorForceLogout]);
  const requestEndShift = useCallback((agent: IAgent) => {
    if (supervisorStatusActions(agent).confirmEnd) setEndShiftAgent(agent);
    else void endAgentShift(agent);
  }, [endAgentShift]);
  const handleAttentionUnpause = useCallback((agentInterface: string) => {
    const agent = filteredAgents.find(row => row.interface === agentInterface);
    if (agent) unpauseAgent(agent);
  }, [filteredAgents, unpauseAgent]);

  const handleAttentionSpy = useCallback((agentInterface: string) => {
    void startSpy(agentInterface, 'spy');
  }, [startSpy]);

  const selectedInterfaces = useMemo(
    () => Object.keys(rowSelection).filter((k) => rowSelection[k]),
    [rowSelection],
  );

  const selectedAgents = useMemo(
    () => filteredAgents.filter((a) => selectedInterfaces.includes(a.interface)),
    [filteredAgents, selectedInterfaces],
  );

  const clearRowSelection = useCallback(() => setRowSelection({}), []);

  const detailAgent = useMemo(() => {
    if (!selectedRef) return null;
    return (
      watchedAgents.find((a) => (selectedRef.userId > 0 ? a.userId === selectedRef.userId : a.interface === selectedRef.iface))
      ?? null
    );
  }, [selectedRef, watchedAgents]);

  const openAgentDetail = useCallback((agent: IAgent) => {
    setSelectedRef({ userId: agent.userId, iface: agent.interface });
  }, []);

  const navigateAgent = useCallback((direction: -1 | 1) => {
    if (!detailAgent) return;
    const ordered = filterAndSortAgents(filteredAgents, {
      search: '',
      statusBucket: 'all',
      sortBy,
      nowMs: Date.now(),
    });
    const idx = ordered.findIndex((a) => a.interface === detailAgent.interface);
    const next = ordered[idx + direction];
    if (next) openAgentDetail(next);
  }, [detailAgent, filteredAgents, sortBy, openAgentDetail]);

  const handleRedirect = useCallback((call: ICall, target: string) => {
    if (!target) return;
    void supervisorRedirectCall({ uniqueid: call.uniqueid, target });
  }, [supervisorRedirectCall]);

  const handleConfirmHangup = useCallback(async () => {
    if (!hangupCall) return;
    await supervisorHangupCall({ uniqueid: hangupCall.uniqueid });
    setHangupCall(null);
  }, [hangupCall, supervisorHangupCall]);

  const openWatchlist = useCallback(() => {
    setWatchlistError('');
    const allowed = new Set(accessScope?.candidates.map(candidate => candidate.userId));
    setDraftUserIds((watched?.userIds ?? []).filter(id => allowed.has(id)));
    setWatchlistOpen(true);
  }, [watched, accessScope]);

  const saveWatchlist = useCallback(async () => {
    setWatchlistError('');
    try {
      await setWatchedAgents({ userIds: draftUserIds }).unwrap();
      setWatchlistOpen(false);
    } catch {
      setWatchlistError(t('callcenter.cards.builder.saveError'));
    }
  }, [draftUserIds, setWatchedAgents, t]);

  const handleConfirmRemove = useCallback(async () => {
    if (!removeAgent?.userId) {
      setRemoveAgent(null);
      return;
    }
    const next = (watched?.userIds ?? []).filter((id) => id !== removeAgent.userId);
    await setWatchedAgents({ userIds: next });
    setRemoveAgent(null);
  }, [removeAgent, setWatchedAgents, watched]);

  const handleSupervisorPauseSelect = useCallback(async (reason: string) => {
    if (!pauseAgent) return;
    const paused = await runStatusAction(pauseAgent, 'PAUSED', () => supervisorForcePause({
      agentInterface: pauseAgent.interface,
      reason: reason.trim() || undefined,
    }).unwrap(), reason.trim() || undefined);
    if (paused) setPauseAgent(null);
  }, [pauseAgent, runStatusAction, supervisorForcePause]);

  const handleSupervisorStartShift = useCallback(async (result: ShiftLoginResult) => {
    if (!shiftAgent?.userId) return;
    await supervisorStartShift({
      operatorUserId: shiftAgent.userId,
      interface: result.interface,
      queues: result.queues,
    }).unwrap();
    setShiftAgent(null);
  }, [shiftAgent, supervisorStartShift]);

  const openJournal = useCallback((section: JournalSection) => setView(section), []);
  const closeJournal = useCallback(() => setView('agents'), []);
  const openMetric = useCallback((selected: SupervisorMetric) => {
    if (selected === 'waiting') { setCallsCollapsed(false); setView('calls'); }
    else setMetric(selected);
  }, []);

  const attentionFeed = (
    <AttentionFeed
      agents={filteredAgents}
      queues={filteredQueues}
      calls={filteredCalls}
      pauseReasons={pauseReasons}
      thresholds={attentionThresholds}
      soundEnabled={tenantSettings?.alert_sound_enabled ?? false}
      queueLabel={attentionQueueLabel}
      onUnpause={handleAttentionUnpause}
      onSpy={handleAttentionSpy}
      onOpenQueue={focusQueue}
      groupSimilar
      compact
    />
  );

  const queuesBlock = filterableQueues.length > 0 ? (
    <VStack gap="12">
      <Flex justify="between" align="center" gap="8">
        <Text variant="small">{t('callcenter.supervisor.queueOverview.title', 'Queues')} · {filterableQueues.length}</Text>
        <Flex gap="2" role="group" aria-label={t('callcenter.supervisor.queueOverview.view', 'Queue view')}>
          <Button size="sm" className="h-7 w-7 p-0" variant={queueLayout === 'compact' ? 'secondary' : 'ghost'} aria-pressed={queueLayout === 'compact'} title={t('callcenter.supervisor.queueOverview.list', 'Queue list')} aria-label={t('callcenter.supervisor.queueOverview.list', 'Queue list')} onClick={() => setQueueLayout('compact')}><List size={14} /></Button>
          <Button size="sm" className="h-7 w-7 p-0" variant={queueLayout === 'cards' ? 'secondary' : 'ghost'} aria-pressed={queueLayout === 'cards'} title={t('callcenter.supervisor.queueOverview.cards', 'Queue cards')} aria-label={t('callcenter.supervisor.queueOverview.cards', 'Queue cards')} onClick={() => setQueueLayout('cards')}><LayoutGrid size={14} /></Button>
        </Flex>
      </Flex>
      <QueueTiles
        layout={queueLayout}
        queues={filterableQueues}
        calls={calls}
        thresholds={attentionThresholds}
        isQueueActive={isQueueFilterActive}
        queueLabel={attentionQueueLabel}
        onToggleQueue={toggleQueueFilter}
        trends={slaTrends}
      />
      <details className={styles.queueHistory}>
        <summary>{t('callcenter.supervisor.intraday.title', 'Today by time of day')}</summary>
        <QueueIntradayPanel
        queueName={intradayQueueName}
        queueLabel={intradayQueueName ? attentionQueueLabel(intradayQueueName) : undefined}
        />
      </details>
    </VStack>
  ) : (
    <Flex direction="column" align="center" gap="8" className={styles.emptyState}>
      <BarChart3 className="w-10 h-10 opacity-30" />
      <Text variant="muted">{t('callcenter.supervisor.noQueues', 'No queues configured')}</Text>
    </Flex>
  );

  const callsBlock = (
    <SupervisorCallsPanel
      calls={sortedCalls}
      agents={agents}
      queues={queues}
      readyAgents={readyAgents}
      transferOptions={transferOptions}
      maxWaitSec={attentionThresholds.maxWaitSec}
      waitingCount={kpiRollup.live.waiting}
      talkingCount={kpiRollup.live.talking}
      freeAgentsCount={kpiRollup.live.freeAgents}
      collapsed={callsCollapsed}
      onToggleCollapsed={toggleCallsCollapsed}
      onRedirect={handleRedirect}
      onSpy={handleAttentionSpy}
      onRequestHangup={setHangupCall}
    />
  );

  const agentsBlock = (
    <SupervisorAgentsBoard
      agents={filteredAgents}
      watchedCount={watchedAgents.length}
      queues={queues}
      calls={calls}
      pauseReasons={pauseReasons}
      density={density}
      onDensityChange={handleDensityChange}
      groupBy={groupBy}
      onGroupByChange={setGroupBy}
      sortBy={sortBy}
      onSortByChange={setSortBy}
      showActiveOnly={showActiveOnly}
      onShowActiveOnlyChange={setShowActiveOnly}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      agentAvatarSrc={agentAvatarSrc}
      agentActivity={agentActivity}
      renderElapsed={renderElapsed}
      onOpenWatchlist={openWatchlist}
      onClearQueueFilter={() => applyQueueFilter([])}
      onOpenAgent={openAgentDetail}
      onOpenQueues={setQueueMgmtAgent}
      onStartShift={setShiftAgent}
      onEndShift={requestEndShift}
      onPause={setPauseAgent}
      onUnpause={unpauseAgent}
      busyInterfaces={busyInterfaces}
      onSpy={(agent, mode) => { void startSpy(agent.interface, mode); }}
      onRemoveAgent={setRemoveAgent}
    />
  );

  return (
    <VStack gap="8" className={`${styles.wrapper} ${pulseStyles.root}`} data-testid="cc-supervisor-responsive">
      <CcConnectionBanner />
      <CcPageHeader
        title={t('callcenter.supervisor.title', 'Supervisor Dashboard')}
        description={t('callcenter.supervisor.subtitle', 'Real-time call center monitoring')}
        context={(
          <SupervisorQueueFilter
            options={queueFilterOptions}
            value={queueFilter}
            onChange={applyQueueFilter}
          />
        )}
        actions={(
          <>
            <SupervisorJournalsMenu onHistory={() => openJournal('history')} onCallbacks={() => openJournal('callbacks')}
              onCalls={() => { setCallsCollapsed(false); setView('calls'); }} onQueues={() => setView('queues')} />
            <ChatPanelHost />
          </>
        )}
      />

      <MonitorSessionBar />

      <Flex direction="column" className={styles.stickyKpi} data-testid="cc-supervisor-kpi-sticky">
        <SupervisorKpiStrip
          rollup={kpiRollup}
          periodMeta={kpiPeriodMeta}
          thresholds={kpiThresholds}
          calls={filteredCalls}
          queueCount={filteredQueues.length}
          onSelect={openMetric}
        />
      </Flex>

      <VStack gap="8" className={pulseStyles.page} data-testid="cc-supervisor-main">
        {attentionFeed}
        {scopeLoading || watchedLoading ? <Skeleton className={styles.emptyState} />
          : scopeError || watchedError ? <QueryErrorState message={t('callcenter.supervisor.pulse.loadTeamError')}
            onRetry={() => Promise.allSettled([refetchScope(), refetchWatched()])} /> : agentsBlock}
      </VStack>

      <SupervisorMetricSheet metric={metric} rollup={kpiRollup} periodMeta={kpiPeriodMeta} queues={filteredQueues}
        onClose={() => setMetric(null)} onHistory={() => { setMetric(null); openJournal('history'); }} />

      <Sheet open={view === 'calls' || view === 'queues'} onOpenChange={open => { if (!open) setView('agents'); }}>
        <SheetContent side="right" className={pulseStyles.extras} aria-describedby={undefined}>
          <SheetHeader><SheetTitle>{t(view === 'queues' ? 'callcenter.supervisor.pulse.queueState' : 'callcenter.supervisor.pulse.liveCalls')}</SheetTitle></SheetHeader>
          <VStack gap="12" className={pulseStyles.detailBody}>{view === 'queues' ? queuesBlock : callsBlock}</VStack>
        </SheetContent>
      </Sheet>

      <AgentSheet
        statusControl={detailAgent ? <SupervisorAgentStatusMenu agent={detailAgent} elapsed={renderElapsed(detailAgent)}
          busy={busyInterfaces.includes(detailAgent.interface)} onStartShift={setShiftAgent} onEndShift={requestEndShift}
          onPause={setPauseAgent} onUnpause={unpauseAgent} /> : undefined}
        agent={detailAgent}
        open={detailAgent != null}
        activeCall={detailAgent ? (callByAgent.get(agentExten(detailAgent)) ?? callByAgent.get(detailAgent.interface.toLowerCase())) : undefined}
        avatarSrc={detailAgent ? agentAvatarSrc(detailAgent) : undefined}
        onClose={() => setSelectedRef(null)}
        onNavigateAgent={navigateAgent}
        onStartShift={setShiftAgent}
        onEndShift={requestEndShift}
        onPause={setPauseAgent}
        onUnpause={unpauseAgent}
        onOpenQueues={setQueueMgmtAgent}
        onSpy={(agent, mode) => { void startSpy(agent.interface, mode); }}
      />

      {queueMgmtAgent && <SupervisorQueuesSheet
        agent={queueMgmtAgent}
        open={queueMgmtAgent != null}
        onClose={() => setQueueMgmtAgent(null)}
        allowedQueues={accessScope ? accessScope.queues : []}
      />}

      <Dialog open={pauseAgent !== null} onOpenChange={open => { if (!open && !busyInterfaces.includes(pauseAgent?.interface ?? '')) setPauseAgent(null); }}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{t('callcenter.pause.title', 'Pause reason')}</DialogTitle></DialogHeader>
          <VStack gap="8">
            {[...pauseReasons].sort((a, b) => a.sort_order - b.sort_order).map(reason => <Button key={reason.uid} variant="outline"
              disabled={busyInterfaces.includes(pauseAgent?.interface ?? '')} onClick={() => { void handleSupervisorPauseSelect(reason.name); }}>{reason.name}</Button>)}
            <Button variant="outline" disabled={busyInterfaces.includes(pauseAgent?.interface ?? '')}
              onClick={() => { void handleSupervisorPauseSelect(''); }}>{t('callcenter.supervisor.pause', 'Pause')}</Button>
          </VStack>
        </DialogContent>
      </Dialog>

      <Dialog open={endShiftAgent !== null} onOpenChange={open => { if (!open && !busyInterfaces.includes(endShiftAgent?.interface ?? '')) setEndShiftAgent(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('callcenter.supervisor.pulse.endShiftTitle')}</DialogTitle></DialogHeader>
          <Text>{t('callcenter.supervisor.pulse.endShiftBody', { name: endShiftAgent?.name })}</Text>
          <DialogFooter><Button variant="outline" onClick={() => setEndShiftAgent(null)} disabled={busyInterfaces.includes(endShiftAgent?.interface ?? '')}>{t('common.cancel')}</Button>
            <Button disabled={busyInterfaces.includes(endShiftAgent?.interface ?? '')} onClick={() => { if (endShiftAgent) void endAgentShift(endShiftAgent).then(ok => { if (ok) setEndShiftAgent(null); }); }}>{t('callcenter.supervisor.bulk.endShift', 'End shift')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {density === 'table' && selectedAgents.length > 0 && (
        <BulkActionsBar
          selectedAgents={selectedAgents}
          onClear={clearRowSelection}
          onStartShift={(agent) => setShiftAgent(agent)}
        />
      )}

      <SupervisorJournalSheet
        section={journalSection}
        onSectionChange={openJournal}
        onClose={closeJournal}
        queueFilter={queueFilter}
      />

      <Dialog open={removeAgent != null} onOpenChange={(v) => { if (!v) setRemoveAgent(null); }}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>
              {t('callcenter.supervisor.confirmRemoveTitle', 'Remove operator?')}
            </DialogTitle>
          </DialogHeader>
          <Text>
            {t(
              'callcenter.supervisor.confirmRemoveBody',
              'Remove {{name}} from the supervised list?',
              { name: removeAgent ? agentLabelWithExt(removeAgent) : '' },
            )}
          </Text>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveAgent(null)}>
              {t('callcenter.supervisor.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmRemove()}>
              {t('callcenter.supervisor.removeAgent', 'Remove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <WatchlistSheet
        flat
        open={watchlistOpen}
        onOpenChange={open => { if (!savingWatchlist) setWatchlistOpen(open); }}
        candidates={accessScope?.candidates ?? []}
        agents={agents}
        queueLabel={attentionQueueLabel}
        selectedUserIds={draftUserIds}
        onSelectedChange={setDraftUserIds}
        onSave={() => void saveWatchlist()}
        saving={savingWatchlist}
        error={watchlistError}
      />

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
