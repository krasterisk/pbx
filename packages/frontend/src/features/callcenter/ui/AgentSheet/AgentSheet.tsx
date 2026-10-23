import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  ListPlus,
  LogIn,
  LogOut,
  Megaphone,
  Pause,
  Play,
  MessageSquare,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Flex,
  HStack,
  SegmentedControl,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Text,
  VStack,
} from '@/shared/ui';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { useLazyGetAgentDetailQuery } from '@/shared/api/endpoints/callCenterApi';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import type { AgentStatus, IAgent, ICall } from '@/features/callcenter/model/types/callCenterSchema';
import { selectCcQueues } from '@/features/callcenter/model/selectors/callCenterSelectors';
import {
  agentLabelWithExt,
  formatPauseReason,
  queueDisplayName,
} from '@/features/callcenter/lib/displayLabels';
import { formatCcDuration, formatPhone } from '@/features/callcenter/lib/ccFormat';
import { AgentTimeline } from '@/features/callcenter/ui/AgentTimeline/AgentTimeline';
import { StatusPill } from '@/features/callcenter/ui/StatusPill';
import styles from './AgentSheet.module.scss';

export interface AgentSheetProps {
  agent: IAgent | null;
  open: boolean;
  activeCall?: ICall;
  avatarSrc?: string;
  onClose: () => void;
  onNavigateAgent?: (direction: -1 | 1) => void;
  onStartShift?: (agent: IAgent) => void;
  onEndShift?: (agent: IAgent) => void;
  onPause?: (agent: IAgent) => void;
  onUnpause?: (agent: IAgent) => void;
  onOpenQueues?: (agent: IAgent) => void;
  onSpy?: (agent: IAgent, mode: 'spy' | 'whisper' | 'barge') => void;
  statusControl?: ReactNode;
}

type KpiScope = 'shift' | 'day';

function hasLiveInterface(iface: string | undefined): boolean {
  return Boolean(iface) && !String(iface).startsWith('user:');
}

/**
 * Non-modal supervisor operator side panel (U1.3).
 * Replaces `AgentDetailModal` so the agent board stays visible and clickable while inspecting an operator.
 */
