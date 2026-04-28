import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable, Button, HStack, VStack, Badge, Tooltip, Text, Flex, Skeleton } from '@/shared/ui';
import type { DataTableRef } from '@/shared/ui';
import { useGetServiceRequestsQuery, useDeleteServiceRequestMutation } from '@/shared/api/endpoints/serviceRequestApi';
import type { IServiceRequest } from '@/entities/serviceRequest';
import { REQUEST_STATUS_OPTIONS, SMS_STATUS_OPTIONS } from '@/entities/serviceRequest';
import { ServiceRequestModal } from './ServiceRequestModal';
import type { ServiceRequestFilters } from './ServiceRequestsFilter';
import { toast } from 'react-toastify';
import { Edit, Trash2, Plus, Download, Phone, MapPin, Calendar, User, MessageSquare, ChevronRight } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

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

// ─── Status badge variant mapping ─────────────────────────────
const STATUS_BADGE_VARIANT: Record<string, 'default' | 'outline' | 'secondary' | 'destructive'> = {
  new: 'outline',
  in_progress: 'secondary',
  completed: 'default',
  postponed: 'secondary',
  impossible: 'destructive',
};

// ─── Status left-border color for mobile cards ────────────────
const STATUS_CARD_BORDER: Record<string, string> = {
  new: 'border-l-blue-500',
  in_progress: 'border-l-amber-500',
  completed: 'border-l-green-500',
  postponed: 'border-l-orange-500',
  impossible: 'border-l-red-500',
};

function getRowClassName(row: IServiceRequest): string {
  return STATUS_ROW_CLASSES[row.request_status] || '';
}

const PAGE_SIZE = 30;

// ─── Mobile card for a single service request ─────────────────
function MobileRequestCard({
  record,
  onEdit,
  onDelete,
  t,
}: {
  record: IServiceRequest;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string, defaultValue?: string) => string;
}) {
  const statusOpt = REQUEST_STATUS_OPTIONS.find((o) => o.value === record.request_status);
  const smsOpt = SMS_STATUS_OPTIONS.find((o) => o.value === record.sms_status);
  const borderClass = STATUS_CARD_BORDER[record.request_status] || '';
  const badgeVariant = STATUS_BADGE_VARIANT[record.request_status] || 'outline';

  return (
    <div
      className={`border rounded-lg p-3 bg-background/50 border-l-4 ${borderClass} active:bg-muted/30 transition-colors`}
      onClick={onEdit}
    >
      {/* Row 1: Number + Status + Date */}
      <Flex justify="between" align="start" className="mb-2">
        <VStack gap="2">
          <Text variant="small" className="font-semibold text-primary">
            {record.request_number || `#${record.uid}`}
          </Text>
          <Flex align="center" gap="4">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            <Text variant="small" className="text-muted-foreground text-xs">
              {new Date(record.call_received_at).toLocaleDateString('ru-RU')}
            </Text>
          </Flex>
        </VStack>
        <Flex align="center" gap="4">
          <Badge variant={badgeVariant} className="text-xs">
            {statusOpt ? t(statusOpt.labelKey, statusOpt.fallback) : record.request_status}
          </Badge>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </Flex>
      </Flex>

      {/* Row 2: Client + Phone */}
      <VStack gap="4" className="mb-2">
        {record.counterparty_name && (
          <Flex align="center" gap="6">
            <User className="w-3 h-3 text-muted-foreground shrink-0" />
            <Text variant="small" className="truncate">{record.counterparty_name}</Text>
          </Flex>
        )}
        {record.phone && (
          <Flex align="center" gap="6">
            <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
            <Text variant="small" className="text-muted-foreground">{record.phone}</Text>
          </Flex>
        )}
      </VStack>

      {/* Row 3: Topic + Zone/District */}
      <VStack gap="4" className="mb-2">
        {record.topic && (
          <Flex align="center" gap="6">
            <MessageSquare className="w-3 h-3 text-muted-foreground shrink-0" />
            <Text variant="small" className="truncate text-muted-foreground">{record.topic}</Text>
          </Flex>
        )}
        {(record.territorial_zone || record.district) && (
          <Flex align="center" gap="6">
            <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
            <Text variant="small" className="text-muted-foreground truncate">
              {[record.territorial_zone, record.district].filter(Boolean).join(' / ')}
            </Text>
          </Flex>
        )}
      </VStack>

      {/* Row 4: Comment preview */}
      {record.comment && (
        <Text variant="small" className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {record.comment}
        </Text>
      )}

      {/* Row 5: SMS + Actions */}
      <Flex justify="between" align="center" className="pt-2 border-t border-border/30">
        {smsOpt ? (
          <Badge variant={record.sms_status === 'delivered' ? 'default' : record.sms_status === 'not_sent' ? 'outline' : 'secondary'} className="text-xs">
            СМС: {t(smsOpt.labelKey, smsOpt.fallback)}
          </Badge>
        ) : (
          <div />
        )}
        <HStack gap="4">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Edit className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </HStack>
      </Flex>
    </div>
  );
}

