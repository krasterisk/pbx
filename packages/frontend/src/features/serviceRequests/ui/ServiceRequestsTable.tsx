import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable, Button, HStack, VStack, Badge, Tooltip, Text } from '@/shared/ui';
import type { DataTableRef } from '@/shared/ui';
import { useGetServiceRequestsQuery, useDeleteServiceRequestMutation } from '@/shared/api/endpoints/serviceRequestApi';
import type { IServiceRequest } from '@/entities/serviceRequest';
import { REQUEST_STATUS_OPTIONS, SMS_STATUS_OPTIONS } from '@/entities/serviceRequest';
import { ServiceRequestModal } from './ServiceRequestModal';
import type { ServiceRequestFilters } from './ServiceRequestsFilter';
import { toast } from 'react-toastify';
import { Edit, Trash2, Plus, Download } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

/** Truncated text cell with tooltip for long content */
function TruncatedCell({ text, maxLen = 30 }: { text: string | null; maxLen?: number }) {
  if (!text) return <Text variant="small" className="text-muted-foreground">—</Text>;
  if (text.length <= maxLen) return <Text variant="small">{text}</Text>;
  return (
    <Tooltip content={text} side="top">
      <Text variant="small" className="cursor-default">{text.slice(0, maxLen)}…</Text>
    </Tooltip>
  );
}

interface ServiceRequestsTableProps {
  filters: ServiceRequestFilters;
}

// ─── Status-based row highlighting ────────────────────────────
const STATUS_ROW_CLASSES: Record<string, string> = {
  new: 'bg-blue-500/5 hover:bg-blue-500/10',
  in_progress: 'bg-amber-500/5 hover:bg-amber-500/10',
  completed: 'bg-green-500/5 hover:bg-green-500/10',
  postponed: 'bg-orange-500/5 hover:bg-orange-500/10',
  impossible: 'bg-red-500/5 hover:bg-red-500/10',
};

function getRowClassName(row: IServiceRequest): string {
  return STATUS_ROW_CLASSES[row.request_status] || '';
}

const PAGE_SIZE = 30;

