import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Flex,
  SegmentedControl,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Table,
  Text,
  VStack,
} from '@/shared/ui';
import { CallHistoryPanel } from '@/features/callcenter/ui/CallHistoryPanel';
import {
  useCancelCallbackRequestMutation,
  useGetCallbackRequestsQuery,
  type ICallbackRequest,
} from '@/shared/api/endpoints/callbackRequestsApi';
import { filterCallbackRowsByQueue } from './callbackQueueFilter';
import styles from './CallCenterSupervisorPage.module.scss';

export type JournalSection = 'history' | 'callbacks';

export interface SupervisorJournalSheetProps {
  /** `null` = closed. */
  section: JournalSection | null;
  onSectionChange: (next: JournalSection) => void;
  onClose: () => void;
  queueFilter: readonly string[];
}

/**
 * Rarely used history / callback tables live in a Sheet instead of competing with the live cockpit
 * for tab space (U1.1). Both views keep the page queue filter.
 */
export function SupervisorJournalSheet({
  section,
  onSectionChange,
  onClose,
  queueFilter,
}: SupervisorJournalSheetProps) {
  const { t } = useTranslation();
  const [callbackView, setCallbackView] = useState<'active' | 'completed'>('active');
  const [confirmCancel, setConfirmCancel] = useState<ICallbackRequest | null>(null);

  const { data: callbackRows = [], isFetching: callbacksLoading } = useGetCallbackRequestsQuery(
    callbackView,
    { skip: section !== 'callbacks' },
  );
  const [cancelCallback] = useCancelCallbackRequestMutation();

  const filteredCallbacks = useMemo(
    () => filterCallbackRowsByQueue(callbackRows, [...queueFilter]),
    [callbackRows, queueFilter],
  );

  const callbackColumns = useMemo<ColumnDef<ICallbackRequest>[]>(() => [
    { accessorKey: 'caller', header: t('callcenter.callback.number', 'Number') },
    {
      id: 'requested',
      header: t('callcenter.callback.requested', 'Requested'),
      cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
    },
    {
      id: 'source',
      header: t('callcenter.callback.source', 'Source'),
      cell: ({ row }) => row.original.queue_label || row.original.route_label || row.original.source,
    },
    { accessorKey: 'status', header: t('callcenter.callback.status', 'Status') },
    {
      id: 'attempts',
      header: t('callcenter.callback.attempts', 'Attempts'),
      cell: ({ row }) => `${row.original.attempt_count}/${row.original.max_attempts}`,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        (row.original.status === 'pending' || row.original.status === 'dialing') ? (
          <Button size="sm" variant="outline" onClick={() => setConfirmCancel(row.original)}>
            {t('callcenter.callback.cancel', 'Cancel the request')}
          </Button>
        ) : null
      ),
    },
  ], [t]);

  return (
    <>
      <Sheet open={section != null} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent
          side="right"
          aria-describedby={undefined}
          style={{ width: 'min(1040px, 100vw)' }}
          data-testid="cc-journal-sheet"
        >
          <SheetHeader>
            <SheetTitle>{t('callcenter.supervisor.cockpit.journalTitle', 'Journal')}</SheetTitle>
          </SheetHeader>
          <SegmentedControl<JournalSection>
            ariaLabel={t('callcenter.supervisor.cockpit.journalTitle', 'Journal')}
            value={section ?? 'history'}
            onChange={onSectionChange}
            options={[
              { value: 'history', label: t('callcenter.supervisor.cockpit.journalHistory', 'Call history') },
              { value: 'callbacks', label: t('callcenter.supervisor.cockpit.journalCallbacks', 'Callback requests') },
            ]}
          />
          <VStack gap="12" className={styles.journalBody}>
            {section === 'history' && <CallHistoryPanel source="supervisor" kpiDisplay="day" />}
            {section === 'callbacks' && (
              <VStack gap="8" data-testid="supervisor-callbacks-tab">
                <Flex justify="between" align="center" wrap="wrap" gap="8">
                  <SegmentedControl<'active' | 'completed'>
                    ariaLabel={t('callcenter.callback.title', 'Callbacks')}
                    value={callbackView}
                    onChange={setCallbackView}
                    options={[
                      { value: 'active', label: t('callcenter.callback.active', 'Active') },
                      { value: 'completed', label: t('callcenter.callback.completed', 'Completed') },
                    ]}
                  />
                  {!callbacksLoading && <Text variant="muted">{filteredCallbacks.length}</Text>}
                </Flex>
                {callbacksLoading ? (
                  <Text variant="muted">{t('common.loading', 'Loading…')}</Text>
                ) : filteredCallbacks.length === 0 ? (
                  <Text variant="muted">{t('callcenter.callback.emptyTitle', 'No callback requests')}</Text>
                ) : (
                  <Flex className={`${styles.tableScroll} overflow-x-auto`}>
                    <Table<ICallbackRequest>
                      data={filteredCallbacks}
                      columns={callbackColumns}
                      getRowId={(row) => String(row.id)}
                    />
                  </Flex>
                )}
              </VStack>
            )}
          </VStack>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmCancel != null} onOpenChange={(v) => { if (!v) setConfirmCancel(null); }}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>{t('callcenter.callback.cancel', 'Cancel the request')}</DialogTitle>
          </DialogHeader>
          <Text>
            {t(
              'callcenter.callback.cancelConfirm',
              'Cancel the request: nobody will call {{number}} back. Continue?',
            ).replace('{{number}}', confirmCancel?.caller ?? '')}
          </Text>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(null)}>
              {t('callcenter.supervisor.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmCancel) void cancelCallback(confirmCancel.id);
                setConfirmCancel(null);
              }}
            >
              {t('callcenter.callback.cancel', 'Cancel the request')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
