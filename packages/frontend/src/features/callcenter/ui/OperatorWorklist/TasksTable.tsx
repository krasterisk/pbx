import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Phone,
  ChevronDown,
  X,
  PhoneMissed,
  PhoneCall,
  CheckCheck,
  CornerDownLeft,
  Clock3,
} from 'lucide-react';
import {
  Button,
  HStack,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  TableRow,
  TableCell,
  Text,
  VStack,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui';
import { useOperatorPhone } from '@/entities/phone';
import {
  useCallbackMissedCallMutation,
  useClaimMissedCallMutation,
} from '@/shared/api/endpoints/callCenterApi';
import {
  useClaimCallbackRequestMutation,
  useCancelCallbackRequestMutation,
} from '@/shared/api/endpoints/callbackRequestsApi';
import {
  selectMyAgent,
  selectCcQueues,
} from '../../model/selectors/callCenterSelectors';
import type { OperatorWorkItem } from '../../lib/operatorWorklist';
import { useOperatorWorklistData } from '../../lib/useOperatorWorklistData';
import { queueDisplayName } from '../../lib/displayLabels';
import {
  WorklistTable,
  WorklistToolbar,
  Party,
  WorklistStatus,
  worklistStyles as styles,
} from './WorklistTable';

export function TasksTable() {
  const { t } = useTranslation();
  const phone = useOperatorPhone(),
    me = useSelector(selectMyAgent),
    queues = useSelector(selectCcQueues);
  const { items, isLoading, isError: failed } = useOperatorWorklistData();
  const [callback] = useCallbackMissedCallMutation(),
    [claimMissed] = useClaimMissedCallMutation();
  const [claimRequest] = useClaimCallbackRequestMutation(),
    [cancelRequest] = useCancelCallbackRequestMutation();
  const [search, setSearch] = useState(''),
    [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null),
    [details, setDetails] = useState<OperatorWorkItem | null>(null),
    [cancel, setCancel] = useState<OperatorWorkItem | null>(null);
  const lock = useRef(false);
  const [limit, setLimit] = useState(30);
  const filtered = items.filter((item) =>
    [item.phone, item.name, item.queue, t(`callcenter.worklist.${item.status}`)]
      .join(' ')
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  const rows = filtered.slice(0, limit);
  const run = async (
    item: OperatorWorkItem,
    action: 'call' | 'claim' | 'cancel',
  ) => {
    if (lock.current) return;
    if (action === 'call' && (!phone?.active || !phone.canDial)) return;
    lock.current = true;
    setPending(item.id);
    setError('');
    try {
      if (action === 'cancel' && item.callback)
        await cancelRequest(item.callback.id).unwrap();
      else if (action === 'claim') {
        if (item.callback) await claimRequest(item.callback.id).unwrap();
        else await claimMissed({ callerIdNum: item.phone }).unwrap();
      } else {
        if (item.callback && item.callback.claimed_agent_uid == null)
          await claimRequest(item.callback.id).unwrap();
        const result = await callback({ callerIdNum: item.phone }).unwrap();
        const queue = queues.find(
          (q) =>
            q.name === item.queue ||
            q.displayName === item.queue ||
            queueDisplayName(q.name, queues) === item.queue,
        )?.name;
        phone!.startOutbound({
          target: result.target || item.phone,
          queue,
          serverStarted: result.mode !== 'webrtc',
        });
      }
    } catch {
      setError(t('callcenter.worklist.actionFailed'));
    } finally {
      lock.current = false;
      setPending(null);
    }
  };
  const title = t('callcenter.worklist.tasksTitle');
  return (
    <VStack align="stretch" max>
      <WorklistToolbar
        title={title}
        hint={t('callcenter.worklist.tasksHint')}
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setLimit(30);
        }}
      />
      {(error || failed) && (
        <Text role="alert" className={styles.error}>
          {error || t('callcenter.worklist.loadFailed')}
        </Text>
      )}
      <WorklistTable
        label={title}
        headers={[
          t('callcenter.worklist.client'),
          t('callcenter.worklist.request'),
          t('callcenter.worklist.queue'),
          t('callcenter.worklist.time'),
          '',
        ]}
        empty={!rows.length}
        loading={isLoading}
        error={failed}
      >
        {rows.map((item) => {
          const claimedByOther = item.callback
            ? item.callback.claimed_agent_uid != null &&
              item.callback.claimed_agent_uid !== me?.userId
            : item.claimedBy != null && item.claimedBy !== me?.userId;
          const canCall =
            phone?.canDial &&
            !claimedByOther &&
            item.callback?.status !== 'dialing';
          return (
            <TableRow key={item.id} data-resolved={item.resolved}>
              <TableCell>
                <Button
                  variant="unstyled"
                  size="none"
                  className={styles.nameButton}
                  onClick={() => setDetails(item)}
                >
                  <Party name={item.name} number={item.phone} avatar />
                  <ChevronDown size={13} aria-hidden />
                </Button>
              </TableCell>
              <TableCell>
                <VStack gap="4">
                  <HStack gap="6" className={styles.requestKind} data-kind={item.source}>
                    {item.source === 'missed' ? (
                      <PhoneMissed size={13} aria-hidden />
                    ) : (
                      <PhoneCall size={13} aria-hidden />
                    )}
                    <Text className={styles.primary}>
                      {t(
                        item.source === 'missed'
                          ? 'callcenter.worklist.missed'
                          : 'callcenter.worklist.ordered',
                      )}
                    </Text>
                  </HStack>
                  <HStack
                    gap="6"
                    className={styles.requestState}
                    data-tone={
                      item.status === 'failed'
                        ? 'danger'
                        : item.resolved
                          ? 'success'
                          : item.status === 'claimed'
                            ? 'primary'
                            : 'warning'
                    }
                  >
                    {item.status === 'clientReturned' ? (
                      <CornerDownLeft size={12} aria-hidden />
                    ) : item.resolved ? (
                      <CheckCheck size={12} aria-hidden />
                    ) : (
                      <Clock3 size={12} aria-hidden />
                    )}
                    <Text as="span">
                      {t(`callcenter.worklist.${item.status === 'missed' ? 'awaitingReply' : item.status}`)}
                    </Text>
                    <Text as="span" className={styles.attemptCount}>
                      ·{' '}
                      {t('callcenter.worklist.attempts', {
                        count: item.attempts,
                      })}
                    </Text>
                  </HStack>
                </VStack>
              </TableCell>
              <TableCell>
                <Text className={styles.queueText}>
                  {item.personal
                    ? t('callcenter.worklist.personal')
                    : queueDisplayName(item.queue, queues) || '—'}
                </Text>
              </TableCell>
              <TableCell className={styles.numeric}>
                {new Date(item.at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </TableCell>
              <TableCell>
                <HStack gap="8" className={styles.rowActions}>
                  <Button
                    variant="outline"
                    className={styles.action}
                    disabled={!canCall || pending !== null}
                    onClick={() => void run(item, 'call')}
                  >
                    <Phone size={14} aria-hidden />
                    {t(
                      pending === item.id
                        ? 'callcenter.worklist.calling'
                        : 'callcenter.worklist.call',
                    )}
                  </Button>
                  {item.callback && !item.resolved && (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending !== null || claimedByOther}
                      aria-label={t('callcenter.worklist.cancel')}
                      onClick={() => setCancel(item)}
                    >
                      <X size={15} aria-hidden />
                    </Button>
                  )}
                </HStack>
              </TableCell>
            </TableRow>
          );
        })}
      </WorklistTable>
      {filtered.length > limit && (
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
            <SheetTitle>{details?.name || details?.phone}</SheetTitle>
          </SheetHeader>
          {details && (
            <VStack align="stretch" gap="16" className={styles.detailsBody}>
              <WorklistStatus tone={details.resolved ? 'success' : 'warning'}>
                {t(`callcenter.worklist.${details.status}`)}
              </WorklistStatus>
              {!details.resolved &&
                !details.personal &&
                !details.claimedBy &&
                !details.callback?.claimed_agent_uid && (
                  <Button
                    variant="outline"
                    disabled={pending !== null}
                    onClick={() => void run(details, 'claim')}
                  >
                    {t('callcenter.worklist.claim')}
                  </Button>
                )}
              {details.history.map((attempt) => (
                <VStack key={attempt.uid} gap="4" className={styles.attempt}>
                  <Text>{new Date(attempt.created_at).toLocaleString()}</Text>
                  <Text className={styles.secondary}>
                    {queueDisplayName(attempt.queue_name, queues)} ·{' '}
                    {t(
                      attempt.client_called_back
                        ? 'callcenter.worklist.clientReturned'
                        : attempt.called_back
                          ? 'callcenter.worklist.callbackDone'
                          : 'callcenter.worklist.missed',
                    )}
                  </Text>
                </VStack>
              ))}
            </VStack>
          )}
        </SheetContent>
      </Sheet>
      <Dialog
        open={Boolean(cancel)}
        onOpenChange={(open) => {
          if (!open) setCancel(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('callcenter.worklist.cancel')} · {cancel?.phone}
            </DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancel(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (cancel) void run(cancel, 'cancel');
                setCancel(null);
              }}
            >
              {t('callcenter.worklist.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VStack>
  );
}