export function AgentSheet({
  agent,
  open,
  activeCall,
  avatarSrc,
  onClose,
  onNavigateAgent,
  onStartShift,
  onEndShift,
  onPause,
  onUnpause,
  onOpenQueues,
  onSpy,
  statusControl,
}: AgentSheetProps) {
  const { t } = useTranslation();
  const isCompact = useIsMobile(1024);
  // Match the daily counters that lead into this detail panel from the Pulse table.
  const [kpiScope, setKpiScope] = useState<KpiScope>('day');
  const [fetchDetail, { data: detail, isLoading, isError, isFetching }] = useLazyGetAgentDetailQuery();
  const ccQueues = useSelector(selectCcQueues);
  const { data: queueList = [] } = useGetQueuesQuery(undefined, { skip: !open });

  const live = hasLiveInterface(agent?.interface);

  useEffect(() => {
    if (open && agent?.interface && live) {
      void fetchDetail({ interface: agent.interface });
    }
  }, [open, agent?.interface, live, fetchDetail]);

  useEffect(() => {
    if (!open || !onNavigateAgent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.target instanceof Element && e.target.closest('[role="menu"], input, textarea, select'))) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onNavigateAgent(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onNavigateAgent(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onNavigateAgent]);

  const queueLabelSources = useMemo(
    () => [
      ...ccQueues.map((q) => ({ name: q.name, displayName: q.displayName })),
      ...queueList.map((q) => ({
        name: q.name,
        displayName: q.display_name || q.name,
        exten: q.exten,
      })),
    ],
    [ccQueues, queueList],
  );

  // SSE status is fresher than the lazily fetched detail snapshot.
  const status = (agent?.status ?? detail?.stats.status ?? 'OFFLINE') as AgentStatus;
  const title = agent ? agentLabelWithExt(agent) : t('callcenter.supervisor.agentDetail.title', 'Agent details');
  const translate = (key: string, fallback?: string) => t(key, fallback ?? key);
  const pauseReason = formatPauseReason(detail?.stats.pauseReason ?? agent?.pauseReason, translate);

  const queuesLabel = useMemo(() => {
    const raw = detail?.stats.queues?.length ? detail.stats.queues : (agent?.queues ?? []);
    if (!raw.length) return '—';
    return raw.map((q) => queueDisplayName(q, queueLabelSources)).join(', ');
  }, [detail?.stats.queues, agent?.queues, queueLabelSources]);

  const showStartShift = !statusControl && Boolean(agent && agent.userId > 0 && (!live || status === 'OFFLINE'));
  const showEndShift = !statusControl && Boolean(agent && agent.userId > 0 && !showStartShift && live && status !== 'OFFLINE');
  const showPause = !statusControl && Boolean(live && status === 'READY');
  const showUnpause = !statusControl && Boolean(live && status === 'PAUSED');
  const showSpy = Boolean(live && (status === 'IN_CALL' || status === 'RINGING'));

  const stats = detail?.stats;
  const answeredVal = kpiScope === 'shift'
    ? (stats?.shiftAnswered ?? stats?.callsTaken ?? agent?.callsTaken ?? 0)
    : (stats?.dayAnswered ?? stats?.callsHandled ?? agent?.kpiDay?.answered ?? 0);
  const madeVal = kpiScope === 'shift'
    ? (stats?.shiftMade ?? stats?.callsMade ?? agent?.callsMade ?? 0)
    : (stats?.dayMade ?? agent?.kpiDay?.made ?? 0);
  const missedVal = kpiScope === 'shift'
    ? (stats?.shiftMissed ?? stats?.callsMissed ?? agent?.callsMissed ?? 0)
    : (stats?.dayMissed ?? agent?.kpiDay?.missed ?? 0);

  return (
    <Sheet open={open && agent != null} modal={isCompact} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        overlay={isCompact}
        className={styles.sheet}
        aria-describedby={undefined}
        data-testid="cc-agent-sheet"
      >
        <SheetHeader>
          <Flex align="center" justify="between" gap="8" className={styles.headerRow}>
            <HStack gap="8" align="center">
              {agent && <Avatar name={title} src={avatarSrc} size={32} />}
              <VStack gap="2">
                <SheetTitle>{title}</SheetTitle>
                {statusControl ?? <StatusPill
                  status={status}
                  label={pauseReason ? `${translate(`callcenter.status.${status.toLowerCase()}`, status)} (${pauseReason})` : undefined}
                  queuesDetached={agent?.queuesDetached ?? detail?.stats.queuesDetached}
                />}
              </VStack>
            </HStack>
            {onNavigateAgent && (
              <HStack gap="4">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onNavigateAgent(-1)}
                  aria-label="Previous agent"
                  data-testid="cc-agent-sheet-prev"
                >
                  <ChevronUp size={15} />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onNavigateAgent(1)}
                  aria-label="Next agent"
                  data-testid="cc-agent-sheet-next"
                >
                  <ChevronDown size={15} />
                </Button>
              </HStack>
            )}
          </Flex>
        </SheetHeader>

        <VStack gap="12" className={styles.body}>
          {agent && (
            <HStack gap="6" wrap="wrap" className={styles.actionsRow} data-testid="cc-agent-sheet-actions">
              {showStartShift && onStartShift && (
                <Button size="sm" onClick={() => onStartShift(agent)} data-testid="cc-agent-sheet-start-shift">
                  <LogIn size={14} />
                  {t('callcenter.supervisor.startShift', 'Start shift')}
                </Button>
              )}
              {showPause && onPause && (
                <Button size="sm" variant="outline" onClick={() => onPause(agent)} data-testid="cc-agent-sheet-pause">
                  <Pause size={14} />
                  {t('callcenter.supervisor.pause', 'Pause')}
                </Button>
              )}
              {showUnpause && onUnpause && (
                <Button size="sm" onClick={() => onUnpause(agent)} data-testid="cc-agent-sheet-unpause">
                  <Play size={14} />
                  {t('callcenter.supervisor.unpause', 'Resume')}
                </Button>
              )}
              {showSpy && onSpy && (
                <>
                  <Button size="sm" variant="outline" onClick={() => onSpy(agent, 'spy')} data-testid="cc-agent-sheet-spy">
                    <Eye size={14} />
                    {t('callcenter.supervisor.spy', 'Spy')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onSpy(agent, 'whisper')} data-testid="cc-agent-sheet-whisper">
                    <MessageSquare size={14} />
                    {t('callcenter.supervisor.whisper', 'Whisper')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onSpy(agent, 'barge')} data-testid="cc-agent-sheet-barge">
                    <Megaphone size={14} />
                    {t('callcenter.supervisor.barge', 'Barge')}
                  </Button>
                </>
              )}
              {live && onOpenQueues && (
                <Button size="sm" variant="outline" onClick={() => onOpenQueues(agent)} data-testid="cc-agent-sheet-queues">
                  <ListPlus size={14} />
                  {t('callcenter.supervisor.queueMgmt.queues', 'Queues')}
                </Button>
              )}
              {showEndShift && onEndShift && (
                <Button size="sm" variant="destructive" onClick={() => onEndShift(agent)} data-testid="cc-agent-sheet-end-shift">
                  <LogOut size={14} />
                  {t('callcenter.supervisor.bulk.endShift', 'End shift')}
                </Button>
              )}
            </HStack>
          )}

          {activeCall && (
            <VStack gap="4" className={styles.card} data-testid="cc-agent-sheet-call">
              <Text variant="xs">
                {t('callcenter.supervisor.inCall', 'In Call')}
                {' · '}
                {queueDisplayName(activeCall.queue, queueLabelSources)}
              </Text>
              <Text variant="small">{formatPhone(activeCall.callerIdNum)}</Text>
            </VStack>
          )}

          <VStack gap="4" className={styles.card}>
            <Text variant="xs">{t('callcenter.supervisor.agentDetail.currentQueues', 'Queues')}</Text>
            <Text variant="small" data-testid="cc-agent-sheet-queues-list">{queuesLabel}</Text>
          </VStack>

          <Flex align="center" justify="between" gap="8">
            <Text variant="small">{t('callcenter.supervisor.agentDetail.title', 'Agent details')}</Text>
            <SegmentedControl<KpiScope>
              value={kpiScope}
              onChange={setKpiScope}
              ariaLabel="KPI period"
              options={[
                { value: 'shift', label: t('callcenter.kpi.modeShift', 'Shift') },
                { value: 'day', label: t('callcenter.kpi.modeDay', 'Day') },
              ]}
            />
          </Flex>

          {live && (isLoading || isFetching) && !detail ? (
            <div className={styles.statsGrid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : live && isError ? (
            <QueryErrorState
              message={t('callcenter.settings.loadError', 'Failed to load data')}
              onRetry={() => agent?.interface && fetchDetail({ interface: agent.interface })}
              retryLabel={t('callcenter.settings.retry', 'Retry')}
            />
          ) : (
            <div className={styles.statsGrid} data-testid="cc-agent-sheet-stats">
              <VStack gap="2" className={styles.statBox}>
                <Text variant="xs">{t('callcenter.supervisor.kpiIn', 'Inbound')}</Text>
                <Text className={styles.statValue}>{answeredVal}</Text>
              </VStack>
              <VStack gap="2" className={styles.statBox}>
                <Text variant="xs">{t('callcenter.supervisor.kpiOut', 'Outbound')}</Text>
                <Text className={styles.statValue}>{madeVal}</Text>
              </VStack>
              <VStack gap="2" className={styles.statBox}>
                <Text variant="xs">{t('callcenter.supervisor.kpiMissed', 'Missed')}</Text>
                <Text className={styles.statValue}>{missedVal}</Text>
              </VStack>
              <VStack gap="2" className={styles.statBox}>
                <Text variant="xs">{t('callcenter.supervisor.agentDetail.aht', 'AHT')}</Text>
                <Text className={styles.statValue}>{formatCcDuration(stats?.aht ?? 0)}</Text>
              </VStack>
              <VStack gap="2" className={styles.statBox}>
                <Text variant="xs">{t('callcenter.supervisor.agentDetail.occupancy', 'Occupancy')}</Text>
                <Text className={styles.statValue}>{`${stats?.occupancy ?? 0}%`}</Text>
              </VStack>
              <VStack gap="2" className={styles.statBox}>
                <Text variant="xs">{t('callcenter.supervisor.agentDetail.pauseTotal', 'Pause time')}</Text>
                <Text className={styles.statValue}>{formatCcDuration(stats?.pauseTotalSec ?? 0)}</Text>
              </VStack>
            </div>
          )}

          {detail?.segments && detail.segments.length > 0 && (
            <VStack gap="6" className={styles.card}>
              <Text variant="xs">{t('callcenter.supervisor.agentDetail.timeline', 'Day timeline')}</Text>
              <AgentTimeline segments={detail.segments} live />
            </VStack>
          )}
        </VStack>
      </SheetContent>
    </Sheet>
  );
}
