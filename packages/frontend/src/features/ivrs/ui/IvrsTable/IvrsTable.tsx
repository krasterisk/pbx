import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileEdit, Trash2, Copy, Loader2 } from 'lucide-react';
import { DataTable } from '@/shared/ui/DataTable/DataTable';
import { Button, Skeleton } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetIvrsQuery, useDeleteIvrMutation, useBulkDeleteIvrsMutation } from '@/shared/api/endpoints/ivrsApi';
import { IvrFormModal } from '../IvrFormModal/IvrFormModal';
import { IIvr } from '@/entities/ivr';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { ivrsActions } from '../../model/slice/ivrsSlice';
import { getIvrsIsModalOpen, getIvrsSelectedIvr, getIvrsModalMode } from '../../model/selectors/ivrsSelectors';
import cls from './IvrsTable.module.scss';

const SKELETON_ROWS = [1, 2, 3, 4, 5];

export const IvrsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data: ivrs = [], isLoading } = useGetIvrsQuery();
  const [deleteIvr] = useDeleteIvrMutation();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteIvrsMutation();

  const isModalOpen = useAppSelector(getIvrsIsModalOpen);
  const editIvr = useAppSelector(getIvrsSelectedIvr);
  const modalMode = useAppSelector(getIvrsModalMode);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const emptyText = `${t('ivrs.empty.title', 'Нет голосовых меню')}\n${t('ivrs.empty.hint', 'Нажмите «Добавить IVR», чтобы создать первое меню')}`;

  const columns = useMemo(
    () => [
      {
        header: t('ivrs.table.name', 'Наименование'),
        accessorKey: 'name',
      },
      {
        header: t('ivrs.table.timeout', 'Ожидание выбора'),
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
        cell: (info: { row: { original: IIvr } }) => {
          const ivr = info.row.original;
          return (
            <HStack gap="4" justify="end">
              <Button
                variant="ghost"
                size="icon"
                title={t('common.edit', 'Редактировать')}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(ivrsActions.openEditModal(ivr));
                }}
              >
                <FileEdit className={cls.actionIcon} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title={t('common.copy', 'Копировать')}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(ivrsActions.openCopyModal(ivr));
                }}
              >
                <Copy className={cls.actionIcon} />
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
                <Trash2 className={`${cls.actionIcon} ${cls.actionIconDanger}`} />
              </Button>
            </HStack>
          );
        },
      },
    ],
    [t, deleteIvr, dispatch],
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

  if (isLoading) {
    return (
      <>
        <div className={cls.loadingWrap}>
          {SKELETON_ROWS.map((i) => (
            <Skeleton key={i} className={cls.skeletonRow} />
          ))}
        </div>
        {isModalOpen && (
          <IvrFormModal
            isOpen={isModalOpen}
            onClose={() => dispatch(ivrsActions.closeModal())}
            ivr={editIvr}
            mode={modalMode}
          />
        )}
      </>
    );
  }

  return (
    <>
      {selectedCount > 0 && (
        <HStack justify="end" align="center" className={cls.bulkBar}>
          <Button
            variant="destructive"
            disabled={isDeleting}
            onClick={handleBulkDelete}
          >
            {isDeleting ? (
              <Loader2 size={16} />
            ) : (
              <Trash2 size={16} />
            )}
            {t('common.deleteSelected', 'Удалить выбранные')} ({selectedCount})
          </Button>
        </HStack>
      )}

      <DataTable
        columns={columns as never}
        data={ivrs}
        getRowId={(row: IIvr) => String(row.uid)}
        selectable
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        emptyText={emptyText}
        exportFilename="ivrs_export"
      />

      {isModalOpen && (
        <IvrFormModal
          isOpen={isModalOpen}
          onClose={() => dispatch(ivrsActions.closeModal())}
          ivr={editIvr}
          mode={modalMode}
        />
      )}
    </>
  );
});

IvrsTable.displayName = 'IvrsTable';
