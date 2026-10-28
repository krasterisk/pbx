import { useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Phone, ChevronDown } from 'lucide-react';
import {
  Button,
  HStack,
  Select,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  TableRow,
  TableCell,
  Text,
  VStack,
} from '@/shared/ui';
import { selectCurrentUser } from '@/entities/User';
import { useOperatorPhone } from '@/entities/phone';
import {
  useGetOperatorCallHistoryQuery,
  useGetSupervisorCallHistoryQuery,
  useClickToCallMutation,
  useLazyGetCardByCallQuery,
  useGetCardTemplatesQuery,
  type IOperatorHistoryRow,
} from '@/shared/api/endpoints/callCenterApi';
import {
  selectCcAgents,
  selectCcQueues,
} from '../../model/selectors/callCenterSelectors';
import { queueDisplayName, callerDisplayName } from '../../lib/displayLabels';
import type { KpiDisplayMode } from '../../lib/agentPanelPrefs';
import type { ICardTemplate } from '../../model/types/callCard';
import { CallCardPopup } from '../CallCardPopup/CallCardPopup';
import {
  WorklistTable,
  WorklistToolbar,
  WorklistStatus,
  Party,
  duration,
  worklistStyles as styles,
} from './WorklistTable';

export function historyDirection(
  row: Pick<IOperatorHistoryRow, 'direction' | 'queueName'>,
): 'incoming' | 'outgoing' | 'personal' {
  if (row.direction === 'outbound' || row.direction === 'internal')
    return 'outgoing';
  return row.direction === 'personal' ||
    !row.queueName ||
    row.queueName.startsWith('direct:')
    ? 'personal'
    : 'incoming';
}