// ─── Mobile skeleton ──────────────────────────────────────────
function MobileCardSkeleton() {
  return (
    <div className="border rounded-lg p-3 bg-background/50 border-l-4 border-l-muted">
      <Flex justify="between" align="start" className="mb-2">
        <VStack gap="4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-24" />
        </VStack>
        <Skeleton className="h-5 w-16 rounded-full" />
      </Flex>
      <VStack gap="4" className="mb-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-32" />
      </VStack>
      <Skeleton className="h-3 w-full mb-2" />
      <Flex justify="between" align="center" className="pt-2 border-t border-border/30">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-6 w-16" />
      </Flex>
    </div>
  );
}

export function ServiceRequestsTable({ filters }: ServiceRequestsTableProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const tableRef = useRef<DataTableRef>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Reset page when filters change
  React.useEffect(() => { setCurrentPage(0); }, [filters]);

  const { data, isLoading } = useGetServiceRequestsQuery({
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

  // ─── Mobile layout ──────────────────────────────────────
  if (isMobile) {
    return (
      <VStack gap="0" className="h-full">
        {/* Header */}
        <Flex justify="between" align="center" className="px-3 py-2.5 border-b border-border/50 bg-muted/20 shrink-0">
          <Text className="text-sm font-medium">
            Заявки
            {filteredRows.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                ({filteredRows.length})
              </span>
            )}
          </Text>
          <HStack gap="4">
            <Button variant="ghost" size="sm" onClick={handleExport} className="h-8 px-2">
              <Download className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              className="h-8 px-2.5"
              onClick={() => {
                setSelectedRecord(undefined);
                setModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              <Text variant="small" className="text-xs">Создать</Text>
            </Button>
          </HStack>
        </Flex>

        {/* Card list */}
        <VStack className="flex-1 overflow-auto p-3 gap-2">
          {isLoading ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <MobileCardSkeleton key={i} />
              ))}
            </>
          ) : filteredRows.length === 0 ? (
            <Flex justify="center" align="center" className="py-12">
              <Text variant="muted">Нет данных</Text>
            </Flex>
          ) : (
            filteredRows.map((record) => (
              <MobileRequestCard
                key={record.uid}
                record={record}
                onEdit={() => {
                  setSelectedRecord(record);
                  setModalOpen(true);
                }}
                onDelete={() => handleDelete(record.uid)}
                t={t as any}
              />
            ))
          )}
        </VStack>

        {/* Pagination for mobile */}
        {data && data.count > PAGE_SIZE && (
          <Flex justify="center" align="center" gap="8" className="p-3 border-t border-border/50 bg-muted/10 shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              className="h-8 text-xs"
            >
              ← Назад
            </Button>
            <Text variant="small" className="text-muted-foreground">
              {currentPage + 1} / {Math.ceil(data.count / PAGE_SIZE)}
            </Text>
            <Button
              variant="outline"
              size="sm"
              disabled={(currentPage + 1) * PAGE_SIZE >= data.count}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="h-8 text-xs"
            >
              Далее →
            </Button>
          </Flex>
        )}

        <ServiceRequestModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          record={selectedRecord}
        />
      </VStack>
    );
  }

  // ─── Desktop layout ─────────────────────────────────────
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
