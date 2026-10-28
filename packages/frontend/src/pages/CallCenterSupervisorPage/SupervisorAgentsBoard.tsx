import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellContext, ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { ChevronDown, ChevronRight, Search, UsersRound } from 'lucide-react';
import { Avatar, Button, Flex, HStack, Input, Table, Text, Tooltip, VStack } from '@/shared/ui';
import { agentDisplayName, agentLabelWithExt, queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import { filterAndSortAgents } from '@/features/callcenter/lib/agentBoard';
import { supervisorQueueSummary } from '@/features/callcenter/lib/supervisorPulse';
import type { IAgent, ICall, IPauseReason, IQueueStats } from '@/features/callcenter/model/types/callCenterSchema';
import type { SupervisorGroupBy, SupervisorSortBy } from '@/features/callcenter/lib/supervisorUrlState';
import { SupervisorAgentStatusMenu } from './SupervisorAgentStatusMenu';
import styles from './SupervisorPulse.module.scss';

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
  onRowSelectionChange: (next: RowSelectionState) => void;
  agentAvatarSrc: (agent: IAgent) => string | undefined;
  agentActivity: (agent: IAgent) => { text: string };
  renderElapsed: (agent: IAgent) => ReactNode;
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
  busyInterfaces?: readonly string[];
}