export function HistoryWorklistTable({
  kpiDisplay,
}: {
  kpiDisplay: KpiDisplayMode;
}) {
  const { t } = useTranslation();
  const user = useSelector(selectCurrentUser),
    agents = useSelector(selectCcAgents),
    queues = useSelector(selectCcQueues),
    phone = useOperatorPhone();
  const [scope, setScope] = useState('own'),
    [search, setSearch] = useState(''),
    [limit, setLimit] = useState(30),
    [error, setError] = useState('');
  const canReadTeam = [0, 1, 3].includes(Number(user?.level));
  const team = canReadTeam && scope === 'team';
  const ownQuery = useGetOperatorCallHistoryQuery(
    { period: kpiDisplay === 'day' ? 'day' : 'shift' },
    { skip: team, refetchOnMountOrArgChange: true },
  );
  const teamQuery = useGetSupervisorCallHistoryQuery(
    { period: 'day' },
    { skip: !team, refetchOnMountOrArgChange: true },
  );
  const query = team ? teamQuery : ownQuery;
  const { data: templates = [] } = useGetCardTemplatesQuery();
  const [getCard] = useLazyGetCardByCallQuery(),
    [call] = useClickToCallMutation();
  const [details, setDetails] = useState<IOperatorHistoryRow | null>(null),
    [pending, setPending] = useState<string | null>(null);
  const [card, setCard] = useState<{
    template: ICardTemplate;
    values: Record<string, unknown>;
    row: IOperatorHistoryRow;
  } | null>(null);
  const lock = useRef(false);
  const rows = useMemo(
    () =>
      (query.data || [])
        .slice()
        .sort(
          (a, b) =>
            Date.parse(b.enterTime || b.endTime || '') -
              Date.parse(a.enterTime || a.endTime || '') || b.uid - a.uid,
        )
        .filter((row) =>
          [
            row.callerIdNum,
            callerDisplayName(row.callerIdName),
            queueDisplayName(row.queueName || '', queues),
            t(`callcenter.worklist.${historyDirection(row)}`),
            t(`callcenter.history.disposition.${row.disposition}`),
          ]
            .join(' ')
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase()),
        ),
    [query.data, queues, search, t],
  );
  const dial = async (row: IOperatorHistoryRow) => {
    if (!phone?.canDial || lock.current) return;
    lock.current = true;
    setPending(row.callUniqueid);
    setError('');
    try {
      const result = await call({ target: row.callerIdNum }).unwrap();
      phone.startOutbound({
        target: result.target || row.callerIdNum,
        queue:
          row.queueName && !row.queueName.startsWith('direct:')
            ? row.queueName
            : undefined,
        serverStarted: result.mode !== 'webrtc',
      });
    } catch {
      setError(t('callcenter.worklist.actionFailed'));
    } finally {
      lock.current = false;
      setPending(null);
    }
  };
  const openCard = async (row: IOperatorHistoryRow) => {
    setError('');
    try {
      const saved = await getCard(row.callUniqueid).unwrap();
      const template = templates.find((item) => item.uid === saved.template_id);
      if (!template) {
        setError(t('callcenter.worklist.noTemplate'));
        return;
      }
      setCard({ template, values: saved.field_values || {}, row });
    } catch {
      setError(t('callcenter.worklist.noTemplate'));
    }
  };
  const title = t('callcenter.worklist.historyTitle');
  return (
    <VStack align="stretch" max>
      <WorklistToolbar
        title={title}
        hint={`${t('callcenter.worklist.historyHint')} · ${t(team || kpiDisplay === 'day' ? 'callcenter.kpi.day' : 'callcenter.kpi.shift')}`}
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setLimit(30);
        }}
      >
        {canReadTeam && (
          <Select
            aria-label={t('callcenter.worklist.historyTitle')}
            value={team ? 'team' : 'own'}
            onChange={(event) => {
              setScope(event.target.value);
              setLimit(30);
            }}
            className={styles.filter}
            options={[
              { value: 'own', label: t('callcenter.worklist.own') },
              { value: 'team', label: t('callcenter.worklist.team') },
            ]}
          />
        )}
      </WorklistToolbar>
      {(error || query.isError) && (
        <Text role="alert" className={styles.error}>
          {error || t('callcenter.worklist.loadFailed')}
        </Text>
      )}
      <WorklistTable
        label={title}
        headers={[
          t('callcenter.worklist.client'),
          t('callcenter.worklist.direction'),
          ...(team ? [t('callcenter.worklist.operator')] : []),
          t('callcenter.worklist.queue'),
          t('callcenter.worklist.time'),
          t('callcenter.worklist.duration'),
          t('callcenter.worklist.result'),
          '',
        ]}
        empty={!rows.length}
        loading={query.isLoading}
        error={query.isError}
      >
        {rows.slice(0, limit).map((row) => {
          const direction = historyDirection(row),
            answered = ['answered', 'transferred'].includes(row.disposition);
          const outcome =
            row.disposition === 'transferred'
              ? 'transferred'
              : answered
                ? 'answered'
                : ['abandoned', 'timeout'].includes(row.disposition)
                  ? 'noAnswer'
                  : 'other';
          return (
            <TableRow key={`${row.callUniqueid}:${row.uid}`}>
              <TableCell>
                <Button
                  variant="unstyled"
                  size="none"
                  className={styles.nameButton}
                  onClick={() => setDetails(row)}
                >
                  <Party
                    name={callerDisplayName(row.callerIdName) || undefined}
                    number={row.callerIdNum}
                  />
                  <ChevronDown size={13} aria-hidden />
                </Button>
              </TableCell>
              <TableCell>
                <WorklistStatus
                  tone={direction === 'outgoing' ? 'primary' : 'neutral'}
                >
                  {t(`callcenter.worklist.${direction}`)}
                </WorklistStatus>
              </TableCell>
              {team && (
                <TableCell>
                  <Text className={styles.secondary}>
                    {agents.find((agent) => agent.userId === row.agentUserId)
                      ?.name || (row.agentUserId ? `#${row.agentUserId}` : '—')}
                  </Text>
                </TableCell>
              )}
              <TableCell>
                <Text className={styles.queueText}>
                  {direction === 'personal'
                    ? '—'
                    : queueDisplayName(row.queueName || '', queues) || '—'}
                </Text>
              </TableCell>
              <TableCell className={styles.numeric}>
                {row.enterTime || row.endTime
                  ? new Date(
                      (row.enterTime || row.endTime)!,
                    ).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </TableCell>
              <TableCell className={styles.numeric}>
                {row.talkTime ? duration(row.talkTime) : '—'}
              </TableCell>
              <TableCell>
                <WorklistStatus
                  tone={
                    answered
                      ? 'success'
                      : outcome === 'noAnswer'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {t(`callcenter.worklist.${outcome}`)}
                </WorklistStatus>
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  className={styles.action}
                  disabled={
                    !phone?.canDial || !row.callerIdNum || pending !== null
                  }
                  onClick={() => void dial(row)}
                >
                  <Phone size={14} aria-hidden />
                  {t(
                    pending === row.callUniqueid
                      ? 'callcenter.worklist.calling'
                      : 'callcenter.worklist.call',
                  )}
                </Button>
              </TableCell>
            </TableRow>
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
            <SheetTitle>{t('callcenter.worklist.details')}</SheetTitle>
          </SheetHeader>
          {details && (
            <VStack align="stretch" gap="20" className={styles.detailsBody}>
              <Party
                name={callerDisplayName(details.callerIdName) || undefined}
                number={details.callerIdNum}
              />
              <Text>
                {t(`callcenter.worklist.${historyDirection(details)}`)} ·{' '}
                {details.enterTime
                  ? new Date(details.enterTime).toLocaleString()
                  : '—'}
              </Text>
              <Text>{queueDisplayName(details.queueName || '', queues)}</Text>
              <Text>
                {t('callcenter.worklist.wait')}:{' '}
                {duration(details.waitTime || 0)} ·{' '}
                {t('callcenter.worklist.duration')}:{' '}
                {duration(details.talkTime || 0)}
              </Text>
              {details.transferDestination && (
                <Text>
                  {t('callcenter.worklist.transferred')}:{' '}
                  {details.transferDestination}
                </Text>
              )}
              {details.handledByName && (
                <Text>
                  {t('callcenter.worklist.handled')}: {details.handledByName}
                </Text>
              )}
              <Button variant="outline" onClick={() => void openCard(details)}>
                {t('callcenter.worklist.card')}
              </Button>
              {error && <Text role="alert">{error}</Text>}
            </VStack>
          )}
        </SheetContent>
      </Sheet>
      <CallCardPopup
        open={Boolean(card)}
        template={card?.template || null}
        initialValues={card?.values || {}}
        callContext={
          card
            ? {
                uniqueid: card.row.callUniqueid,
                callerId: card.row.callerIdNum,
                queue: card.row.queueName || '',
              }
            : null
        }
        isVip={false}
        onClose={() => setCard(null)}
      />
    </VStack>
  );
}
