import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ChevronDown, PhoneForwarded } from 'lucide-react';
import {
  Button,
  TableRow,
  TableCell,
  Text,
  VStack,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui';
import { useWarmTransferToQueueMutation } from '@/shared/api/endpoints/callCenterApi';
import {
  selectMyAgent,
  selectCcQueues,
} from '../../model/selectors/callCenterSelectors';
import { queueDisplayName, queueNumberFromName } from '../../lib/displayLabels';
import {
  WorklistTable,
  WorklistToolbar,
  Party,
  duration,
  worklistStyles as styles,
} from './WorklistTable';

export function QueuesWorklistTable({
  activeCallUniqueid,
  currentQueue,
}: {
  activeCallUniqueid?: string;
  currentQueue?: string;
}) {
  const { t } = useTranslation();
  const me = useSelector(selectMyAgent),
    queues = useSelector(selectCcQueues);
  const [search, setSearch] = useState(''),
    [detail, setDetail] = useState<string | null>(null),
    [error, setError] = useState('');
  const [transfer, { isLoading }] = useWarmTransferToQueueMutation();
  const names = (me?.queues || []).filter((name) =>
    queueDisplayName(name, queues)
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  const title = t('callcenter.worklist.queuesTitle'),
    selected = queues.find((queue) => queue.name === detail);
  const move = async (queue: string) => {
    setError('');
    try {
      await transfer({ uniqueid: activeCallUniqueid!, queue }).unwrap();
    } catch {
      setError(t('callcenter.worklist.actionFailed'));
    }
  };
  return (
    <VStack align="stretch" max>
      <WorklistToolbar
        title={title}
        hint={t('callcenter.worklist.queuesHint')}
        search={search}
        onSearch={setSearch}
      />
      {error && (
        <Text role="alert" className={styles.error}>
          {error}
        </Text>
      )}
      <WorklistTable
        label={title}
        headers={[
          t('callcenter.worklist.queue'),
          t('callcenter.worklist.waiting'),
          t('callcenter.worklist.talking'),
          t('callcenter.worklist.free'),
          'SLA',
          t('callcenter.worklist.accepted'),
          t('callcenter.worklist.lost'),
          '',
        ]}
        empty={!names.length}
      >
        {names.map((name) => {
          const queue = queues.find((item) => item.name === name);
          return (
            <TableRow key={name}>
              <TableCell>
                <Button
                  variant="unstyled"
                  size="none"
                  className={styles.nameButton}
                  onClick={() => setDetail(name)}
                >
                  <Party
                    name={queue?.displayName || queueDisplayName(name, queues)}
                    number={queueNumberFromName(name) || undefined}
                  />
                  <ChevronDown size={13} aria-hidden />
                </Button>
              </TableCell>
              <TableCell className={styles.numeric}>
                {queue?.waiting ?? '—'}
              </TableCell>
              <TableCell className={styles.numeric}>
                {queue?.talking ?? '—'}
              </TableCell>
              <TableCell className={styles.numeric}>
                {queue
                  ? `${queue.agents.available} / ${queue.agents.total}`
                  : '—'}
              </TableCell>
              <TableCell className={styles.numeric}>
                {queue ? `${queue.sla}%` : '—'}
              </TableCell>
              <TableCell className={styles.numeric}>
                {queue?.calls.answered ?? '—'}
              </TableCell>
              <TableCell className={styles.numeric}>
                {queue?.calls.abandoned ?? '—'}
              </TableCell>
              <TableCell>
                {activeCallUniqueid && currentQueue !== name && (
                  <Button
                    className={styles.action}
                    variant="outline"
                    disabled={isLoading}
                    onClick={() => void move(name)}
                    aria-label={`${t('callcenter.worklist.transfer')} · ${queueDisplayName(name, queues)}`}
                  >
                    <PhoneForwarded size={15} aria-hidden />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </WorklistTable>
      <Sheet
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <SheetContent className={styles.details}>
          <SheetHeader>
            <SheetTitle>
              {detail ? queueDisplayName(detail, queues) : ''}
            </SheetTitle>
          </SheetHeader>
          {selected && (
            <VStack gap="20" align="stretch" className={styles.detailsBody}>
              <Text>
                {t('callcenter.worklist.waiting')}: {selected.waiting} ·{' '}
                {t('callcenter.worklist.talking')}: {selected.talking}
              </Text>
              <Text>
                {t('callcenter.worklist.free')}: {selected.agents.available} /{' '}
                {selected.agents.total}
              </Text>
              <Text>
                {t('callcenter.agent.wait')}: {duration(selected.avgWait)} ·{' '}
                {t('callcenter.worklist.duration')}:{' '}
                {duration(selected.avgTalk)}
              </Text>
              <Text>SLA: {selected.sla}%</Text>
              <Text>
                {t('callcenter.worklist.today')} ·{' '}
                {t('callcenter.worklist.accepted')}: {selected.calls.answered} ·{' '}
                {t('callcenter.worklist.lost')}: {selected.calls.abandoned}
              </Text>
            </VStack>
          )}
        </SheetContent>
      </Sheet>
    </VStack>
  );
}
