import { useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  Headphones,
  PhoneForwarded,
  MoreHorizontal,
  PhoneOff,
  Hand,
} from 'lucide-react';
import {
  Button,
  HStack,
  TableCell,
  Text,
  Tooltip,
  VStack,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui';
import { selectCurrentUser } from '@/entities/User';
import {
  useGetEffectivePermissionsQuery,
  useGetMyOperatorSettingsQuery,
  useAgentPickCallMutation,
  usePeerSpyMutation,
  useSupervisorHangupCallMutation,
  useAgentHangupMutation,
  type SpyMode,
} from '@/shared/api/endpoints/callCenterApi';
import {
  selectMyAgent,
  selectCcAgents,
  selectCcCalls,
  selectCcQueues,
} from '../../model/selectors/callCenterSelectors';
import {
  agentDisplayName,
  agentStatusLabel,
  coworkerActivityLabel,
  queueDisplayName,
} from '../../lib/displayLabels';
import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import { resolveKpiTriple } from '../../lib/kpiDisplay';
import type { KpiDisplayMode } from '../../lib/agentPanelPrefs';
import type { IAgent } from '../../model/types/callCenterSchema';
import {
  DroppableColleague,
  useDragTransfer,
} from '../DragTransfer/DragTransfer';
import {
  WorklistTable,
  WorklistToolbar,
  Party,
  WorklistStatus,
  duration,
  useWorklistClock,
  worklistStyles as styles,
} from './WorklistTable';

export function ColleaguesTable({
  hasActiveCall,
  kpiDisplay,
}: {
  hasActiveCall: boolean;
  kpiDisplay: KpiDisplayMode;
}) {
  const { t } = useTranslation();
  const me = useSelector(selectMyAgent),
    agents = useSelector(selectCcAgents),
    calls = useSelector(selectCcCalls),
    queues = useSelector(selectCcQueues),
    user = useSelector(selectCurrentUser);
  const { data: permissions } = useGetEffectivePermissionsQuery();
  const { data: settings } = useGetMyOperatorSettingsQuery();
  const [pick] = useAgentPickCallMutation();
  const [spy] = usePeerSpyMutation(),
    [hangup] = useSupervisorHangupCallMutation(),
    [hangupOwn] = useAgentHangupMutation();
  const { requestTransfer } = useDragTransfer();
  const [search, setSearch] = useState(''),
    [limit, setLimit] = useState(30),
    [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null),
    [details, setDetails] = useState<IAgent | null>(null),
    [end, setEnd] = useState<IAgent | null>(null);
  const lock = useRef(false),
    now = useWorklistClock();
  const rows = useMemo(
    () =>
      agents
        .filter(
          (agent) =>
            me &&
            agent.status !== 'OFFLINE' &&
            (agent.interface === me.interface ||
              agent.queues.some((queue) => me.queues.includes(queue))),
        )
        .sort(
          (a, b) =>
            Number(b.interface === me?.interface) -
              Number(a.interface === me?.interface) ||
            agentDisplayName(a).localeCompare(agentDisplayName(b), undefined, {
              numeric: true,
            }),
        )
        .filter((agent) =>
          [
            agentDisplayName(agent),
            interfaceToExtension(agent.interface),
            ...agent.queues.map((queue) => queueDisplayName(queue, queues)),
          ]
            .join(' ')
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase()),
        ),
    [agents, me, queues, search],
  );
  const kpi = (agent: IAgent) =>
    resolveKpiTriple(
      {
        answered: agent.callsTaken || 0,
        made: agent.callsMade || 0,
        missed: agent.callsMissed || 0,
      },
      {
        answered: agent.kpiDay?.answered || 0,
        made: agent.kpiDay?.made || 0,
        missed: agent.kpiDay?.missed || 0,
      },
      kpiDisplay,
    );
  const run = async (agent: IAgent, mode?: SpyMode | 'pickup') => {
    if (lock.current) return;
    lock.current = true;
    setPending(agent.interface);
    setError('');
    try {
      if (mode === 'pickup' && agent.currentCall)
        await pick({ uniqueid: agent.currentCall }).unwrap();
      else if (mode)
        await spy({
          targetInterface: agent.interface,
          mode: mode as SpyMode,
        }).unwrap();
      else if (agent.interface === me?.interface) await hangupOwn({}).unwrap();
      else if (agent.currentCall)
        await hangup({ uniqueid: agent.currentCall }).unwrap();
    } catch {
      setError(t('callcenter.worklist.actionFailed'));
    } finally {
      setPending(null);
      lock.current = false;
    }
  };
  const title = t('callcenter.worklist.peopleTitle'),
    period = t(
      kpiDisplay === 'day' ? 'callcenter.kpi.day' : 'callcenter.kpi.shift',
    );
  return (
    <VStack align="stretch" max>
      <WorklistToolbar
        title={title}
        hint={`${t('callcenter.worklist.peopleHint')} · ${period}`}
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setLimit(30);
        }}
      />
      {error && (
        <Text role="alert" className={styles.error}>
          {error}
        </Text>
      )}
      <WorklistTable
        label={title}
        headers={[
          t('callcenter.worklist.operator'),
          t('callcenter.worklist.status'),
          t('callcenter.worklist.queues'),
          t('callcenter.kpi.inbound'),
          t('callcenter.kpi.outbound'),
          t('callcenter.kpi.missedOffersShort'),
          '',
        ]}
        empty={!rows.length}
      >
        {rows.slice(0, limit).map((agent) => {
          const self = agent.interface === me?.interface;
          const live = calls.find(
            (call) =>
              call.uniqueid === agent.currentCall ||
              call.agent === agent.interface,
          );
          const activity = coworkerActivityLabel(
            agent,
            live,
            queues,
            (key, fallback = '') => String(t(key, fallback)),
          );
          const ready =
            ['READY', 'OUTBOUND_WORK'].includes(agent.status) &&
            agent.phoneOnline !== false;
          const canTransfer = hasActiveCall && ready && !self;
          const canSpy =
            !self && permissions?.can_spy && agent.status === 'IN_CALL';
          const canIntercept =
            !self &&
            settings?.pickup_enabled &&
            me?.status === 'READY' &&
            me.phoneOnline !== false &&
            !hasActiveCall &&
            agent.status === 'RINGING' &&
            Boolean(agent.currentCall);
          const numbers = kpi(agent),
            queueList = agent.queues
              .map((queue) => queueDisplayName(queue, queues))
              .join(', ');
          const canHangup =
            agent.currentCall &&
            (self || [0, 1, 3].includes(Number(user?.level)));
          return (
            <DroppableColleague as="tr" key={agent.interface} agent={agent}>
              <TableCell>
                <Button
                  variant="unstyled"
                  size="none"
                  className={styles.nameButton}
                  onClick={() => setDetails(agent)}
                >
                  <Party
                    name={agentDisplayName(agent)}
                    number={`${t('callcenter.softphone.selectExtension')} ${interfaceToExtension(agent.interface)}${self ? ` · ${t('callcenter.worklist.ownRow')}` : ''}`}
                    avatar
                  />
                  <ChevronDown size={13} aria-hidden />
                </Button>
              </TableCell>
              <TableCell>
                <VStack gap="4">
                  <Tooltip content={activity.text}>
                    <span>
                      <WorklistStatus
                        tone={
                          ready
                            ? 'success'
                            : ['IN_CALL', 'CONSULT'].includes(agent.status)
                              ? 'primary'
                              : 'warning'
                        }
                      >
                        {agentStatusLabel(agent.status, (key) => t(key))}
                      </WorklistStatus>
                    </span>
                  </Tooltip>
                  <Text className={styles.secondary}>
                    {duration(
                      (now - Date.parse(agent.statusSince || '')) / 1000,
                    )}
                  </Text>
                </VStack>
              </TableCell>
              <TableCell>
                <Tooltip content={queueList || '—'}>
                  <Text className={styles.queueText}>{queueList || '—'}</Text>
                </Tooltip>
              </TableCell>
              <TableCell className={styles.numeric}>
                {numbers.answered}
              </TableCell>
              <TableCell className={styles.numeric}>{numbers.made}</TableCell>
              <TableCell className={styles.numeric}>{numbers.missed}</TableCell>
              <TableCell>
                <HStack gap="6" className={styles.rowActions}>
                  {canIntercept && (
                    <Button
                      variant="outline"
                      size="icon"
                      className={styles.action}
                      disabled={pending !== null}
                      aria-label={`${t('callcenter.worklist.pick')} · ${agentDisplayName(agent)}`}
                      onClick={() => void run(agent, 'pickup')}
                    >
                      <Hand size={15} aria-hidden />
                    </Button>
                  )}
                  {canTransfer && (
                    <Tooltip content={t('callcenter.worklist.transfer')}>
                      <Button
                        variant="outline"
                        size="icon"
                        className={styles.action}
                        aria-label={`${t('callcenter.worklist.transfer')} · ${agentDisplayName(agent)}`}
                        onClick={() => requestTransfer(agent)}
                      >
                        <PhoneForwarded size={15} aria-hidden />
                      </Button>
                    </Tooltip>
                  )}
                  {canSpy && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          className={styles.action}
                          variant="outline"
                          disabled={
                            pending !== null ||
                            hasActiveCall ||
                            me?.phoneOnline === false
                          }
                          aria-label={`${t('callcenter.worklist.join')} · ${agentDisplayName(agent)}`}
                        >
                          <Headphones size={15} aria-hidden />
                          <ChevronDown size={12} aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {(['listen', 'whisper', 'barge'] as SpyMode[])
                          .filter((mode) =>
                            permissions.spy_modes.includes(mode),
                          )
                          .map((mode) => (
                            <DropdownMenuItem
                              key={mode}
                              onSelect={() => void run(agent, mode)}
                            >
                              {t(`callcenter.worklist.${mode}`)}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {canHangup && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('common.actions')}
                        >
                          <MoreHorizontal size={16} aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setEnd(agent)}>
                          <PhoneOff size={14} aria-hidden />
                          {t('callcenter.controlBar.hangup')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </HStack>
              </TableCell>
            </DroppableColleague>
          );
        })}
      </WorklistTable>
      {rows.length > limit && (
        <HStack className={styles.footer}>
          <Button
            variant="ghost"
            onClick={() => setLimit((value) => value + 30)}
          >
            {t('callcenter.worklist.showMore')}
          </Button>
        </HStack>
      )}
      <Sheet
        open={Boolean(details)}
        onOpenChange={(open) => {
          if (!open) setDetails(null);
        }}
      >
        <SheetContent className={styles.details}>
          <SheetHeader>
            <SheetTitle>{details ? agentDisplayName(details) : ''}</SheetTitle>
          </SheetHeader>
          {details && (
            <VStack align="stretch" gap="20" className={styles.detailsBody}>
              <Party
                name={agentDisplayName(details)}
                number={`${t('callcenter.softphone.selectExtension')} ${interfaceToExtension(details.interface)}`}
                avatar
              />
              <WorklistStatus>
                {agentStatusLabel(details.status, (key) => t(key))}
              </WorklistStatus>
              <Text>
                {details.queues
                  .map((queue) => queueDisplayName(queue, queues))
                  .join(', ')}
              </Text>
              <Text>
                {t('callcenter.kpi.inbound')}: {kpi(details).answered} ·{' '}
                {t('callcenter.kpi.outbound')}: {kpi(details).made} ·{' '}
                {t('callcenter.kpi.missedOffersShort')}: {kpi(details).missed}
              </Text>
            </VStack>
          )}
        </SheetContent>
      </Sheet>
      <Dialog
        open={Boolean(end)}
        onOpenChange={(open) => {
          if (!open) setEnd(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('callcenter.controlBar.hangup')} ·{' '}
              {end ? agentDisplayName(end) : ''}
            </DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEnd(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={pending !== null}
              onClick={() => {
                if (end) void run(end);
                setEnd(null);
              }}
            >
              {t('callcenter.controlBar.hangup')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VStack>
  );
}
