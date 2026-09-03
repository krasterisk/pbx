import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Copy, LayoutTemplate, Pencil, Plus, Trash2 } from 'lucide-react';
import type { IRouteTemplate } from '@krasterisk/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  TableRowAction,
  TableRowActions,
  Text,
  Tooltip,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import {
  useDeleteRouteTemplateMutation,
  useGetRouteTemplatesQuery,
} from '@/shared/api/endpoints/routeTemplateApi';
import { RouteTemplateFormModal, type TemplateModalMode } from '../RouteTemplateFormModal';
import styles from './RouteTemplatesPage.module.scss';

const columnHelper = createColumnHelper<IRouteTemplate>();

function isBuiltin(row: IRouteTemplate): boolean {
  return row.vpbx_user_uid == null;
}

function formatUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export function RouteTemplatesPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const { data: templates = [], isLoading } = useGetRouteTemplatesQuery();
  const [deleteTemplate] = useDeleteRouteTemplateMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<TemplateModalMode>('create');
  const [selected, setSelected] = useState<IRouteTemplate | null>(null);

  const openCreate = () => {
    setSelected(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const openEdit = (row: IRouteTemplate) => {
    setSelected(row);
    setModalMode('edit');
    setModalOpen(true);
  };

  const openCopy = (row: IRouteTemplate) => {
    setSelected(row);
    setModalMode('copy');
    setModalOpen(true);
  };

  const confirmDelete = (row: IRouteTemplate) => {
    const message = t(
      'routes.templates.confirmDelete',
      'Удалить шаблон: шаблон "{{name}}" будет удалён. Маршруты, созданные из него, не изменятся. Продолжить?',
    ).replace('{{name}}', row.name);
    if (window.confirm(message)) {
      void deleteTemplate(row.uid);
    }
  };

  const builtinHint = t(
    'routes.templates.builtinReadOnly',
    'Встроенный шаблон нельзя изменить. Сохраните свою копию',
  );
  const editLabel = t('routes.templates.edit', 'Изменить');
  const copyLabel = t('routes.templates.copy', 'Копировать');
  const deleteLabel = t('routes.templates.delete', 'Удалить');

  const renderActions = (row: IRouteTemplate) => {
    const builtin = isBuiltin(row);
    return (
      <TableRowActions>
        <Tooltip content={builtin ? builtinHint : undefined}>
          <Flex>
            <TableRowAction
              title={editLabel}
              aria-label={editLabel}
              disabled={builtin}
              onClick={() => openEdit(row)}
            >
              <Pencil />
            </TableRowAction>
          </Flex>
        </Tooltip>
        <TableRowAction title={copyLabel} aria-label={copyLabel} onClick={() => openCopy(row)}>
          <Copy />
        </TableRowAction>
        <Tooltip content={builtin ? builtinHint : undefined}>
          <Flex>
            <TableRowAction
              danger
              title={deleteLabel}
              aria-label={deleteLabel}
              disabled={builtin}
              onClick={() => confirmDelete(row)}
            >
              <Trash2 />
            </TableRowAction>
          </Flex>
        </Tooltip>
      </TableRowActions>
    );
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: t('routes.templates.name', 'Название'),
        size: 220,
      }),
      columnHelper.accessor('description', {
        header: t('routes.templates.description', 'Описание'),
        size: 280,
        cell: (info) => (
          <Text className={styles.clip} title={info.getValue()}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor((row) => row.actions.length, {
        id: 'actionCount',
        header: t('routes.templates.columnActions', 'Действий'),
        size: 100,
      }),
      columnHelper.accessor((row) => row.slots.length, {
        id: 'slotCount',
        header: t('routes.templates.columnSlots', 'Подстановок'),
        size: 120,
      }),
      columnHelper.accessor((row) => (isBuiltin(row) ? 'builtin' : 'mine'), {
        id: 'source',
        header: t('routes.templates.columnSource', 'Источник'),
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
        header: t('routes.templates.columnUpdated', 'Обновлён'),
        size: 140,
        cell: (info) => formatUpdated(info.getValue()),
      }),
      columnHelper.display({
        id: 'rowActions',
        size: 120,
        cell: (info) => renderActions(info.row.original),
      }),
    ],
    [t],
  );

  return (
    <VStack gap="24" max className={styles.page}>
      <Flex justify="between" align="center" className={styles.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={styles.iconBadge}>
            <LayoutTemplate size={24} />
          </Flex>
          <Text variant="h1" as="h1" className={styles.title}>
            {t('routes.templates.title', 'Шаблоны маршрутов')}
          </Text>
        </HStack>
        <Button className={styles.createBtn} onClick={openCreate}>
          <Plus size={16} />
          {t('routes.templates.create', 'Создать шаблон')}
        </Button>
      </Flex>

      {isLoading ? (
        <Text variant="muted">{t('common.loading', 'Загрузка...')}</Text>
      ) : isMobile ? (
        <VStack gap="8" max>
          {templates.map((row) => (
            <Card key={row.uid} className={styles.mobileCard}>
              <CardContent>
                <HStack justify="between" align="start" max>
                  <VStack gap="4">
                    <HStack gap="8" align="center">
                      <Text>{row.name}</Text>
                      <Badge variant={isBuiltin(row) ? 'secondary' : 'outline'}>
                        {isBuiltin(row)
                          ? t('routes.templates.builtin', 'Встроенный')
                          : t('routes.templates.mine', 'Мой')}
                      </Badge>
                    </HStack>
                    <Text variant="muted" className={styles.clip} title={row.description}>
                      {row.description}
                    </Text>
                    <Text variant="muted">
                      {t('routes.templates.actionCount', 'Действий: {{count}}').replace(
                        '{{count}}',
                        String(row.actions.length),
                      )}
                      {' · '}
                      {t('routes.templates.slotCount', 'Подстановок: {{count}}').replace(
                        '{{count}}',
                        String(row.slots.length),
                      )}
                    </Text>
                  </VStack>
                  {renderActions(row)}
                </HStack>
              </CardContent>
            </Card>
          ))}
        </VStack>
      ) : (
        <Card className={styles.card}>
          <CardContent className={styles.cardContent}>
            <DataTable
              data={templates}
              columns={columns}
              getRowId={(row) => String(row.uid)}
              emptyText={t('routes.templates.emptyTitle', 'Шаблонов пока нет')}
            />
          </CardContent>
        </Card>
      )}

      <RouteTemplateFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        modalMode={modalMode}
        template={selected}
      />
    </VStack>
  );
}
