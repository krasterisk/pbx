import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { RowSelectionState } from '@tanstack/react-table';
import { BookOpen, History, PhoneOutgoing, BarChart3, LayoutGrid, List } from 'lucide-react';
import {
  VStack, Flex, Text, Button, SegmentedControl,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/shared/ui';
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
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useCallCenterSSE } from '@/features/callcenter/lib/useCallCenterSSE';
import { subscribeStatusClock } from '@/features/callcenter/lib/statusClock';
import { resolveKpiThresholds } from '@/features/callcenter/lib/kpiThresholds';
import { sortLiveCalls } from '@/features/callcenter/lib/liveCallTiming';
import { filterAndSortAgents } from '@/features/callcenter/lib/agentBoard';
import { myQueueNames } from '@/features/callcenter/lib/watchlistGroups';
import { AttentionFeed } from '@/features/callcenter/ui/AttentionFeed';
import { QueueTiles } from '@/features/callcenter/ui/QueueTiles';
import { useGetRecentQueueSlaQuery } from '@/shared/api/endpoints/callCenterReportsApi';
import { buildSlaTrends } from '@/features/callcenter/lib/queueTrend';
import { QueueIntradayPanel } from '@/features/callcenter/ui/QueueIntradayPanel';
import { ChatPanelHost } from '@/features/callcenter/ui/ChatPanel/ChatPanel';
import { QueueManagementModal } from '@/features/callcenter/ui/QueueManagementModal/QueueManagementModal';
import { PauseReasonModal } from '@/features/callcenter/ui/PauseReasonModal/PauseReasonModal';
import { BulkActionsBar } from '@/features/callcenter/ui/BulkActionsBar/BulkActionsBar';
import { setMonitorSession } from '@/features/callcenter/model/slice/callCenterSlice';
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
import { SupervisorKpiStrip } from './SupervisorKpiStrip';
import { SupervisorAgentsBoard, type AgentBoardDensity } from './SupervisorAgentsBoard';
import { SupervisorCallsPanel } from './SupervisorCallsPanel';
import { SupervisorQueueFilter } from './SupervisorQueueFilter';
import { SupervisorJournalSheet, type JournalSection } from './SupervisorJournalSheet';
import styles from './CallCenterSupervisorPage.module.scss';

