import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutTemplate, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import type { IRouteTemplate } from '@krasterisk/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  Input,
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import {
  useDeleteRouteTemplateMutation,
  useGetRouteTemplatesQuery,
} from '@/shared/api/endpoints/routeTemplateApi';
import { RouteTemplateFormModal, type TemplateModalMode } from '../RouteTemplateFormModal';
import {
  isBuiltinTemplate,
  renderTemplateActions,
  useRouteTemplatesTableColumns,
} from './useRouteTemplatesTableColumns';
import cls from './RouteTemplatesPage.module.scss';

export function RouteTemplatesPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const { data: templates = [], isLoading } = useGetRouteTemplatesQuery();
  const [deleteTemplate] = useDeleteRouteTemplateMutation();
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const selectedCount = Object.keys(rowSelection).length;

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<TemplateModalMode>('create');
  const [selected, setSelected] = useState<IRouteTemplate | null>(null);

  const openCreate = () => {
    setSelected(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const openEdit = useCallback((row: IRouteTemplate) => {
    setSelected(row);
    setModalMode('edit');
    setModalOpen(true);
  }, []);

  const openCopy = useCallback((row: IRouteTemplate) => {
    setSelected(row);
    setModalMode('copy');
    setModalOpen(true);
  }, []);

  const confirmDelete = useCallback((row: IRouteTemplate) => {
    const message = t('routes.templates.confirmDelete').replace('{{name}}', row.name);
    if (window.confirm(message)) {
      void deleteTemplate(row.uid);
    }
  }, [t, deleteTemplate]);

  const actionArgs = useMemo(() => ({
    onEdit: openEdit,
    onCopy: openCopy,
    onDelete: confirmDelete,
  }), [openEdit, openCopy, confirmDelete]);

  const columns = useRouteTemplatesTableColumns(actionArgs);

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((row) => {
      const name = (row.name || '').toLowerCase();
      const description = (row.description || '').toLowerCase();
      return name.includes(q) || description.includes(q);
    });
  }, [templates, globalFilter]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Object.keys(rowSelection)
      .map(Number)
      .filter((uid) => {
        const row = templates.find((item) => item.uid === uid);
        return Boolean(row && !isBuiltinTemplate(row));
      });
    if (!ids.length) return;
    if (!window.confirm(t('routes.templates.confirmBulkDelete'))) return;
    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => deleteTemplate(id).unwrap()));
      setRowSelection({});
    } finally {
      setIsDeleting(false);
    }
  }, [rowSelection, templates, deleteTemplate, t]);

  const editLabel = t('routes.templates.edit', 'Изменить');
  const copyLabel = t('routes.templates.copy', 'Копировать');
  const deleteLabel = t('routes.templates.delete', 'Удалить');
  const builtinHint = t('routes.templates.builtinReadOnly');

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <LayoutTemplate size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('routes.templates.count', { count: templates.length })}</Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        {!isMobile && (
          <Button
            variant="destructive"
            className={selectedCount === 0 ? cls.bulkBtnHidden : undefined}
            disabled={isDeleting || selectedCount === 0}
            aria-hidden={selectedCount === 0}
            tabIndex={selectedCount === 0 ? -1 : undefined}
            onClick={handleBulkDelete}
          >
            {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : <Trash2 size={16} />}
            {t('routes.templates.deleteSelected', { count: selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="route-templates-search"
            placeholder={t('common.search')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className={cls.searchInput}
          />
        </Flex>
      </HStack>
    </Flex>
  );

  return (
    <VStack gap="24" max className={cls.page} data-testid="route-templates-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <LayoutTemplate size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('routes.templates.title', 'Шаблоны маршрутов')}
            </Text>
            <Text variant="muted">{t('routes.templates.subtitle')}</Text>
          </VStack>
        </HStack>
        <Button className={cls.createBtn} onClick={openCreate}>
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('routes.templates.create', 'Создать шаблон')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        {isLoading ? (
          <Card className={cls.card}>
            <CardHeader>{toolbar}</CardHeader>
            <CardContent>
              <Flex align="center" justify="center" className={cls.loading}>
                <Loader2 size={24} className={cls.spinner} />
              </Flex>
            </CardContent>
          </Card>
        ) : isMobile ? (
          <Card className={cls.card} data-testid="hybrid-table" data-hybrid="mobile-card">
            <CardHeader>{toolbar}</CardHeader>
            <CardContent>
              <VStack gap="8" max>
                {filtered.map((row) => (
                  <Flex
                    key={row.uid}
                    direction="column"
                    className={cls.mobileCard}
                    data-testid="route-templates-mobile-card"
                  >
                    <HStack justify="between" align="start" max>
                      <VStack gap="4">
                        <HStack gap="8" align="center">
                          <Text as="span">{row.name}</Text>
                          <Badge variant={isBuiltinTemplate(row) ? 'secondary' : 'outline'}>
                            {isBuiltinTemplate(row)
                              ? t('routes.templates.builtin', 'Встроенный')
                              : t('routes.templates.mine', 'Мой')}
                          </Badge>
                        </HStack>
                        <Text variant="muted" className={cls.clip} title={row.description}>
                          {row.description}
                        </Text>
                      </VStack>
                      {renderTemplateActions(row, {
                        ...actionArgs,
                        editLabel,
                        copyLabel,
                        deleteLabel,
                        builtinHint,
                      })}
                    </HStack>
                  </Flex>
                ))}
              </VStack>
            </CardContent>
          </Card>
        ) : (
          <Card className={cls.card} data-testid="hybrid-table" data-hybrid="overflow-x-auto">
            <CardHeader>{toolbar}</CardHeader>
            <CardContent className={cls.cardContent}>
              <Flex
                direction="column"
                align="stretch"
                className={cls.tableScroll}
                data-testid="route-templates-table-scroll"
              >
                <DataTable
                  className={cls.table}
                  data={templates}
                  columns={columns}
                  getRowId={(row) => String(row.uid)}
                  selectable
                  rowSelection={rowSelection}
                  onRowSelectionChange={setRowSelection}
                  globalFilter={globalFilter}
                  emptyText={t('routes.templates.emptyTitle')}
                />
              </Flex>
            </CardContent>
          </Card>
        )}
      </Flex>

      <RouteTemplateFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        modalMode={modalMode}
        template={selected}
      />
    </VStack>
  );
}
