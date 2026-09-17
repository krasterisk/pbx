import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import type { IRouteTemplate } from '@krasterisk/shared';
import { Badge, TableRowAction, TableRowActions, Text, Tooltip } from '@/shared/ui';
import { Flex } from '@/shared/ui/Stack';
import type { TemplateModalMode } from '../RouteTemplateFormModal';
import cls from './RouteTemplatesPage.module.scss';

const columnHelper = createColumnHelper<IRouteTemplate>();

export function isBuiltinTemplate(row: IRouteTemplate): boolean {
  return row.vpbx_user_uid == null;
}

export function formatTemplateUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

interface ColumnsArgs {
  onEdit: (row: IRouteTemplate) => void;
  onCopy: (row: IRouteTemplate) => void;
  onDelete: (row: IRouteTemplate) => void;
}

export function renderTemplateActions(
  row: IRouteTemplate,
  args: ColumnsArgs & { editLabel: string; copyLabel: string; deleteLabel: string; builtinHint: string },
) {
  const builtin = isBuiltinTemplate(row);
  return (
    <TableRowActions>
      <Tooltip content={builtin ? args.builtinHint : undefined}>
        <Flex>
          <TableRowAction
            title={args.editLabel}
            aria-label={args.editLabel}
            disabled={builtin}
            onClick={() => args.onEdit(row)}
          >
            <Pencil />
          </TableRowAction>
        </Flex>
      </Tooltip>
      <TableRowAction title={args.copyLabel} aria-label={args.copyLabel} onClick={() => args.onCopy(row)}>
        <Copy />
      </TableRowAction>
      <Tooltip content={builtin ? args.builtinHint : undefined}>
        <Flex>
          <TableRowAction
            danger
            title={args.deleteLabel}
            aria-label={args.deleteLabel}
            disabled={builtin}
            onClick={() => args.onDelete(row)}
          >
            <Trash2 />
          </TableRowAction>
        </Flex>
      </Tooltip>
    </TableRowActions>
  );
}

export const useRouteTemplatesTableColumns = (args: ColumnsArgs) => {
  const { t } = useTranslation();
  const editLabel = t('routes.templates.edit', 'Изменить');
  const copyLabel = t('routes.templates.copy', 'Копировать');
  const deleteLabel = t('routes.templates.delete', 'Удалить');
  const builtinHint = t('routes.templates.builtinReadOnly');

  return useMemo(
    () => [
      columnHelper.accessor('name', {
        header: t('routes.templates.name'),
        size: 220,
      }),
      columnHelper.accessor('description', {
        header: t('routes.templates.description'),
        size: 280,
        cell: (info) => (
          <Text as="span" className={cls.clip} title={info.getValue()}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor((row) => row.actions.length, {
        id: 'actionCount',
        header: t('routes.templates.columnActions'),
        size: 100,
      }),
      columnHelper.accessor((row) => row.slots.length, {
        id: 'slotCount',
        header: t('routes.templates.columnSlots'),
        size: 120,
      }),
      columnHelper.accessor((row) => (isBuiltinTemplate(row) ? 'builtin' : 'mine'), {
        id: 'source',
        header: t('routes.templates.columnSource'),
        size: 120,
        cell: (info) => (
          <Badge variant={info.getValue() === 'builtin' ? 'secondary' : 'outline'}>
            {info.getValue() === 'builtin'
              ? t('routes.templates.builtin', 'Встроенный')
              : t('routes.templates.mine', 'Мой')}
          </Badge>
        ),
      }),
      columnHelper.accessor('updated_at', {
        header: t('routes.templates.columnUpdated'),
        size: 140,
        cell: (info) => formatTemplateUpdated(info.getValue()),
      }),
      columnHelper.display({
        id: 'rowActions',
        size: 120,
        cell: (info) => renderTemplateActions(info.row.original, {
          ...args,
          editLabel,
          copyLabel,
          deleteLabel,
          builtinHint,
        }),
      }),
    ],
    [t, args, editLabel, copyLabel, deleteLabel, builtinHint],
  );
};

export type { TemplateModalMode };
