import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { provisionTemplatesActions } from '../../model/slice/provisionTemplatesSlice';
import { useDeleteProvisionTemplateMutation, IProvisionTemplate } from '@/shared/api/api';

const columnHelper = createColumnHelper<IProvisionTemplate>();

export const useProvisionTemplatesTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteTemplate] = useDeleteProvisionTemplateMutation();

  const handleDelete = (id: number) => {
    if (window.confirm(t('common.confirmDelete', 'Вы уверены, что хотите удалить?'))) {
      deleteTemplate(id);
    }
  };

  return useMemo(
    () => [
      columnHelper.accessor('uid', {
        header: 'ID',
        cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('name', {
        header: t('provisionTemplates.name', 'Имя шаблона'),
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('vendor', {
        header: t('provisionTemplates.vendor', 'Вендор'),
        cell: (info) => info.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('model', {
        header: t('provisionTemplates.model', 'Модель'),
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
                onClick={() => dispatch(provisionTemplatesActions.openEditModal(row))}
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
    [t, dispatch, deleteTemplate]
  );
};
