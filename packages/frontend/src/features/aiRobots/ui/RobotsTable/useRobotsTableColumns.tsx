import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import type { AiVoiceRobot } from '@krasterisk/shared';
import { Pencil, Copy } from 'lucide-react';
import { Text, TableRowActions, TableRowAction } from '@/shared/ui';

export function useRobotsTableColumns(onEdit: (robot: AiVoiceRobot) => void, onCopy: (robot: AiVoiceRobot) => void) {
  const { t } = useTranslation();
  return useMemo<ColumnDef<AiVoiceRobot>[]>(() => [
    { id: 'name', accessorFn: row => row.config.name, header: t('aiVoiceDesigner.name'),
      cell: ({ row }) => <Text>{row.original.config.name}</Text> },
    { id: 'mode', accessorFn: row => row.config.mode, header: t('aiVoiceDesigner.pipeline'),
      cell: ({ row }) => <Text>{t(`aiVoiceDesigner.${row.original.config.mode}`)}</Text> },
    { id: 'enabled', accessorFn: row => row.config.enabled, header: t('aiVoiceDesigner.enabled'),
      cell: ({ row }) => <Text>{t(`aiVoiceDesigner.${row.original.config.enabled ? 'active' : 'inactive'}`)}</Text> },
    { accessorKey: 'revision', header: t('aiVoiceDesigner.revision') },
    { id: 'actions', header: '', cell: ({ row }) => <TableRowActions>
      <TableRowAction title={t('common.edit')} aria-label={t('common.edit')} onClick={() => onEdit(row.original)}><Pencil /></TableRowAction>
      <TableRowAction title={t('aiVoiceDesigner.copy')} aria-label={t('aiVoiceDesigner.copy')} onClick={() => onCopy(row.original)}><Copy /></TableRowAction>
    </TableRowActions> },
  ], [t, onEdit, onCopy]);
}
