import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import {
  AlertTriangle,
  Eye,
  Info,
  LayoutGrid,
  List,
  ListPlus,
  LogIn,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  Table2,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Flex,
  HStack,
  Input,
  Label,
  SegmentedControl,
  Select,
  Table,
  Text,
  VStack,
} from '@/shared/ui';
import type { IAgent, ICall, IPauseReason, IQueueStats } from '@/features/callcenter/model/types/callCenterSchema';
import {
  computeAgentStatusCounts,
  evaluateAgentOverrun,
  filterAndSortAgents,
  groupAgents,
  type AgentStatusBucket,
} from '@/features/callcenter/lib/agentBoard';
import { agentLabelWithExt, queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import { useNowTick } from '@/features/callcenter/lib/useNowTick';
import { StatusPill } from '@/features/callcenter/ui/StatusPill';
import type { SupervisorGroupBy, SupervisorSortBy } from '@/features/callcenter/lib/supervisorUrlState';
import styles from './CallCenterSupervisorPage.module.scss';

export type AgentBoardDensity = 'grid' | 'compact' | 'table';

export interface SupervisorAgentsBoardProps {
  agents: readonly IAgent[];
  watchedCount: number;
  queues: readonly IQueueStats[];
  calls: readonly ICall[];
  pauseReasons: ReadonlyArray<Pick<IPauseReason, 'name' | 'max_duration'>>;
  density: AgentBoardDensity;
  onDensityChange: (next: AgentBoardDensity) => void;
  groupBy: SupervisorGroupBy;
  onGroupByChange: (next: SupervisorGroupBy) => void;
  sortBy: SupervisorSortBy;
  onSortByChange: (next: SupervisorSortBy) => void;
  showActiveOnly: boolean;
  onShowActiveOnlyChange: (next: boolean) => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  agentAvatarSrc: (agent: IAgent) => string | undefined;
  agentActivity: (agent: IAgent) => { text: string };
  renderElapsed: (agent: IAgent) => React.ReactNode;
  onOpenWatchlist: () => void;
  onClearQueueFilter?: () => void;
  onOpenAgent: (agent: IAgent) => void;
  onOpenQueues: (agent: IAgent) => void;
  onStartShift: (agent: IAgent) => void;
  onEndShift: (agent: IAgent) => void;
  onPause: (agent: IAgent) => void;
  onUnpause: (agent: IAgent) => void;
  onSpy: (agent: IAgent, mode: 'spy' | 'whisper' | 'barge') => void;
  onRemoveAgent: (agent: IAgent) => void;
}

function hasLiveAgentInterface(iface: string): boolean {
  return Boolean(iface) && !iface.startsWith('user:');
}

const VIRTUAL_THRESHOLD = 48;

export function SupervisorAgentsBoard({
  agents,
  watchedCount,
  queues,
  calls,
  pauseReasons,
  density,
  onDensityChange,
  groupBy,
  onGroupByChange,
  sortBy,
  onSortByChange,
  showActiveOnly,
  onShowActiveOnlyChange,
  rowSelection,
  onRowSelectionChange,
  agentAvatarSrc,
  agentActivity,
  renderElapsed,
  onOpenWatchlist,
  onClearQueueFilter,
  onOpenAgent,
  onOpenQueues,
  onStartShift,
  onEndShift,
  onPause,
  onUnpause,
  onSpy,
  onRemoveAgent,
}: SupervisorAgentsBoardProps) {
  const { t } = useTranslation();
  const nowMs = useNowTick();
  const [search, setSearch] = useState('');
  const [statusBucket, setStatusBucket] = useState<AgentStatusBucket>('all');
  const scrollParentRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(
    () => computeAgentStatusCounts(agents, pauseReasons, queues, calls, nowMs),
    [agents, pauseReasons, queues, calls, nowMs],
  );

  const filteredSorted = useMemo(
    () => filterAndSortAgents(agents, { search, statusBucket, sortBy, nowMs }),
    [agents, search, statusBucket, sortBy, nowMs],
  );

  const groups = useMemo(
    () =>
      groupAgents(filteredSorted, groupBy, queues, {
        ready: t('callcenter.supervisor.board.bucketReady', 'Ready'),
        busy: t('callcenter.supervisor.board.bucketBusy', 'In call'),
        wrapup: t('callcenter.supervisor.board.bucketWrapup', 'Wrap-up'),
        paused: t('callcenter.supervisor.board.bucketPaused', 'Paused'),
        offline: t('callcenter.supervisor.board.bucketOffline', 'Offline'),
        noQueue: t('callcenter.supervisor.board.noQueue', 'Without queue'),
      }),
    [filteredSorted, groupBy, queues, t],
  );

  // Keep the scroll container mounted while searching a large directory.
  // Tearing it down for one result makes clearing search rebuild all observers.
  const useVirtual = density !== 'table' && groupBy === 'none' && agents.length > VIRTUAL_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: useVirtual ? filteredSorted.length : 0,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => (density === 'compact' ? 80 : 200),
    getItemKey: (index) => filteredSorted[index]?.interface ?? index,
    overscan: 8,
  });

  const renderActions = (agent: IAgent) => {
    const live = hasLiveAgentInterface(agent.interface);
    const showStartShift = agent.userId > 0 && (!live || agent.status === 'OFFLINE');
    const showEndShift = agent.userId > 0 && !showStartShift && live && agent.status !== 'OFFLINE';
    const showPause = live && agent.status === 'READY';
    const showUnpause = live && agent.status === 'PAUSED';
    const showSpy = live && (agent.status === 'IN_CALL' || agent.status === 'RINGING');
    const stopRow = (e: { stopPropagation: () => void }) => e.stopPropagation();

    return (
      <div className={styles.agentActions} onClick={stopRow} onKeyDown={stopRow} data-table-actions>
        {showStartShift && (
          <Button
            type="button"
            variant="unstyled"
            size="none"
            className={styles.agentActionBtn}
            onClick={() => onStartShift(agent)}
            title={t('callcenter.supervisor.startShift', 'Start shift')}
          >
            <LogIn className="w-3 h-3 inline mr-0.5" />
            {t('callcenter.supervisor.startShift', 'Start shift')}
          </Button>
        )}
        {showPause && (
          <Button
            type="button"
            variant="unstyled"
            size="none"
            className={`${styles.agentActionBtn} ${styles.agentActionPause}`}
            onClick={() => onPause(agent)}
            title={t('callcenter.supervisor.pause', 'Pause')}
          >
            <Pause className="w-3 h-3 inline mr-0.5" />
            {t('callcenter.supervisor.pause', 'Pause')}
          </Button>
        )}
        {showUnpause && (
          <Button
            type="button"
            variant="unstyled"
            size="none"
            className={styles.agentActionBtn}
            onClick={() => onUnpause(agent)}
            title={t('callcenter.supervisor.unpause', 'Resume')}
          >
            <Play className="w-3 h-3 inline mr-0.5" />
            {t('callcenter.supervisor.unpause', 'Resume')}
          </Button>
        )}
        {showEndShift && (
          <Button
            type="button"
            variant="unstyled"
            size="none"
            className={`${styles.agentActionBtn} ${styles.agentActionDanger}`}
            onClick={() => onEndShift(agent)}
            title={t('callcenter.supervisor.bulk.endShift', 'End shift')}
          >
            {t('callcenter.supervisor.bulk.endShift', 'End shift')}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="unstyled"
              size="none"
              className={styles.agentActionMore}
              title={t('callcenter.supervisor.moreActions', 'Actions')}
              aria-label={t('callcenter.supervisor.moreActions', 'Actions')}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={stopRow}>
            <DropdownMenuItem onClick={() => onOpenAgent(agent)}>
              <Info />
              {t('callcenter.supervisor.agentDetail.title', 'Agent details')}
            </DropdownMenuItem>
            {live && (
              <DropdownMenuItem onClick={() => onOpenQueues(agent)}>
                <ListPlus />
                {t('callcenter.supervisor.queueMgmt.queues', 'Queues')}
              </DropdownMenuItem>
            )}
            {showSpy && (
              <>
                <DropdownMenuItem onClick={() => onSpy(agent, 'spy')}>
                  <Eye />
                  {t('callcenter.supervisor.spy', 'Spy')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSpy(agent, 'whisper')}>
                  <MessageSquare />
                  {t('callcenter.supervisor.whisper', 'Whisper')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSpy(agent, 'barge')}>
                  <Megaphone />
                  {t('callcenter.supervisor.barge', 'Barge')}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onRemoveAgent(agent)}
            >
              <Trash2 />
              {t('callcenter.supervisor.removeAgent', 'Remove')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const renderCard = (agent: IAgent) => {
    const activity = agentActivity(agent);
    const overrunState = evaluateAgentOverrun(agent, pauseReasons, queues, calls, nowMs);
    return (
      <div
        key={agent.interface}
        className={`${styles.agentCard} ${density === 'compact' ? styles.agentCardCompact : ''}`.trim()}
        data-testid={`supervisor-agent-card-${agent.interface}`}
        data-overrun={overrunState.overrun ? 'true' : undefined}
      >
        <Button
          type="button"
          variant="unstyled"
          size="none"
          className={styles.agentCardHeader}
          onClick={() => onOpenAgent(agent)}
        >
          <Avatar
            name={agentLabelWithExt(agent)}
            src={agentAvatarSrc(agent)}
            size={24}
          />
          <span className={styles.agentName}>{agentLabelWithExt(agent)}</span>
        </Button>
        <StatusPill
          status={agent.status}
          phoneOnline={agent.phoneOnline}
          label={activity.text}
          queuesDetached={agent.queuesDetached}
          overrun={overrunState.overrun}
          timer={renderElapsed(agent)}
        />
        {density !== 'compact' && (
          <>
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
          </>
        )}
        {renderActions(agent)}
      </div>
    );
  };

  const agentColumns = useMemo<ColumnDef<IAgent>[]>(() => [
    {
      id: 'status',
      header: t('callcenter.supervisor.status', 'Status'),
      cell: ({ row }) => {
        const activity = agentActivity(row.original);
        const overrunState = evaluateAgentOverrun(row.original, pauseReasons, queues, calls, nowMs);
        return (
          <StatusPill
            status={row.original.status}
            phoneOnline={row.original.phoneOnline}
            label={activity.text}
            queuesDetached={row.original.queuesDetached}
            overrun={overrunState.overrun}
          />
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
          {renderElapsed(row.original)}
        </span>
      ),
    },
    {
      id: 'name',
      header: t('callcenter.supervisor.agent_lbl', 'Agent'),
      cell: ({ row }) => (
        <Button
          type="button"
          variant="unstyled"
          size="none"
          className={styles.agentCardHeader}
          onClick={() => onOpenAgent(row.original)}
        >
          <Avatar
            name={agentLabelWithExt(row.original)}
            src={agentAvatarSrc(row.original)}
            size={24}
          />
          <span>{agentLabelWithExt(row.original)}</span>
        </Button>
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
      cell: ({ row }) => renderActions(row.original),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, agentActivity, agentAvatarSrc, queues, pauseReasons, calls, nowMs]);

  const statusChips: Array<{ id: AgentStatusBucket; label: string; count: number; warn?: number }> = [
    { id: 'all', label: t('callcenter.supervisor.board.bucketAll', 'All'), count: counts.total },
    { id: 'ready', label: t('callcenter.supervisor.board.bucketReady', 'Ready'), count: counts.ready },
    { id: 'busy', label: t('callcenter.supervisor.board.bucketBusy', 'In call'), count: counts.busy },
    { id: 'wrapup', label: t('callcenter.supervisor.board.bucketWrapup', 'Wrap-up'), count: counts.wrapup },
    { id: 'paused', label: t('callcenter.supervisor.board.bucketPaused', 'Paused'), count: counts.paused, warn: counts.pausedOverrun },
    { id: 'offline', label: t('callcenter.supervisor.board.bucketOffline', 'Offline'), count: counts.offline },
  ];

  return (
    <VStack gap="12" data-testid="supervisor-agents-board">
      {watchedCount > 0 && <>
      <Flex justify="between" align="center" wrap="wrap" gap="8">
        <HStack gap="6" wrap="wrap" data-testid="supervisor-status-chips">
          {statusChips.map((chip) => {
            const active = statusBucket === chip.id;
            return (
              <Button
                key={chip.id}
                type="button"
                variant="unstyled"
                size="none"
                className={`${styles.queueChip} ${active ? styles.queueChipActive : ''}`}
                onClick={() => setStatusBucket(chip.id)}
                data-testid={`supervisor-status-chip-${chip.id}`}
              >
                {chip.label}: {chip.count}
                {chip.warn && chip.warn > 0 ? (
                  <Text as="span" variant="xs" className="ml-1 text-destructive">
                    <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                    {chip.warn}
                  </Text>
                ) : null}
              </Button>
            );
          })}
        </HStack>

        <HStack gap="8" wrap="wrap">
          <Button variant="outline" size="sm" onClick={onOpenWatchlist} data-testid="supervisor-manage-watchlist">
            <UserPlus className="w-4 h-4 mr-1.5" />
            {t('callcenter.supervisor.manageAgents', 'Manage list')}
          </Button>
        </HStack>
      </Flex>

      <Flex justify="between" align="center" wrap="wrap" gap="8">
        <HStack gap="8" wrap="wrap" className={styles.boardFilters}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('callcenter.supervisor.board.searchPlaceholder', 'Search by name or extension…')}
            aria-label={t('callcenter.supervisor.board.searchPlaceholder', 'Search by name or extension…')}
            className={styles.boardSearch}
            data-testid="supervisor-board-search"
          />
          <Select
            value={groupBy}
            onChange={(e) => onGroupByChange(e.target.value as SupervisorGroupBy)}
            aria-label={t('callcenter.supervisor.board.groupBy', 'Group by')}
            className={styles.boardSelect}
            data-testid="supervisor-board-group"
          >
            <option value="none">{t('callcenter.supervisor.board.groupNone', 'No grouping')}</option>
            <option value="status">{t('callcenter.supervisor.board.groupStatus', 'By status')}</option>
            <option value="queue">{t('callcenter.supervisor.board.groupQueue', 'By queue')}</option>
          </Select>
          <Select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as SupervisorSortBy)}
            aria-label={t('callcenter.supervisor.board.sortBy', 'Sort by')}
            className={styles.boardSelect}
            data-testid="supervisor-board-sort"
          >
            <option value="time">{t('callcenter.supervisor.board.sortTime', 'By time in status')}</option>
            <option value="name">{t('callcenter.supervisor.board.sortName', 'By name')}</option>
            <option value="missed">{t('callcenter.supervisor.board.sortMissed', 'By missed calls')}</option>
          </Select>
        </HStack>

        <HStack gap="12" wrap="wrap" align="center">
          <Label className="flex items-center gap-2 cursor-pointer text-sm font-normal">
            <Checkbox
              checked={showActiveOnly}
              onChange={(e) => onShowActiveOnlyChange(e.target.checked)}
            />
            {t('callcenter.supervisor.showActiveOnly', 'Show active only')}
          </Label>
          <SegmentedControl<AgentBoardDensity>
            ariaLabel={t('callcenter.supervisor.viewToggle', 'Agent view')}
            value={density}
            onChange={onDensityChange}
            options={[
              { value: 'grid', icon: LayoutGrid, label: t('callcenter.supervisor.viewGrid', 'Grid') },
              { value: 'compact', icon: List, label: t('callcenter.supervisor.board.viewCompact', 'Compact') },
              { value: 'table', icon: Table2, label: t('callcenter.supervisor.viewTable', 'Table') },
            ]}
          />
        </HStack>
      </Flex>

      </>}
      {filteredSorted.length === 0 ? (
        <div className={styles.emptyState}>
          <Users className="w-10 h-10 opacity-30" />
          {watchedCount > 0 ? (
            <>
            <Text variant="muted">
              {t('callcenter.supervisor.queueOverview.noMatchingAgents', 'No operators match the current filters')}
            </Text>
            <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusBucket('all'); onShowActiveOnlyChange(false); onClearQueueFilter?.(); }}>
              {t('callcenter.supervisor.queueOverview.resetFilters', 'Reset filters')}
            </Button>
            </>
          ) : (
            <>
              <Text variant="muted">{t('callcenter.supervisor.noWatchedAgents', 'No supervised agents')}</Text>
              <Text variant="muted" className="text-xs">
                {t('callcenter.supervisor.noWatchedAgentsHint', 'Add agents from your access list')}
              </Text>
              <Button variant="outline" size="sm" onClick={onOpenWatchlist}>
                <UserPlus className="w-4 h-4 mr-1.5" />
                {t('callcenter.supervisor.addAgents', 'Add agents')}
              </Button>
            </>
          )}
        </div>
      ) : density === 'table' ? (
        <div
          className={`${styles.tableScroll} overflow-x-auto`}
          data-testid="hybrid-table"
          data-hybrid="overflow-x-auto"
        >
          <Text variant="muted">{t('callcenter.supervisor.board.signalBasis')}</Text>
          <Table<IAgent>
            showSearch={false}
            data={filteredSorted}
            columns={agentColumns}
            getRowId={(row) => row.interface}
            selectable
            rowSelection={rowSelection}
            onRowSelectionChange={onRowSelectionChange}
          />
        </div>
      ) : useVirtual ? (
        <div
          ref={scrollParentRef}
          className={styles.virtualBoardScroll}
          data-testid="supervisor-virtual-board"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((vItem) => {
              const agent = filteredSorted[vItem.index];
              if (!agent) return null;
              return (
                <div
                  key={agent.interface}
                  data-index={vItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vItem.start}px)`,
                    paddingBottom: '8px',
                  }}
                >
                  {renderCard(agent)}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <VStack gap="12">
          {groups.map((grp) => (
            <VStack key={grp.id} gap="8">
              {grp.label && (
                <Text variant="small" className="font-semibold">
                  {grp.label} ({grp.agents.length})
                </Text>
              )}
              <div className={density === 'compact' ? styles.agentCompactList : styles.agentGrid}>
                {grp.agents.map(renderCard)}
              </div>
            </VStack>
          ))}
        </VStack>
      )}
    </VStack>
  );
}