export function ServiceRequestsTable({ filters }: ServiceRequestsTableProps) {
  const { t } = useTranslation();
  const tableRef = useRef<DataTableRef>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Reset page when filters change
  React.useEffect(() => { setCurrentPage(0); }, [filters]);

  const { data } = useGetServiceRequestsQuery({
    limit: PAGE_SIZE,
    offset: currentPage * PAGE_SIZE,
    status: filters.status,
    district: filters.district,
    topic: filters.topic,
    search: filters.search,
  });

  // Client-side filtering for zone and date (not yet supported by backend)
  const filteredRows = useMemo(() => {
    let rows = data?.rows || [];
    if (filters.territorialZone) {
      rows = rows.filter((r) => r.territorial_zone === filters.territorialZone);
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      rows = rows.filter((r) => new Date(r.call_received_at) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo + 'T23:59:59');
      rows = rows.filter((r) => new Date(r.call_received_at) <= to);
    }
    return rows;
  }, [data?.rows, filters.territorialZone, filters.dateFrom, filters.dateTo]);

  const [deleteReq] = useDeleteServiceRequestMutation();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<IServiceRequest | undefined>(undefined);

  const handleDelete = async (id: number) => {
    if (confirm(t('common.confirmDelete', 'Удалить эту запись?'))) {
      try {
        await deleteReq(id).unwrap();
        toast.success(t('common.deleted', 'Удалено'));
      } catch (err: any) {
        toast.error(err.data?.message || t('common.error', 'Ошибка удаления'));
      }
    }
  };

  const handleExport = useCallback(() => {
    tableRef.current?.exportCsv();
  }, []);

  const columns = useMemo<ColumnDef<IServiceRequest>[]>(() => [
    {
      accessorKey: 'request_number',
      header: '№',
      size: 120,
      cell: ({ row }) => (
        <Text variant="small" className="font-medium text-primary whitespace-nowrap">
          {row.original.request_number || `#${row.original.uid}`}
        </Text>
      ),
    },
    {
      accessorKey: 'call_received_at',
      header: 'Дата',
      size: 100,
      cell: ({ row }) => (
        <Text variant="small" className="whitespace-nowrap">
          {new Date(row.original.call_received_at).toLocaleDateString('ru-RU')}
        </Text>
      ),
    },
    {
      accessorKey: 'operator_name',
      header: 'Оператор',
      size: 120,
      cell: ({ row }) => <TruncatedCell text={row.original.operator_name} maxLen={18} />,
    },
    {
      accessorKey: 'counterparty_name',
      header: 'Клиент',
      size: 150,
      cell: ({ row }) => <TruncatedCell text={row.original.counterparty_name} maxLen={22} />,
    },
    {
      accessorKey: 'phone',
      header: 'Телефон',
      size: 130,
      cell: ({ row }) => (
        <Text variant="small" className="whitespace-nowrap">{row.original.phone || '—'}</Text>
      ),
    },
    {
      accessorKey: 'topic',
      header: 'Тема',
      size: 160,
      cell: ({ row }) => <TruncatedCell text={row.original.topic} maxLen={22} />,
    },
    {
      accessorKey: 'territorial_zone',
      header: 'Зона',
      size: 110,
      cell: ({ row }) => <TruncatedCell text={row.original.territorial_zone} maxLen={16} />,
    },
    {
      accessorKey: 'district',
      header: 'Район',
      size: 120,
      cell: ({ row }) => <TruncatedCell text={row.original.district} maxLen={16} />,
    },
    {
      accessorKey: 'comment',
      header: 'Обращение',
      size: 140,
      cell: ({ row }) => <TruncatedCell text={row.original.comment} maxLen={25} />,
    },
    {
      accessorKey: 'schedule_comment',
      header: 'Ответ по срокам',
      size: 130,
      cell: ({ row }) => <TruncatedCell text={row.original.schedule_comment} maxLen={20} />,
    },
    {
      accessorKey: 'request_status',
      header: 'Статус',
      size: 100,
      cell: ({ row }) => {
        const val = row.original.request_status;
        const opt = REQUEST_STATUS_OPTIONS.find((o) => o.value === val);
        return (
          <Badge variant={val === 'new' ? 'outline' : val === 'completed' ? 'default' : 'secondary'}>
            {opt ? t(opt.labelKey, opt.fallback) : val}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'sms_status',
      header: 'СМС',
      size: 90,
      cell: ({ row }) => {
        const val = row.original.sms_status;
        const opt = SMS_STATUS_OPTIONS.find((o) => o.value === val);
        return (
          <Badge variant={val === 'delivered' ? 'default' : val === 'not_sent' ? 'outline' : 'secondary'}>
            {opt ? t(opt.labelKey, opt.fallback) : val}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      size: 80,
      cell: ({ row }) => (
        <HStack gap="4" className="justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setSelectedRecord(row.original);
              setModalOpen(true);
            }}
          >
            <Edit className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => handleDelete(row.original.uid)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </HStack>
      ),
    },
  ], [t]);

  return (
    <VStack gap="0" className="h-full">
      {/* Header */}
      <HStack justify="between" align="center" className="px-4 py-3 border-b border-border/50 bg-muted/20 shrink-0">
        <Text className="text-base font-medium">
          Заявки
          {filteredRows.length > 0 && (
            <span className="ml-2 text-sm text-muted-foreground font-normal">
              ({filteredRows.length})
            </span>
          )}
        </Text>
        <HStack gap="8">
          <Button variant="ghost" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            <Text variant="small">Экспорт</Text>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSelectedRecord(undefined);
              setModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            <Text variant="small">Создать заявку</Text>
          </Button>
        </HStack>
      </HStack>

      {/* Table */}
      <VStack className="flex-1 overflow-auto">
        <DataTable
          ref={tableRef}
          columns={columns}
          data={filteredRows}
          pageSize={PAGE_SIZE}
          exportFilename="service-requests"
          getRowClassName={getRowClassName}
          paginationMode="server"
          totalRows={data?.count || 0}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </VStack>

      <ServiceRequestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        record={selectedRecord}
      />
    </VStack>
  );
}
