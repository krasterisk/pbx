import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { TableRowActions, TableRowAction, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { provisionTemplatesActions } from '../../model/slice/provisionTemplatesSlice';
import { useDeleteProvisionTemplateMutation, type IProvisionTemplate } from '@/shared/api/api';
import cls from './ProvisionTemplatesTable.module.scss';

const columnHelper = createColumnHelper<IProvisionTemplate>();

export const useProvisionTemplatesTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteTemplate] = useDeleteProvisionTemplateMutation();

  return useMemo(
    () => [
      columnHelper.accessor('uid', {
        header: () => t('provisionTemplates.id'),
        cell: (info) => <Text as="span" className={cls.muted}>{info.getValue()}</Text>,
      }),

      columnHelper.accessor('name', {
        header: () => t('provisionTemplates.name'),
        cell: (info) => <Text as="span" className={cls.name}>{info.getValue()}</Text>,
      }),

      columnHelper.accessor('vendor', {
        header: () => t('provisionTemplates.vendor'),
        cell: (info) => (
          <Text as="span" className={cls.muted}>{info.getValue() || '-'}</Text>
        ),
      }),

      columnHelper.accessor('model', {
        header: () => t('provisionTemplates.model'),
        cell: (info) => (
          <Text as="span" className={cls.muted}>{info.getValue() || '-'}</Text>
        ),
      }),

      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const row = info.row.original;
          return (
            <TableRowActions>
              <TableRowAction
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => dispatch(provisionTemplatesActions.openEditModal(row))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => {
                  if (window.confirm(t('provisionTemplates.confirmDelete', { name: row.name }))) {
                    deleteTemplate(row.uid);
                  }
                }}
              >
                <Trash2 />
              </TableRowAction>
            </TableRowActions>
          );
        },
      }),
    ],
    [t, dispatch, deleteTemplate],
  );
};
