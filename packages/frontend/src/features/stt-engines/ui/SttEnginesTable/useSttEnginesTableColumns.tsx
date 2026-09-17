import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { TableRowAction, TableRowActions, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useDeleteSttEngineMutation } from '@/shared/api/endpoints/sttEnginesApi';
import type { ISttEngine } from '@/entities/engines';
import { sttEnginesActions } from '../../model/slice/sttEnginesSlice';
import cls from './SttEnginesTable.module.scss';

const columnHelper = createColumnHelper<ISttEngine>();

export const useSttEnginesTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteEngine] = useDeleteSttEngineMutation();

  const typeLabels: Record<string, string> = {
    google: t('sttEngines.typeGoogle'),
    yandex: t('sttEngines.typeYandex'),
    custom: t('sttEngines.typeCustom'),
  };

  return useMemo(
    () => [
      columnHelper.accessor('uid', {
        header: () => t('common.id', '№'),
        size: 60,
        cell: (info) => <Text as="span" className={cls.cell}>{info.getValue()}</Text>,
      }),
      columnHelper.accessor('name', {
        header: () => t('sttEngines.name'),
        cell: (info) => <Text as="span" className={cls.name}>{info.getValue()}</Text>,
      }),
      columnHelper.accessor('type', {
        header: () => t('sttEngines.type'),
        size: 180,
        cell: (info) => (
          <Text as="span" className={cls.cell}>
            {typeLabels[info.getValue()] || info.getValue()}
          </Text>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const engine = info.row.original;
          return (
            <TableRowActions>
              <TableRowAction
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => dispatch(sttEnginesActions.openEditModal(engine))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => {
                  if (window.confirm(t('sttEngines.confirmDelete', { name: engine.name }))) {
                    deleteEngine(engine.uid);
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
    [t, dispatch, deleteEngine, typeLabels.google, typeLabels.yandex, typeLabels.custom],
  );
};
