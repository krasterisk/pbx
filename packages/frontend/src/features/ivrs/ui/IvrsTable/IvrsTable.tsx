import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileEdit, Trash2, Loader2, GitMerge } from 'lucide-react';
import { DataTable } from '@/shared/ui/DataTable/DataTable';
import { Button, Card, CardHeader, CardContent } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import { useGetIvrsQuery, useDeleteIvrMutation, useBulkDeleteIvrsMutation } from '@/shared/api/endpoints/ivrsApi';
import { IvrFormModal } from '../IvrFormModal/IvrFormModal';
import { IIvr } from '@/entities/ivr';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { ivrsActions } from '../../model/slice/ivrsSlice';
import { getIvrsIsModalOpen, getIvrsSelectedIvr } from '../../model/selectors/ivrsSelectors';

export const IvrsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data: ivrs = [], isLoading } = useGetIvrsQuery();
  const [deleteIvr] = useDeleteIvrMutation();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteIvrsMutation();

  const isModalOpen = useAppSelector(getIvrsIsModalOpen);
  const editIvr = useAppSelector(getIvrsSelectedIvr);
  
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

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
                title={t('common.edit', 'Редактировать')}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(ivrsActions.openEditModal(ivr));
                }}
              >
                <FileEdit className="w-4 h-4 text-indigo-400" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title={t('common.delete', 'Удалить')}
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(t('common.confirmDelete', 'Удалить это меню?'))) {
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
    [t, deleteIvr, dispatch]
  );

  const selectedCount = Object.keys(rowSelection).length;

  const handleBulkDelete = async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;
    
    if (window.confirm(t('common.confirmDelete', 'Вы уверены, что хотите удалить?'))) {
      await bulkDelete(ids).unwrap();
      setRowSelection({});
    }
  };

  return (
    <Card>
      <CardHeader>
        <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
          <HStack gap="8" align="center">
            <GitMerge className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg">
              {t('ivrs.count', { count: ivrs.length, defaultValue: `Всего: ${ivrs.length}` })}
            </span>
          </HStack>
          <HStack gap="12" align="center" className="w-full sm:w-auto">
            {selectedCount > 0 && (
              <Button
                variant="destructive"
                disabled={isDeleting}
                onClick={handleBulkDelete}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                {t('common.deleteSelected', 'Удалить выбранные')} ({selectedCount})
              </Button>
            )}
          </HStack>
        </HStack>
      </CardHeader>
      
      <CardContent className="p-0">
        <DataTable 
          columns={columns as any} 
          data={ivrs} 
          getRowId={(row: any) => String(row.uid)}
          selectable={true}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          emptyText={t('common.noData')}
          exportFilename="ivrs_export"
        />
      </CardContent>

      {isModalOpen && (
        <IvrFormModal
          isOpen={isModalOpen}
          onClose={() => dispatch(ivrsActions.closeModal())}
          ivr={editIvr}
        />
      )}
    </Card>
  );
});

IvrsTable.displayName = 'IvrsTable';


