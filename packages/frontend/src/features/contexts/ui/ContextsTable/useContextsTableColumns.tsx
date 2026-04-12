import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { contextsActions } from '../../model/slice/contextsSlice';
import { useDeleteContextMutation, IContext } from '@/shared/api/api';

const columnHelper = createColumnHelper<IContext>();

export const useContextsTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteContext] = useDeleteContextMutation();

  const handleDelete = (uid: number) => {
    if (window.confirm(t('common.confirmDelete', 'Вы уверены, что хотите удалить?'))) {
      deleteContext(uid);
    }
  };

  return useMemo(
    () => [
      columnHelper.accessor('uid', {
        header: 'ID',
        cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('name', {
        header: t('contexts.name', 'Имя'),
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('comment', {
        header: t('contexts.description', 'Описание'),
        cell: (info) => info.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => {
          const row = info.row.original;
          return (
            <HStack gap="8" justify="end">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-white/10"
                onClick={() => dispatch(contextsActions.openEditModal(row))}
                title={t('common.edit', 'Редактировать')}
              >
                <Edit2 className="w-4 h-4 text-primary" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-destructive/10"
                onClick={() => handleDelete(row.uid)}
                title={t('common.delete', 'Удалить')}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </HStack>
          );
        },
      }),
    ],
    [t, dispatch, deleteContext]
  );
};
