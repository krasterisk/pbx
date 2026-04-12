import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileEdit, Trash2, Plus } from 'lucide-react';
import { DataTable } from '@/shared/ui/DataTable/DataTable';
import { Button } from '@/shared/ui';
import { useGetIvrsQuery, useDeleteIvrMutation } from '@/shared/api/endpoints/ivrsApi';
import { IvrFormModal } from '../IvrFormModal/IvrFormModal';
import { IIvr } from '@/entities/ivr';

export const IvrsTable = memo(() => {
  const { t } = useTranslation();
  const { data: ivrs = [], isLoading } = useGetIvrsQuery();
  const [deleteIvr] = useDeleteIvrMutation();

  const [editIvr, setEditIvr] = useState<IIvr | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const columns = useMemo(
    () => [
      {
        header: t('ivrs.table.exten', 'Номер'),
        accessorKey: 'exten',
      },
      {
        header: t('ivrs.table.name', 'Наименование'),
        accessorKey: 'name',
      },
      {
        header: t('ivrs.table.timeout', 'Таймаут'),
        accessorKey: 'timeout',
      },
      {
        header: t('ivrs.table.maxCount', 'Ограничение переходов'),
        accessorKey: 'max_count',
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: (info: any) => {
          const ivr = info.row.original as IIvr;
          return (
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditIvr(ivr);
                  setIsModalOpen(true);
                }}
              >
                <FileEdit className="w-4 h-4 text-indigo-400" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(t('common.confirmDelete', 'Удалить это меню?'))) {
                    deleteIvr(ivr.uid);
                  }
                }}
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          );
        },
      },
    ],
    [t, deleteIvr]
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{t('ivrs.title', 'Голосовые меню (IVR)')}</h2>
        <Button
          onClick={() => {
            setEditIvr(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('ivrs.add', 'Добавить IVR')}
        </Button>
      </div>

      <div className="bg-[#09090b] rounded-lg border border-[#27272a] overflow-hidden">
        <DataTable columns={columns} data={ivrs} loading={isLoading} />
      </div>

      {isModalOpen && (
        <IvrFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          ivr={editIvr}
        />
      )}
    </div>
  );
});

IvrsTable.displayName = 'IvrsTable';
