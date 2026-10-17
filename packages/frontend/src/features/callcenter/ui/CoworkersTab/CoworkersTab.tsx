import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/shared/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Headphones, PhoneOff, PhoneForwarded, Hand, Users, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Text, Popover, PopoverTrigger, PopoverContent, SegmentedControl,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button,
  Tooltip, Input, Select,
} from '@/shared/ui';
import {
  usePeerSpyMutation,
  useGetEffectivePermissionsQuery,
  useSupervisorHangupCallMutation,
  useAgentHangupMutation,
  useAgentPickCallMutation,
  useGetMyOperatorSettingsQuery,
} from '@/shared/api/endpoints/callCenterApi';
import { UserLevel, selectCurrentUser } from '@/entities/User';
import {
  selectCcAgents,
  selectCcCalls,
  selectCcQueues,
  selectMyAgent,
} from '@/features/callcenter/model/selectors/callCenterSelectors';
import {
  agentDisplayName,
  agentStatusColorFamily,
  coworkerActivityLabel,
  formatStatusElapsed,
} from '@/features/callcenter/lib/displayLabels';
import { resolveKpiTriple } from '@/features/callcenter/lib/kpiDisplay';
import {
  loadKpiDisplay,
  PANEL_PREFS_EVENT,
  type KpiDisplayMode,
  type AgentPanelView,
} from '@/features/callcenter/lib/agentPanelPrefs';
import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import { DroppableColleague, useDragTransfer } from '@/features/callcenter/ui/DragTransfer/DragTransfer';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import type { IAgent, AgentStatus } from '@/features/callcenter/model/types/callCenterSchema';
import type { SpyMode } from '@/shared/api/endpoints/callCenterApi';
import styles from './CoworkersTab.module.scss';

interface CoworkersTabProps {
  /** Whether the operator has an active call - enables click/drag-to-transfer on rows (D-21). */
  hasActiveCall: boolean;
  /** Panel KPI period - same preference as status bar (Day / Shift / Both). */
  kpiDisplay?: KpiDisplayMode;
  view?: AgentPanelView;
}

/** Presence follows shared status→color map - OUTBOUND_WORK is available (info), not busy-red. */
function presenceDotClass(status: AgentStatus): string {
  const family = agentStatusColorFamily(status);
  if (family === 'success') return styles.dotSuccess;
  if (family === 'warning') return styles.dotWarning;
  if (family === 'info') return styles.dotInfo;
  if (family === 'muted') return styles.dotMuted;
  return styles.dotDestructive;
}

/** Queue-idle or outbound-work peers can take a transfer. */
function canReceiveTransfer(status: AgentStatus, phoneOnline?: boolean): boolean {
  return phoneOnline !== false && (status === 'READY' || status === 'OUTBOUND_WORK');
}

function activityToneClass(tone: string): string {
  if (tone === 'warning') return styles.toneWarning;
  if (tone === 'success') return styles.toneSuccess;
  return '';
}

const SPY_MODES: { value: SpyMode; labelKey: string; fallback: string }[] = [
  { value: 'listen', labelKey: 'callcenter.coworkersTab.spy.listen', fallback: 'Listen' },
  { value: 'whisper', labelKey: 'callcenter.coworkersTab.spy.whisper', fallback: 'Whisper' },
  { value: 'barge', labelKey: 'callcenter.coworkersTab.spy.barge', fallback: 'Barge' },
];

/**
 * Coworkers tab - self + callable peers; desktop table / mobile cards.
 * OFFLINE (Invalid / unreachable) peers are hidden; self is always listed.
 */
