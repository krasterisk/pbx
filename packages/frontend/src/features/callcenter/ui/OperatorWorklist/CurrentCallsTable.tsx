import { useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Hand } from 'lucide-react';
import {
  Button,
  TableCell,
  TableRow,
  Text,
  Tooltip,
  VStack,
} from '@/shared/ui';
import {
  useAgentPickCallMutation,
  useGetMyOperatorSettingsQuery,
} from '@/shared/api/endpoints/callCenterApi';
import {
  selectMyAgent,
  selectCcAgents,
  selectCcCalls,
  selectCcQueues,
} from '../../model/selectors/callCenterSelectors';
import { currentCallRows } from '../../lib/operatorWorklist';
import {
  callerDisplayName,
  agentDisplayName,
  queueDisplayName,
} from '../../lib/displayLabels';
import {
  WorklistTable,
  WorklistToolbar,
  Party,
  WorklistStatus,
  duration,
  useWorklistClock,
  worklistStyles as styles,
} from './WorklistTable';

export function CurrentCallsTable() {
  const { t } = useTranslation();
  const agent = useSelector(selectMyAgent),
    agents = useSelector(selectCcAgents),
    calls = useSelector(selectCcCalls),
    queues = useSelector(selectCcQueues);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<string | null>(null),
    [error, setError] = useState('');
  const busy = useRef(false);
  const now = useWorklistClock();
  const { data: settings } = useGetMyOperatorSettingsQuery();
  const [pick] = useAgentPickCallMutation();
  const ordered = useMemo(
    () => currentCallRows(calls, agent?.queues || []),
    [calls, agent?.queues],
  );
  const rows = ordered.filter(({ call }) =>
    [
      call.callerIdNum,
      callerDisplayName(call.callerIdName),
      queueDisplayName(call.queue, queues),
      agents.find((a) => a.interface === call.agent)?.name,
    ]
      .join(' ')
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  const take = async (uniqueid: string) => {
    if (busy.current) return;
    busy.current = true;
    setPending(uniqueid);
    setError('');
    try {
      await pick({ uniqueid }).unwrap();
    } catch {
      setError(t('callcenter.agent.pickCallFailed'));
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  const title = t('callcenter.worklist.currentTitle');
  return (
    <VStack align="stretch" max>
      <WorklistToolbar
        title={title}
        hint={t('callcenter.worklist.currentHint')}
        search={search}
        onSearch={setSearch}
      />
      {(error || agent?.pickupFailed) && (
        <Text className={styles.error} role="alert">
          {error || t('callcenter.agent.pickCallNoAnswer')}
        </Text>
      )}
      <WorklistTable
        label={title}
        headers={[
          t('callcenter.worklist.client'),
          t('callcenter.worklist.status'),
          t('callcenter.worklist.queue'),
          t('callcenter.worklist.operator'),
          t('callcenter.worklist.position'),
          t('callcenter.worklist.time'),
          '',
        ]}
        empty={!rows.length}
      >
        {rows.map(({ call, position }) => {
          const talking = call.status === 'TALKING' || call.status === 'HOLD';
          const member = agents.find((a) => a.interface === call.agent);
          const canPick =
            settings?.pickup_enabled &&
            call.status === 'WAITING' &&
            agent?.status === 'READY' &&
            agent.phoneOnline !== false;
          const elapsed =
            (now -
              Date.parse(
                talking ? call.answerTime || call.enterTime : call.enterTime,
              )) /
            1000;
          const status =
            call.status === 'HOLD'
              ? 'hold'
              : talking
                ? 'talking'
                : call.status === 'RINGING'
                  ? 'ringing'
                  : 'waiting';
          return (
            <TableRow key={call.uniqueid} data-status={call.status}>
              <TableCell>
                <Party
                  name={callerDisplayName(call.callerIdName) || undefined}
                  number={call.callerIdNum}
                />
              </TableCell>
              <TableCell>
                <WorklistStatus tone={talking ? 'success' : 'warning'}>
                  {t(`callcenter.worklist.${status}`)}
                </WorklistStatus>
              </TableCell>
              <TableCell>
                <Text className={styles.queueText}>
                  {queueDisplayName(call.queue, queues)}
                </Text>
              </TableCell>
              <TableCell>
                <Text className={styles.secondary}>
                  {member ? agentDisplayName(member) : '—'}
                </Text>
              </TableCell>
              <TableCell className={styles.numeric}>
                {position ? (
                  <Tooltip
                    content={t('callcenter.worklist.queuePosition', {
                      position,
                      queue: queueDisplayName(call.queue, queues),
                    })}
                  >
                    <Text as="span">{position}</Text>
                  </Tooltip>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell className={styles.numeric}>
                {duration(elapsed)}
              </TableCell>
              <TableCell>
                {settings?.pickup_enabled && call.status === 'WAITING' && (
                  <Button
                    className={styles.action}
                    variant="outline"
                    disabled={!canPick || pending !== null}
                    onClick={() => void take(call.uniqueid)}
                  >
                    <Hand size={14} aria-hidden />
                    {t(
                      pending === call.uniqueid
                        ? 'callcenter.worklist.picking'
                        : 'callcenter.worklist.pick',
                    )}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </WorklistTable>
    </VStack>
  );
}