type MobileSegment = 'agents' | 'calls' | 'queues';

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
  const [now, setNow] = useState(() => Date.now());
  const ticking = status !== 'OFFLINE' && Boolean(statusSince);

  useEffect(() => {
    if (!ticking) return;
    return subscribeStatusClock(() => setNow(Date.now()));
  }, [ticking]);

  if (status === 'OFFLINE' || !statusSince) return '-';
  const sinceMs = Date.parse(statusSince);
  if (!Number.isFinite(sinceMs)) return '-';
  return formatStatusElapsed(Math.max(0, Math.floor((now - sinceMs) / 1000)));
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
  const isMobile = useIsMobile(1024);
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialUrl] = useState(() => parseSupervisorUrl(searchParams));

  // URL view: agents/calls/queues = mobile segment, history/callbacks = journal sheet.
  const [view, setView] = useState<SupervisorViewId>(initialUrl.view);
  const [segment, setSegment] = useState<MobileSegment>(
    isJournalView(initialUrl.view) ? 'agents' : initialUrl.view,
  );
  const [groupBy, setGroupBy] = useState<SupervisorGroupBy>(initialUrl.group);
  const [sortBy, setSortBy] = useState<SupervisorSortBy>(initialUrl.sort);
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

  const showQueuesBlock = !isMobile || segment === 'queues';
  const showCallsBlock = !isMobile || segment === 'calls';
  const showAgentsBlock = !isMobile || segment === 'agents';

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

  const mineQueueTokens = useMemo(
    () => myQueueNames(watchedAgents).map((q) => normalizeToken(q) || q.toLowerCase()),
    [watchedAgents],
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

  const handleAttentionUnpause = useCallback((agentInterface: string) => {
    void supervisorForceUnpause({ agentInterface });
  }, [supervisorForceUnpause]);

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
    setDraftUserIds([...(watched?.userIds ?? [])]);
    setWatchlistOpen(true);
  }, [watched]);

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

  const handleSupervisorPauseSelect = useCallback((reason: string) => {
    if (!pauseAgent) return;
    void supervisorForcePause({
      agentInterface: pauseAgent.interface,
      reason: reason.trim() || undefined,
    });
    setPauseAgent(null);
  }, [pauseAgent, supervisorForcePause]);

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
  const closeJournal = useCallback(() => setView(segment), [segment]);

  const handleSegmentChange = useCallback((next: MobileSegment) => {
    setSegment(next);
    setView(next);
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
      onEndShift={(agent) => { void supervisorForceLogout({ agentInterface: agent.interface }); }}
      onPause={setPauseAgent}
      onUnpause={(agent) => { void supervisorForceUnpause({ agentInterface: agent.interface }); }}
      onSpy={(agent, mode) => { void startSpy(agent.interface, mode); }}
      onRemoveAgent={setRemoveAgent}
    />
  );

  return (
    <VStack gap="8" className={styles.wrapper} data-testid="cc-supervisor-responsive">
      <CcConnectionBanner />
      <CcPageHeader
        title={t('callcenter.supervisor.title', 'Supervisor Dashboard')}
        description={t('callcenter.supervisor.subtitle', 'Real-time call center monitoring')}
        data={connected ? 'live' : 'offline'}
        context={(
          <SupervisorQueueFilter
            options={queueFilterOptions}
            value={queueFilter}
            onChange={applyQueueFilter}
            mineTokens={mineQueueTokens}
          />
        )}
        actions={(
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="outline" data-testid="cc-journal-menu">
                  <BookOpen size={14} />
                  {t('callcenter.supervisor.cockpit.journal', 'Journal')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openJournal('history')} data-testid="cc-journal-history">
                  <History />
                  {t('callcenter.supervisor.cockpit.journalHistory', 'Call history')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openJournal('callbacks')} data-testid="cc-journal-callbacks">
                  <PhoneOutgoing />
                  {t('callcenter.supervisor.cockpit.journalCallbacks', 'Callback requests')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
        />
      </Flex>

      {isMobile && (
        <>
          {attentionFeed}
          <SegmentedControl<MobileSegment>
            ariaLabel={t('callcenter.supervisor.cockpit.segmentsLabel', 'Section')}
            value={segment}
            onChange={handleSegmentChange}
            options={[
              { value: 'agents', label: t('callcenter.supervisor.cockpit.segmentAgents', 'Operators') },
              { value: 'calls', label: t('callcenter.supervisor.cockpit.segmentCalls', 'Calls') },
              { value: 'queues', label: t('callcenter.supervisor.cockpit.segmentQueues', 'Queues') },
            ]}
          />
        </>
      )}

      <Flex className={styles.cockpit} data-testid="cc-supervisor-cockpit">
        {!isMobile && (
          <VStack gap="12" className={styles.rail} data-testid="cc-supervisor-rail">
            {attentionFeed}
            {showQueuesBlock && queuesBlock}
          </VStack>
        )}
        <VStack gap="12" className={styles.mainColumn} data-testid="cc-supervisor-main">
          {showCallsBlock && callsBlock}
          {showAgentsBlock && agentsBlock}
          {isMobile && segment === 'queues' && queuesBlock}
        </VStack>
      </Flex>

      <AgentSheet
        agent={detailAgent}
        open={detailAgent != null}
        activeCall={detailAgent ? (callByAgent.get(agentExten(detailAgent)) ?? callByAgent.get(detailAgent.interface.toLowerCase())) : undefined}
        avatarSrc={detailAgent ? agentAvatarSrc(detailAgent) : undefined}
        onClose={() => setSelectedRef(null)}
        onNavigateAgent={navigateAgent}
        onStartShift={setShiftAgent}
        onEndShift={(agent) => { void supervisorForceLogout({ agentInterface: agent.interface }); }}
        onPause={setPauseAgent}
        onUnpause={(agent) => { void supervisorForceUnpause({ agentInterface: agent.interface }); }}
        onOpenQueues={setQueueMgmtAgent}
        onSpy={(agent, mode) => { void startSpy(agent.interface, mode); }}
      />

      <QueueManagementModal
        agent={queueMgmtAgent}
        open={queueMgmtAgent != null}
        onClose={() => setQueueMgmtAgent(null)}
        allowedQueues={accessScope?.queues ?? null}
      />

      {pauseAgent && (
        <PauseReasonModal
          reasons={pauseReasons}
          quickPauseValue=""
          onClose={() => setPauseAgent(null)}
          onSelect={handleSupervisorPauseSelect}
        />
      )}

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
        open={watchlistOpen}
        onOpenChange={setWatchlistOpen}
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
