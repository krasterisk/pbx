import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import {
  DataTable,
  Text,
  Badge,
  VStack,
  Skeleton,
  RecordingButton,
  Button,
} from '@/shared/ui';
import { CDR_DISPOSITION_LABELS, type ICdrCall } from '@/shared/api/endpoints/cdrApi';
import { PhoneForwarded } from 'lucide-react';

interface CdrTableProps {
  data: ICdrCall[];
  isLoading: boolean;
  totalRows: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onLegsClick?: (call: ICdrCall) => void;
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const CdrTable = memo(({
  data,
  isLoading,
  totalRows,
  currentPage,
  pageSize,
  onPageChange,
  onLegsClick,
}: CdrTableProps) => {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<ICdrCall>[]>(() => [
    {
      accessorKey: 'calldate',
      header: t('cdr.table.date', 'Дата'),
      cell: ({ row }) => (
        <Text variant="small" className="whitespace-nowrap">
          {new Date(row.original.calldate).toLocaleString('ru-RU')}
        </Text>
      ),
    },
    {
      accessorKey: 'srcDisplay',
      header: t('cdr.table.src', 'Кто звонил'),
      cell: ({ row }) => <Text variant="small">{row.original.srcDisplay}</Text>,
    },
    {
      accessorKey: 'dstDisplay',
      header: t('cdr.table.dst', 'Куда'),
      cell: ({ row }) => <Text variant="small">{row.original.dstDisplay}</Text>,
    },
    {
      accessorKey: 'dialednum',
      header: t('cdr.table.line', 'Линия'),
      cell: ({ row }) => (
        <Text variant="small" className="text-muted-foreground">
          {row.original.dialednum || '-'}
        </Text>
      ),
    },
    {
      accessorKey: 'disposition',
      header: t('cdr.table.status', 'Статус'),
      cell: ({ row }) => (
        <Badge variant={row.original.answered ? 'default' : 'secondary'}>
          {CDR_DISPOSITION_LABELS[row.original.disposition] || row.original.disposition}
        </Badge>
      ),
    },
    {
      accessorKey: 'billsec',
      header: t('cdr.table.duration', 'Длительность'),
      cell: ({ row }) => (
        <Text variant="small">{formatDuration(row.original.billsec || row.original.duration)}</Text>
      ),
    },
    {
      id: 'recording',
      header: t('cdr.table.recording', 'Запись'),
      cell: ({ row }) => (
        <RecordingButton
          uniqueid={row.original.uniqueid}
          record={row.original.record}
          recordingUrl={row.original.recordingUrl}
        />
      ),
    },
    {
      id: 'transfer',
      header: '',
      size: 48,
      cell: ({ row }) =>
        row.original.transid ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onLegsClick?.(row.original)}
            title={t('cdr.legs.title', 'История переводов')}
          >
            <PhoneForwarded className="w-3.5 h-3.5" />
          </Button>
        ) : null,
    },
  ], [t, onLegsClick]);

  if (isLoading && !data.length) {
    return (
      <VStack gap="8" className="p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </VStack>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      pageSize={pageSize}
      exportFilename="cdr-calls"
      csvDelimiter=";"
      paginationMode="server"
      totalRows={totalRows}
      currentPage={currentPage}
      onPageChange={onPageChange}
      emptyText={t('common.noData', 'Нет данных')}
    />
  );
});

CdrTable.displayName = 'CdrTable';