export function SupervisorAgentsBoard({
  agents, watchedCount, queues, sortBy, agentAvatarSrc, renderElapsed,
  onOpenWatchlist, onClearQueueFilter, onOpenAgent, onOpenQueues,
  onStartShift, onEndShift, onPause, onUnpause, busyInterfaces = [],
}: SupervisorAgentsBoardProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const visible = useMemo(() => filterAndSortAgents(agents, {
    search, sortBy, statusBucket: 'all', nowMs: Date.now(),
  }), [agents, search, sortBy]);

  // TanStack cell functions are component types. Preserve the avatar callback
  // across clock ticks (supervisor-avatar A2), including image-error fallback state.
  const renderAgentNameCell = useCallback(({ row }: CellContext<IAgent, unknown>) => (
    <Button type="button" variant="unstyled" size="none" className={styles.agentName} aria-label={agentLabelWithExt(row.original)}
      onClick={() => onOpenAgent(row.original)}>
      <Avatar name={agentLabelWithExt(row.original)} src={agentAvatarSrc(row.original)} size={28} />
      <VStack as="span" gap="2" className={styles.person}>
        <Text as="span" className={styles.personName}>{agentDisplayName(row.original)}</Text>
        <Text as="span" variant="xs" className={styles.personExtension}>{row.original.interface.startsWith('user:')
          ? t('callcenter.supervisor.pulse.noAssignedExtension')
          : t('callcenter.supervisor.pulse.extension', { number: interfaceToExtension(row.original.interface) })}</Text>
      </VStack>
      <ChevronDown size={13} className={styles.detailsArrow} aria-hidden />
    </Button>
  ), [agentAvatarSrc, onOpenAgent, t]);

  const statusCell = useCallback(({ row }: CellContext<IAgent, unknown>) => (
    <SupervisorAgentStatusMenu agent={row.original} elapsed={renderElapsed(row.original)}
      busy={busyInterfaces.includes(row.original.interface)} onStartShift={onStartShift}
      onEndShift={onEndShift} onPause={onPause} onUnpause={onUnpause} />
  ), [busyInterfaces, renderElapsed, onStartShift, onEndShift, onPause, onUnpause]);

  const queueCell = useCallback(({ row }: CellContext<IAgent, unknown>) => {
    const full = row.original.queues.map(name => queueDisplayName(name, queues)).join(', ')
      || t('callcenter.supervisor.pulse.noQueues');
    return <Tooltip content={full}>
      <Button type="button" variant="unstyled" size="none" className={styles.queueSummary}
        onClick={() => onOpenQueues(row.original)}
        aria-label={t('callcenter.supervisor.pulse.manageQueuesFor', { name: row.original.name })}>
        <Text as="span" className={styles.queueNames}>{supervisorQueueSummary(full)}</Text>
        <ChevronRight size={13} aria-hidden />
      </Button>
    </Tooltip>;
  }, [queues, t, onOpenQueues]);

  const columns = useMemo<ColumnDef<IAgent>[]>(() => [
    { id: 'name', header: t('callcenter.supervisor.agent_lbl', 'Operator'), cell: renderAgentNameCell },
    { id: 'status', header: t('callcenter.supervisor.status', 'Status'), cell: statusCell },
    { id: 'inbound', header: t('callcenter.supervisor.kpiIn', 'Inbound'),
      cell: ({ row }) => <Button type="button" variant="unstyled" size="none" className={styles.numberLink}
        onClick={() => onOpenAgent(row.original)}>{row.original.kpiDay?.answered ?? 0}</Button> },
    { id: 'outbound', header: t('callcenter.supervisor.kpiOut', 'Outbound'),
      cell: ({ row }) => <Button type="button" variant="unstyled" size="none" className={styles.numberLink}
        onClick={() => onOpenAgent(row.original)}>{row.original.kpiDay?.made ?? 0}</Button> },
    { id: 'missed', header: t('callcenter.supervisor.pulse.notAnswered'),
      cell: ({ row }) => <Tooltip content={t('callcenter.supervisor.pulse.missedHelp')}>
        <Text as="span" className={styles.number}>{row.original.kpiDay?.missed ?? 0}</Text>
      </Tooltip> },
    { id: 'queues', header: t('callcenter.supervisor.pulse.queueColumn', 'Queues'), cell: queueCell },
  ], [t, renderAgentNameCell, statusCell, queueCell, onOpenAgent]);

  return <VStack gap="12" className={styles.team} data-testid="supervisor-agents-board">
    <Flex align="center" justify="between" gap="12" wrap="wrap">
      <HStack gap="12" wrap="wrap">
        <Text as="h2" className={styles.teamTitle}>{t('callcenter.supervisor.pulse.myTeam')}</Text>
        <Text variant="xs" className={styles.secondary}>{agents.length === watchedCount
          ? watchedCount : t('callcenter.supervisor.pulse.visibleCount', { visible: agents.length, total: watchedCount })}</Text>
        <Button type="button" variant="ghost" size="sm" onClick={onOpenWatchlist} data-testid="supervisor-manage-watchlist">
          <UsersRound size={15} aria-hidden />{t('callcenter.supervisor.pulse.teamMembers')}
        </Button>
      </HStack>
      <HStack gap="6" className={styles.search}>
        <Search size={15} aria-hidden />
        <Input value={search} onChange={event => setSearch(event.target.value)}
          placeholder={t('callcenter.supervisor.board.searchPlaceholder', 'Name or extension')}
          aria-label={t('callcenter.supervisor.board.searchPlaceholder', 'Name or extension')}
          className={styles.searchInput} data-testid="supervisor-board-search" />
      </HStack>
    </Flex>
    <>
      <Table data={visible} columns={columns} getRowId={agent => agent.interface}
        getRowTestId={agent => `supervisor-agent-row-${agent.interface}`}
        className={styles.operatorTable} surface={false} showSearch={false} showExport={false}
        emptyText={watchedCount === 0 ? t('callcenter.supervisor.pulse.emptyTeam') : t('callcenter.supervisor.queueOverview.noMatchingAgents', 'No operators found')} />
      {watchedCount > 0 && agents.length === 0 && onClearQueueFilter && <Button variant="ghost" size="sm" onClick={onClearQueueFilter}>
        {t('callcenter.supervisor.pulse.clearQueueFilter')}
      </Button>}
      <Flex justify="end" gap="8" wrap="wrap" className={styles.tableNote}>
        <Text variant="xs">{t('callcenter.supervisor.pulse.agentDayScope')}</Text>
      </Flex>
    </>
  </VStack>;
}
