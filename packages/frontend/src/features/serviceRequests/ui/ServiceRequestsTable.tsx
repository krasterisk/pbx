import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable, Button, HStack, Badge } from '@/shared/ui';
import { useGetServiceRequestsQuery, useDeleteServiceRequestMutation } from '@/shared/api/endpoints/serviceRequestApi';
import type { IServiceRequest } from '@/entities/serviceRequest';
import { REQUEST_STATUS_OPTIONS, SMS_STATUS_OPTIONS } from '@/entities/serviceRequest';
import { ServiceRequestModal } from './ServiceRequestModal';
import { toast } from 'react-toastify';
import { Edit, Trash2, Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

export function ServiceRequestsTable() {
  const { t } = useTranslation();
  const [globalFilter, setGlobalFilter] = useState('');

  const { data, isLoading, isFetching } = useGetServiceRequestsQuery({
    limit: 10000,
    offset: 0,
  });

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

  const columns = useMemo<ColumnDef<IServiceRequest>[]>(() => [
    {
      accessorKey: 'request_number',
      header: t('serviceRequests.table.number', 'Номер заявки'),
      cell: ({ row }) => row.original.request_number || `#${row.original.uid}`,
    },
    {
      accessorKey: 'call_received_at',
      header: t('serviceRequests.table.date', 'Дата поступления'),
      cell: ({ row }) => new Date(row.original.call_received_at).toLocaleString(),
    },
    {
      accessorKey: 'counterparty_name',
      header: t('serviceRequests.table.client', 'Клиент'),
      cell: ({ row }) => row.original.counterparty_name || '-',
    },
    {
      accessorKey: 'phone',
      header: t('serviceRequests.table.phone', 'Телефон'),
      cell: ({ row }) => row.original.phone || '-',
    },
    {
      accessorKey: 'topic',
      header: t('serviceRequests.table.topic', 'Тема'),
      cell: ({ row }) => row.original.topic || '-',
    },
    {
      accessorKey: 'request_status',
      header: t('serviceRequests.table.status', 'Статус'),
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
      header: t('serviceRequests.table.smsStatus', 'Статус СМС'),
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
      cell: ({ row }) => (
        <HStack gap="8" className="justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedRecord(row.original);
              setModalOpen(true);
            }}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => handleDelete(row.original.uid)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </HStack>
      ),
    },
  ], [t]);

  return (
    <div className="flex flex-col gap-4 h-full">
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4 shrink-0">
        <HStack gap="8" className="w-full sm:w-auto flex-1 max-w-sm">
          <input
            type="text"
            placeholder={t('serviceRequests.searchPlaceholder', 'Поиск заявок...')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        </HStack>
        <Button
          onClick={() => {
            setSelectedRecord(undefined);
            setModalOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('serviceRequests.create', 'Создать заявку')}
        </Button>
      </HStack>

      <div className="flex-1 overflow-hidden">
        <DataTable
          columns={columns}
          data={data?.rows || []}
          globalFilter={globalFilter}
          pageSize={20}
          className="h-full border border-border rounded-md"
        />
      </div>

      <ServiceRequestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        record={selectedRecord}
      />
    </div>
  );
}
