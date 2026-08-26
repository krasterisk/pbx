import { useMemo, useState } from 'react';
import { DataTable, Button, HStack, Badge } from '@/shared/ui';
import {
  useGetKomandorClaimsQuery,
  useDeleteKomandorClaimMutation,
} from '@/shared/api/endpoints/komandorClaimApi';
import type { IKomandorClaim } from '@/entities/komandorClaim';
import { KOMANDOR_STATUS_OPTIONS } from '@/entities/komandorClaim';
import { KomandorClaimModal } from './KomandorClaimModal';
import type { KomandorClaimFilters } from './KomandorClaimsFilter';
import { toast } from 'react-toastify';
import { Edit, Trash2, Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

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

  const columns = useMemo<ColumnDef<IKomandorClaim>[]>(() => [
    {
      header: '№',
      accessorFn: (r) => r.request_number || `#${r.uid}`,
    },
    {
      header: 'Дата',
      accessorFn: (r) => new Date(r.request_date).toLocaleDateString('ru-RU'),
    },
    {
      header: 'Магазин',
      accessorFn: (r) => [r.store_code, r.store_name].filter(Boolean).join(' '),
    },
    { header: 'Канал', accessorKey: 'channel' },
    { header: 'Тематика', accessorKey: 'topic' },
    { header: 'Подтема', accessorKey: 'subtopic' },
    {
      header: 'Статус',
      cell: ({ row }) => {
        const opt = KOMANDOR_STATUS_OPTIONS.find((o) => o.value === row.original.request_status);
        return <Badge variant={STATUS_BADGE[row.original.request_status] || 'outline'}>{opt?.label || row.original.request_status}</Badge>;
      },
    },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) => (
        <HStack gap="4">
          <Button size="icon" variant="ghost" onClick={() => { setCurrent(row.original); setOpen(true); }}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={async () => {
              if (!confirm('Удалить рекламацию?')) return;
              try {
                await remove(row.original.uid).unwrap();
                toast.success('Удалено');
              } catch {
                toast.error('Не удалось удалить');
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </HStack>
      ),
    },
  ], [remove]);

  return (
    <div>
      <div className="p-3 flex justify-end">
        <Button size="sm" onClick={() => { setCurrent(undefined); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Создать
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data?.rows || []}
        getRowId={(r) => String(r.uid)}
        emptyText={isLoading ? 'Загрузка...' : 'Рекламаций нет'}
      />
      <KomandorClaimModal isOpen={open} onClose={() => setOpen(false)} record={current} />
    </div>
  );
}