export function CoworkersTab({ hasActiveCall, kpiDisplay: kpiDisplayProp, view }: CoworkersTabProps) {
  const { t } = useTranslation();
  const tLabel = (key: string, fallback = ''): string => t(key, fallback);
  const isMobile = useIsMobile(768);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('all');
  const [page, setPage] = useState(0);
  const currentUser = useSelector(selectCurrentUser);
  const myAgent = useSelector(selectMyAgent);
  const agents = useSelector(selectCcAgents);
  const calls = useSelector(selectCcCalls);
  const queues = useSelector(selectCcQueues);
  const [kpiDisplay, setKpiDisplay] = useState<KpiDisplayMode>(
    () => kpiDisplayProp ?? loadKpiDisplay(),
  );
  useEffect(() => {
    if (kpiDisplayProp) {
      setKpiDisplay(kpiDisplayProp);
      return;
    }
    const sync = () => setKpiDisplay(loadKpiDisplay());
    sync();
    window.addEventListener(PANEL_PREFS_EVENT, sync);
    return () => window.removeEventListener(PANEL_PREFS_EVENT, sync);
  }, [kpiDisplayProp]);

  const { data: permissions } = useGetEffectivePermissionsQuery();
  const { data: operatorSettings } = useGetMyOperatorSettingsQuery();

  const periodHint = kpiDisplay === 'both'
    ? t('callcenter.kpi.hint', 'Left: this shift · Right: since midnight')
    : kpiDisplay === 'day'
      ? t('callcenter.kpi.day', 'Since midnight')
      : t('callcenter.kpi.shift', 'This shift');

  const agentKpi = (agent: IAgent) => resolveKpiTriple(
    {
      answered: agent.callsTaken ?? 0,
      made: agent.callsMade ?? 0,
      missed: agent.callsMissed ?? 0,
    },
    {
      answered: agent.kpiDay?.answered ?? 0,
      made: agent.kpiDay?.made ?? 0,
      missed: agent.kpiDay?.missed ?? 0,
    },
    kpiDisplay,
  );
  const { requestTransfer } = useDragTransfer();
  const [peerSpy] = usePeerSpyMutation();
  const [supervisorHangupCall] = useSupervisorHangupCallMutation();
  const [agentHangup] = useAgentHangupMutation();
  const [agentPickCall] = useAgentPickCallMutation();

  const [spyTarget, setSpyTarget] = useState<string | null>(null);
  const [hangupTarget, setHangupTarget] = useState<IAgent | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const statusSinceRef = useRef<Record<string, { status: AgentStatus; at: number }>>({});

  const allColleagues = useMemo(() => {
    if (!myAgent) return [];
    const shared = agents.filter((a) => {
      if (a.interface === myAgent.interface) return true;
      // Empty own queues must not hide self; peers still need a shared queue.
      if (!myAgent.queues.length) return false;
      return a.queues.some((q) => myAgent.queues.includes(q));
    });
    const visible = shared.filter((a) => {
      if (a.interface === myAgent.interface) return true;
      // Invalid / unreachable endpoints cannot take calls - hide from list
      return a.status !== 'OFFLINE';
    });
    return visible.sort((a, b) => {
      if (a.interface === myAgent.interface) return -1;
      if (b.interface === myAgent.interface) return 1;
      const aReady = canReceiveTransfer(a.status, a.phoneOnline);
      const bReady = canReceiveTransfer(b.status, b.phoneOnline);
      if (aReady !== bReady) return aReady ? -1 : 1;
      return agentDisplayName(a).localeCompare(agentDisplayName(b), undefined, { numeric: true });
    });
  }, [agents, myAgent]);

  const colleagues = useMemo(() => allColleagues.filter((a) => {
    if (availability === 'available' && !canReceiveTransfer(a.status, a.phoneOnline)) return false;
    if (availability === 'busy' && !['IN_CALL', 'RINGING', 'DIALING', 'CONSULT'].includes(a.status)) return false;
    return `${agentDisplayName(a)} ${interfaceToExtension(a.interface)}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  }), [allColleagues, search, availability]);
  const pageCount = Math.max(1, Math.ceil(colleagues.length / 20));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleColleagues = colleagues.slice(currentPage * 20, (currentPage + 1) * 20);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(container);
    return () => observer.disconnect();
  }, [allColleagues.length]);

  useEffect(() => {
    const map = statusSinceRef.current;
    const seen = new Set<string>();
    for (const agent of colleagues) {
      seen.add(agent.interface);
      const prev = map[agent.interface];
      const serverMs = agent.statusSince ? Date.parse(agent.statusSince) : NaN;
      if (Number.isFinite(serverMs)) {
        map[agent.interface] = { status: agent.status, at: serverMs };
      } else if (!prev || prev.status !== agent.status) {
        map[agent.interface] = { status: agent.status, at: Date.now() };
      }
    }
    for (const key of Object.keys(map)) {
      if (!seen.has(key)) delete map[key];
    }
  }, [colleagues]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const isSupervisor = [UserLevel.SUPERADMIN, UserLevel.ADMIN, UserLevel.SUPERVISOR].includes(currentUser?.level ?? -1);
  const pickupEnabled = Boolean(operatorSettings?.pickup_enabled);
  const iAmReady = myAgent?.status === 'READY' && myAgent.phoneOnline !== false;

  const handleSpyMode = async (targetInterface: string, mode: SpyMode) => {
    setSpyTarget(null);
    try {
      await peerSpy({ targetInterface, mode }).unwrap();
    } catch (err: any) {
      console.warn('Peer spy failed:', err?.data?.message || err?.message);
    }
  };

  const confirmHangup = async () => {
    if (!hangupTarget) return;
    const isSelf = hangupTarget.interface === myAgent?.interface;
    try {
      if (isSelf) {
        await agentHangup().unwrap();
      } else if (hangupTarget.currentCall) {
        await supervisorHangupCall({ uniqueid: hangupTarget.currentCall }).unwrap();
      }
    } catch (err: any) {
      console.warn('Hangup failed:', err?.data?.message || err?.message);
    }
    setHangupTarget(null);
  };

  const handleIntercept = async (agent: IAgent) => {
    if (!agent.currentCall) return;
    try {
      await agentPickCall({ uniqueid: agent.currentCall }).unwrap();
    } catch (err: any) {
      console.warn('Intercept failed:', err?.data?.message || err?.message);
    }
  };

  if (allColleagues.length === 0) {
    return (
      <div className={styles.wrap} ref={containerRef}>
        <div className={styles.empty}>
          <Users className="w-8 h-8 opacity-30" />
          <Text className="font-semibold">{t('callcenter.coworkersTab.emptyTitle', 'No coworkers online')}</Text>
          <Text variant="muted" className="text-sm">
            {myAgent
              ? t('callcenter.coworkersTab.emptyBody', 'Agents sharing your queues will appear here')
              : t('callcenter.coworkersTab.emptyBodyStartShift', 'Start a shift to see yourself and coworkers')}
          </Text>
        </div>
      </div>
    );
  }

  const renderActions = (agent: IAgent, isSelf: boolean) => {
    const canClickTransfer = hasActiveCall && canReceiveTransfer(agent.status, agent.phoneOnline) && !isSelf;
    const canSpy = !!permissions?.can_spy && agent.status === 'IN_CALL';
    const canHangup = isSelf
      ? (agent.status === 'IN_CALL' || agent.status === 'DIALING' || agent.status === 'RINGING' || !!agent.currentCall)
      : (isSupervisor && !!agent.currentCall);
    const canIntercept = !isSelf
      && pickupEnabled
      && iAmReady
      && (agent.status === 'RINGING' || agent.status === 'DIALING')
      && !!agent.currentCall;

    return (
      <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
        {canClickTransfer && (
          <Tooltip content={t('callcenter.coworkersTab.transferHint', 'Transfer active call')}>
            <Button
              type="button"
              variant="unstyled"
              size="none"
              className={styles.iconBtn}
              aria-label={t('callcenter.coworkersTab.transferAria', 'Transfer to {{name}}', { name: agentDisplayName(agent) })}
              onClick={() => requestTransfer(agent)}
            >
              <PhoneForwarded className="w-4 h-4" />
            </Button>
          </Tooltip>
        )}
        {canIntercept && (
          <Tooltip content={t('callcenter.coworkersTab.interceptHint', 'Take this ringing call')}>
            <Button
              type="button"
              variant="unstyled"
              size="none"
              className={styles.iconBtn}
              aria-label={t('callcenter.coworkersTab.interceptAria', 'Intercept {{name}}', { name: agentDisplayName(agent) })}
              onClick={() => void handleIntercept(agent)}
            >
              <Hand className="w-4 h-4" />
            </Button>
          </Tooltip>
        )}
        {canSpy && (
          <Popover open={spyTarget === agent.interface} onOpenChange={(open) => setSpyTarget(open ? agent.interface : null)}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="unstyled"
                size="none"
                className={styles.iconBtn}
                aria-label={t('callcenter.coworkersTab.spyAria', 'Listen in on {{name}}', { name: agentDisplayName(agent) })}
              >
                <Headphones className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="end">
              <div className={styles.spyPicker}>
                <Text className="text-xs font-semibold">
                  {t('callcenter.coworkersTab.spyPickerTitle', 'ChanSpy mode')}
                </Text>
                <SegmentedControl
                  value=""
                  onChange={(mode) => handleSpyMode(agent.interface, mode as SpyMode)}
                  options={SPY_MODES.map((m) => ({
                    value: m.value,
                    label: t(m.labelKey, m.fallback),
                    disabled: !permissions?.spy_modes?.includes(m.value),
                    tooltipContent: !permissions?.spy_modes?.includes(m.value)
                      ? t('callcenter.coworkersTab.spyModeBlocked', 'This mode is not granted to you')
                      : undefined,
                  }))}
                />
              </div>
            </PopoverContent>
          </Popover>
        )}
        {canHangup && (
          <Button
            type="button"
            variant="unstyled"
            size="none"
            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
            aria-label={t('callcenter.coworkersTab.hangupAria', "Hang up {{name}}'s call", { name: agentDisplayName(agent) })}
            onClick={() => setHangupTarget(agent)}
          >
            <PhoneOff className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  };

  const hangupDialog = (
    <Dialog open={!!hangupTarget} onOpenChange={(open) => !open && setHangupTarget(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('callcenter.coworkersTab.hangupConfirmTitle', "Hang up {{name}}'s call?", {
              name: hangupTarget ? agentDisplayName(hangupTarget) : '',
            })}
          </DialogTitle>
        </DialogHeader>
        <Text variant="muted" className="text-sm">
          {t('callcenter.coworkersTab.hangupConfirmBody', 'This ends the call immediately for both parties.')}
        </Text>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button variant="destructive" onClick={confirmHangup} className="w-full">
            {t('callcenter.coworkersTab.hangupConfirmAction', 'Hang up')}
          </Button>
          <Button variant="ghost" onClick={() => setHangupTarget(null)} className="w-full">
            {t('callcenter.dnd.cancel', 'Cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const searchTools = allColleagues.length > 6 || searchOpen ? (
    <div className={styles.searchTools}>
      {(searchOpen || allColleagues.length > 12) && <Input
        autoFocus
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        aria-label={t('callcenter.coworkersSearch', 'Find a coworker')}
        placeholder={t('callcenter.coworkersSearch', 'Find a coworker')}
      />}
      {allColleagues.length <= 12 && <Button
        size="icon"
        variant="ghost"
        aria-label={t(searchOpen ? 'common.close' : 'callcenter.coworkersSearch', searchOpen ? 'Close' : 'Find a coworker')}
        onClick={() => { setSearchOpen(!searchOpen); setSearch(''); }}
      >
        {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
      </Button>}
      {allColleagues.length > 12 && <Select
        value={availability}
        aria-label={t('callcenter.coworkersAvailability', 'Coworker availability')}
        onChange={(e) => { setAvailability(e.target.value); setPage(0); }}
      >
        <option value="all">{t('callcenter.coworkersAll', 'All coworkers')}</option>
        <option value="available">{t('callcenter.coworkersAvailable', 'Available for transfer')}</option>
        <option value="busy">{t('callcenter.coworkersBusy', 'In a call or dialing')}</option>
      </Select>}
    </div>
  ) : null;
  const listFooter = allColleagues.length > 12 ? <div className={styles.pagination}>
    <Text variant="muted">{colleagues.length ? currentPage * 20 + 1 : 0}–{Math.min((currentPage + 1) * 20, colleagues.length)} / {colleagues.length}</Text>
    {pageCount > 1 && <>
      <Button size="icon" variant="ghost" disabled={currentPage === 0} aria-label={t('callcenter.coworkersPrevious', 'Previous coworkers')} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="w-4 h-4" /></Button>
      <Button size="icon" variant="ghost" disabled={currentPage + 1 >= pageCount} aria-label={t('callcenter.coworkersNext', 'Next coworkers')} onClick={() => setPage(currentPage + 1)}><ChevronRight className="w-4 h-4" /></Button>
    </>}
  </div> : null;

  if (isMobile || view === 'cards' || (!view && containerWidth > 0 && containerWidth < 760)) {
    return (
      <div className={styles.wrap} data-testid="coworkers-tab" ref={containerRef}>
        {searchTools}
        {!colleagues.length && <Text role="status">{t('callcenter.coworkersNoResults', 'No coworkers found')}</Text>}
        <div className={styles.cardGrid}>
          {visibleColleagues.map((agent) => {
            const isSelf = agent.interface === myAgent?.interface;
            const canClickTransfer = hasActiveCall && canReceiveTransfer(agent.status, agent.phoneOnline) && !isSelf;
            const since = statusSinceRef.current[agent.interface]?.at ?? nowTick;
            const elapsed = Math.max(0, Math.floor((nowTick - since) / 1000));
            const call = agent.currentCall
              ? calls.find((c) => c.uniqueid === agent.currentCall)
              : undefined;
            const liveCall = call
              ?? calls.find(
                (c) =>
                  c.agent === agent.interface
                  && (c.status === 'TALKING' || c.status === 'HOLD' || c.status === 'RINGING'),
              );
            const activity = coworkerActivityLabel(agent, liveCall, queues, tLabel);
            const kpi = agentKpi(agent);

            return (
              <DroppableColleague
                key={agent.interface}
                agent={agent}
                className={`${styles.card} ${canClickTransfer ? styles.rowClickable : ''}${isSelf ? ` ${styles.selfCard}` : ''}`}
                onColleagueClick={canClickTransfer ? () => requestTransfer(agent) : undefined}
              >
                <div className={styles.cardTop}>
                  <span className={`${styles.dot} ${presenceDotClass(agent.status)}`} />
                  <span className={styles.name}>
                    {agentDisplayName(agent)}
                    <span className={styles.extInline}>
                      ({interfaceToExtension(agent.interface)})
                    </span>
                    {isSelf ? (
                      <span className={styles.selfBadge}>{t('callcenter.coworkersTab.you', 'You')}</span>
                    ) : null}
                  </span>
                </div>
                <span className={styles.meta}>
                  <span className={activityToneClass(activity.tone)}>{activity.text}</span>
                  <span>·</span>
                  <span className={styles.timer}>{formatStatusElapsed(elapsed)}</span>
                </span>
                <span className={styles.kpiLine} title={periodHint}>
                  <Tooltip content={`${t('callcenter.coworkersTab.answeredHint', 'Incoming answered')} (${periodHint})`}>
                    <span>{t('callcenter.kpi.answered', 'Answered')}: {kpi.answered}</span>
                  </Tooltip>
                  <span className={styles.metaSep}>·</span>
                  <Tooltip content={`${t('callcenter.coworkersTab.madeHint', 'Outbound answered')} (${periodHint})`}>
                    <span>{t('callcenter.kpi.made', 'Made')}: {kpi.made}</span>
                  </Tooltip>
                  <span className={styles.metaSep}>·</span>
                  <Tooltip content={`${t('callcenter.coworkersTab.missedHint', 'Missed calls')} (${periodHint})`}>
                    <span>{t('callcenter.kpi.missed', 'Missed')}: {kpi.missed}</span>
                  </Tooltip>
                  <span className={styles.metaSep}>·</span>
                  <Tooltip content={`${t('callcenter.coworkersTab.totalHint', 'Answered + made')} (${periodHint})`}>
                    <span>
                      {t('callcenter.coworkersTab.total', 'Calls')}:{' '}
                      {kpi.total}
                    </span>
                  </Tooltip>
                </span>
                {renderActions(agent, isSelf)}
              </DroppableColleague>
            );
          })}
        </div>
        {listFooter}
        {hangupDialog}
      </div>
    );
  }

  return (
    <div className={styles.wrap} data-testid="coworkers-tab" ref={containerRef}>
      {searchTools}
      {!colleagues.length && <Text role="status">{t('callcenter.coworkersNoResults', 'No coworkers found')}</Text>}
      <div className={styles.tableWrap}>
        <Table className={styles.table} surface={false} showSearch={false} showExport={false}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('callcenter.coworkersTab.colAgent', 'Agent')}</TableHead>
              <TableHead>{t('callcenter.coworkersTab.colStatus', 'Status')}</TableHead>
              <TableHead>
                {periodHint}
              </TableHead>
              <TableHead aria-label={t('callcenter.coworkersTab.colActions', 'Actions')} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleColleagues.map((agent) => {
              const isSelf = agent.interface === myAgent?.interface;
              const canClickTransfer = hasActiveCall && canReceiveTransfer(agent.status, agent.phoneOnline) && !isSelf;
              const since = statusSinceRef.current[agent.interface]?.at ?? nowTick;
              const elapsed = Math.max(0, Math.floor((nowTick - since) / 1000));
              const call = agent.currentCall
                ? calls.find((c) => c.uniqueid === agent.currentCall)
                : undefined;
              const liveCall = call
                ?? calls.find(
                  (c) =>
                    c.agent === agent.interface
                    && (c.status === 'TALKING' || c.status === 'HOLD' || c.status === 'RINGING'),
                );
              const activity = coworkerActivityLabel(agent, liveCall, queues, tLabel);
              const kpi = agentKpi(agent);
              const ext = interfaceToExtension(agent.interface);

              return (
                <DroppableColleague
                  key={agent.interface}
                  agent={agent}
                  as="tr"
                  className={`${canClickTransfer ? styles.rowClickable : ''}${isSelf ? ` ${styles.selfRow}` : ''}`}
                  onColleagueClick={canClickTransfer ? () => requestTransfer(agent) : undefined}
                >
                  <TableCell className={styles.nameCell}>
                    <span className={`${styles.dot} ${presenceDotClass(agent.status)}`} />
                    <span className={styles.name}>
                      {agentDisplayName(agent)}
                      <span className={styles.extInline}>({ext})</span>
                    </span>
                    {isSelf ? (
                      <span className={styles.selfBadge}>{t('callcenter.coworkersTab.you', 'You')}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className={activityToneClass(activity.tone)}>
                    {activity.text}
                    <div className={styles.meta}>{formatStatusElapsed(elapsed)}</div>
                  </TableCell>
                  <TableCell className={styles.kpiCell}>
                    <div className={styles.kpiLine}>
                      <span>{t('callcenter.kpi.answered', 'Answered')}: {kpi.answered}</span>
                      <span>· {t('callcenter.kpi.made', 'Made')}: {kpi.made}</span>
                      <span>· {t('callcenter.kpi.missed', 'Missed')}: {kpi.missed}</span>
                    </div>
                  </TableCell>
                  <TableCell className={styles.actionsCell}>{renderActions(agent, isSelf)}</TableCell>
                </DroppableColleague>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {listFooter}
      {hangupDialog}
    </div>
  );
}
