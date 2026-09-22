import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Users } from 'lucide-react';
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Text,
  VStack,
  Skeleton,
} from '@/shared/ui';
import type { ICdrCall } from '@/shared/api/endpoints/cdrApi';
import { useCdrTableColumns } from './useCdrTableColumns';
import cls from './CdrTable.module.scss';

export type CdrTableRow = ICdrCall & {
  hasVoicemail?: boolean;
  hasConferenceRecording?: boolean;
  /** Journal conversation id when this CDR call already has analytics (D-05). */
  journalConversationId?: string | null;
  /** Module entitlement for speech analytics (D-18). */
  speechAnalyticsActive?: boolean;
  /** Project bound on the call route; null triggers ask-project dialog (D-18). */
  routeProjectId?: string | null;
  /** Company pause must not hide manual Get analytics (D-19) — carried for callers. */
  companyPaused?: boolean;
};

export type CdrGetAnalyticsPayload = {
  uniqueid: string;
  linkedid: string;
  projectId: string;
};

interface CdrTableProps {
  data: CdrTableRow[];
  isLoading: boolean;
  totalRows: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onLegsClick?: (call: ICdrCall) => void;
  onVoicemailClick?: (uniqueid: string) => void;
  onConferenceClick?: (uniqueid: string) => void;
  onOpenAnalytics?: (conversationId: string) => void;
  onGetAnalytics?: (payload: CdrGetAnalyticsPayload) => void;
  getAnalyticsBusyUniqueid?: string | null;
  analyticsStartErrorByUniqueid?: Record<string, string>;
}

export const CdrTable = memo(({
  data,
  isLoading,
  totalRows,
  currentPage,
  pageSize,
  onPageChange,
  onLegsClick,
  onVoicemailClick,
  onConferenceClick,
  onOpenAnalytics,
  onGetAnalytics,
  getAnalyticsBusyUniqueid,
  analyticsStartErrorByUniqueid,
}: CdrTableProps) => {
  const { t } = useTranslation();
  const [askProjectOpen, setAskProjectOpen] = useState(false);

  const handleRequestGetAnalytics = useCallback((row: CdrTableRow) => {
    const projectId = row.routeProjectId?.trim();
    if (!projectId) {
      setAskProjectOpen(true);
      return;
    }
    onGetAnalytics?.({
      uniqueid: row.uniqueid,
      linkedid: row.linkedid,
      projectId,
    });
  }, [onGetAnalytics]);

  const columns = useCdrTableColumns({
    onLegsClick,
    onVoicemailClick,
    onOpenAnalytics,
    onRequestGetAnalytics: handleRequestGetAnalytics,
    getAnalyticsBusyUniqueid,
    analyticsStartErrorByUniqueid,
  });
  const conferenceLabel = t('conferences.cdr.detailsTitle', 'Запись конференции');
  const tableColumns = useMemo<ColumnDef<CdrTableRow>[]>(() => [
    ...columns,
    {
      id: 'conferenceRecording',
      header: '',
      size: 40,
      cell: ({ row }) =>
        row.original.hasConferenceRecording ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cls.iconBtn}
            title={conferenceLabel}
            aria-label={conferenceLabel}
            onClick={(e) => {
              e.stopPropagation();
              onConferenceClick?.(row.original.uniqueid);
            }}
          >
            <Users size={14} />
          </Button>
        ) : null,
    },
  ], [columns, conferenceLabel, onConferenceClick]);

  if (isLoading && !data.length) {
    return (
      <VStack gap="8" className={cls.loading}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className={cls.skeletonRow} />
        ))}
      </VStack>
    );
  }

  return (
    <>
      <DataTable
        className={cls.table}
        columns={tableColumns}
        data={data}
        pageSize={pageSize}
        exportFilename="cdr-calls"
        csvDelimiter=";"
        paginationMode="server"
        totalRows={totalRows}
        currentPage={currentPage}
        onPageChange={onPageChange}
        emptyText={t('common.noData')}
      />

      <Dialog open={askProjectOpen} onOpenChange={setAskProjectOpen}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>
              {t('speechAnalytics.askProjectBeforeAnalyze', 'Выберите проект аналитики')}
            </DialogTitle>
          </DialogHeader>
          <Text variant="muted">
            {t(
              'speechAnalytics.askProjectBeforeAnalyzeHint',
              'Назначьте проект аналитики на маршруте этого звонка, затем повторите.',
            )}
          </Text>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAskProjectOpen(false)}>
              {t('common.close', 'Закрыть')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

CdrTable.displayName = 'CdrTable';
