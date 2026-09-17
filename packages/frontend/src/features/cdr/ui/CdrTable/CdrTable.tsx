import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Users } from 'lucide-react';
import { Button, DataTable, Text, VStack, Skeleton } from '@/shared/ui';
import type { ICdrCall } from '@/shared/api/endpoints/cdrApi';
import { useCdrTableColumns } from './useCdrTableColumns';
import cls from './CdrTable.module.scss';

export type CdrTableRow = ICdrCall & {
  hasVoicemail?: boolean;
  hasConferenceRecording?: boolean;
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
}: CdrTableProps) => {
  const { t } = useTranslation();
  const columns = useCdrTableColumns({ onLegsClick, onVoicemailClick });
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
  );
});

CdrTable.displayName = 'CdrTable';
