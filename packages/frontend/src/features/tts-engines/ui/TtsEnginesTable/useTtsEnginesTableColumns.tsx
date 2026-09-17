import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { TableRowAction, TableRowActions, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useDeleteTtsEngineMutation } from '@/shared/api/endpoints/ttsEnginesApi';
import type { ITtsEngine } from '@/entities/engines';
import { ttsEnginesActions } from '../../model/slice/ttsEnginesSlice';
import cls from './TtsEnginesTable.module.scss';

const columnHelper = createColumnHelper<ITtsEngine>();

export const useTtsEnginesTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteEngine] = useDeleteTtsEngineMutation();

  const typeLabels: Record<string, string> = {
    google: t('ttsEngines.typeGoogle'),
    yandex: t('ttsEngines.typeYandex'),
    custom: t('ttsEngines.typeCustom'),
  };

  return useMemo(
    () => [
      columnHelper.accessor('uid', {
        header: () => t('common.id', '№'),
        size: 60,
        cell: (info) => <Text as="span" className={cls.cell}>{info.getValue()}</Text>,
      }),
      columnHelper.accessor('name', {
        header: () => t('ttsEngines.name'),
        cell: (info) => <Text as="span" className={cls.name}>{info.getValue()}</Text>,
      }),
      columnHelper.accessor('type', {
        header: () => t('ttsEngines.type'),
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
                onClick={() => dispatch(ttsEnginesActions.openEditModal(engine))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => {
                  if (window.confirm(t('ttsEngines.confirmDelete', { name: engine.name }))) {
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
