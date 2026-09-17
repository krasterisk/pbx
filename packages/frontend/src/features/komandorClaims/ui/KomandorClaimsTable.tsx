import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'react-toastify';
import {
  Badge,
  Button,
  DataTable,
  TableRowAction,
  TableRowActions,
  Text,
} from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import {
  useDeleteKomandorClaimMutation,
  useGetKomandorClaimsQuery,
} from '@/shared/api/endpoints/komandorClaimApi';
import type { IKomandorClaim } from '@/entities/komandorClaim';
import { KOMANDOR_STATUS_OPTIONS } from '@/entities/komandorClaim';
import { KomandorClaimModal } from './KomandorClaimModal';
import type { KomandorClaimFilters } from './KomandorClaimsFilter';
import cls from './KomandorClaimsTable.module.scss';

interface Props {
  filters: KomandorClaimFilters;
}

const STATUS_BADGE: Record<string, 'default' | 'outline' | 'secondary' | 'destructive'> = {
  new: 'outline',
  in_progress: 'secondary',
  completed: 'default',
  postponed: 'secondary',
  impossible: 'destructive',
};

export function KomandorClaimsTable({ filters }: Props) {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const query = {
    search: filters.search,
    status: filters.status,
    topic: filters.topic,
    store: filters.store,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    limit: 50,
  };
  const { data, isLoading } = useGetKomandorClaimsQuery(query);
  const [remove] = useDeleteKomandorClaimMutation();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<IKomandorClaim | undefined>();
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const selectedCount = Object.keys(rowSelection).length;

  const handleDelete = useCallback(async (uid: number) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await remove(uid).unwrap();
      toast.success(t('common.deleted', 'Удалено'));
    } catch {
      toast.error(t('common.error'));
    }
  }, [remove, t]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;
    if (!window.confirm(t('common.confirmDelete'))) return;
    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => remove(id).unwrap()));
      setRowSelection({});
      toast.success(t('common.deleted', 'Удалено'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setIsDeleting(false);
    }
  }, [rowSelection, remove, t]);

  const columns = useMemo<ColumnDef<IKomandorClaim>[]>(() => [
    {
      header: '№',
      accessorFn: (row) => row.request_number || `#${row.uid}`,
    },
    {
      header: 'Дата',
      accessorFn: (row) => new Date(row.request_date).toLocaleDateString('ru-RU'),
    },
    {
      header: 'Магазин',
      accessorFn: (row) => [row.store_code, row.store_name].filter(Boolean).join(' '),
    },
    { header: 'Канал', accessorKey: 'channel' },
    { header: 'Тематика', accessorKey: 'topic' },
    { header: 'Подтема', accessorKey: 'subtopic' },
    {
      header: 'Статус',
      cell: ({ row }) => {
        const opt = KOMANDOR_STATUS_OPTIONS.find((o) => o.value === row.original.request_status);
        return (
          <Badge variant={STATUS_BADGE[row.original.request_status] || 'outline'}>
            {opt?.label || row.original.request_status}
          </Badge>
        );
      },
    },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) => (
        <TableRowActions>
          <TableRowAction
            title={t('common.edit')}
            aria-label={t('common.edit')}
            onClick={() => {
              setCurrent(row.original);
              setOpen(true);
            }}
          >
            <Pencil />
          </TableRowAction>
          <TableRowAction
            danger
            title={t('common.delete')}
            aria-label={t('common.delete')}
            onClick={() => void handleDelete(row.original.uid)}
          >
            <Trash2 />
          </TableRowAction>
        </TableRowActions>
      ),
    },
  ], [handleDelete, t]);

  return (
    <div>
      <HStack justify="end" gap="8" align="center" className={cls.toolbar}>
        <HStack gap="8" align="center" className={cls.toolbarActions}>
          {!isMobile && (
            <Button
              variant="destructive"
              className={selectedCount === 0 ? cls.bulkBtnHidden : undefined}
              disabled={isDeleting || selectedCount === 0}
              aria-hidden={selectedCount === 0}
              tabIndex={selectedCount === 0 ? -1 : undefined}
              onClick={() => void handleBulkDelete()}
            >
              {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : <Trash2 size={16} />}
              {t('common.deleteSelected', { count: selectedCount })}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setCurrent(undefined);
              setOpen(true);
            }}
          >
            <Plus size={16} />
            <Text as="span">{t('common.create', 'Создать')}</Text>
          </Button>
        </HStack>
      </HStack>
      <DataTable
        columns={columns}
        data={data?.rows || []}
        getRowId={(row) => String(row.uid)}
        selectable
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        emptyText={isLoading ? t('common.loading', 'Загрузка...') : t('common.noData')}
      />
      <KomandorClaimModal isOpen={open} onClose={() => setOpen(false)} record={current} />
    </div>
  );
}
