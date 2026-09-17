import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { TableRowAction, TableRowActions, Text } from '@/shared/ui';
import type { IVoiceRobot } from '@/entities/voiceRobot';
import cls from './VoiceRobotsTable.module.scss';

const columnHelper = createColumnHelper<IVoiceRobot>();

interface UseVoiceRobotsTableColumnsArgs {
  onEdit: (robot: IVoiceRobot) => void;
  onCopy: (robot: IVoiceRobot) => void;
  onDelete: (robot: IVoiceRobot) => void;
}

export const useVoiceRobotsTableColumns = ({
  onEdit,
  onCopy,
  onDelete,
}: UseVoiceRobotsTableColumnsArgs) => {
  const { t } = useTranslation();

  return useMemo(
    () => [
      columnHelper.accessor('uid', {
        header: () => t('voiceRobots.id'),
        cell: (info) => (
          <Text as="span" className={cls.cell}>{info.getValue()}</Text>
        ),
      }),

      columnHelper.accessor('name', {
        header: () => t('voiceRobots.name'),
        cell: (info) => (
          <Text as="span" className={cls.name}>{info.getValue()}</Text>
        ),
      }),

      columnHelper.accessor('active', {
        header: () => t('voiceRobots.status'),
        cell: (info) => {
          const active = info.getValue();
          return (
            <Text as="span" className={active ? cls.statusOn : cls.statusOff}>
              {active ? t('common.active') : t('common.inactive')}
            </Text>
          );
        },
      }),

      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const robot = info.row.original;
          return (
            <TableRowActions>
              <TableRowAction
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => onEdit(robot)}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                title={t('common.copy')}
                aria-label={t('common.copy')}
                onClick={() => onCopy(robot)}
              >
                <Copy />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => onDelete(robot)}
              >
                <Trash2 />
              </TableRowAction>
            </TableRowActions>
          );
        },
      }),
    ],
    [t, onEdit, onCopy, onDelete],
  );
};
