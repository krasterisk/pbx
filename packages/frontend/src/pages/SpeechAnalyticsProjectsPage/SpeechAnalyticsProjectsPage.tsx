import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper, type ColumnDef, type Table } from '@tanstack/react-table';
import { defaultSaProjectConfig, type SaProjectConfigV1 } from '@krasterisk/shared';
import { ProjectWizard } from '@/features/speechAnalytics/ui/ProjectWizard/ProjectWizard';
import { ProjectSettingsForm } from '@/features/speechAnalytics/ui/ProjectSettingsForm/ProjectSettingsForm';
import { Copy, FolderKanban, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  BulkDeleteDialog,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  TableRowAction,
  TableRowActions,
  TableSelectionBanner,
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useCrossPageRowSelection } from '@/shared/hooks/useCrossPageRowSelection';
import {
  useBulkDeleteSaProjectsMutation,
  useCreateSaProjectMutation,
  useGetSaProjectsQuery,
  usePublishSaProjectMutation,
  useUpdateSaProjectDraftMutation,
  type SaProject,
} from '@/features/speechAnalytics/api/speechAnalyticsApi';
import cls from './SpeechAnalyticsProjectsPage.module.scss';

const columnHelper = createColumnHelper<SaProject>();
const PAGE_SIZE = 25;

export const SpeechAnalyticsProjectsPage = memo(() => {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const projectsQuery = useGetSaProjectsQuery();
  const [createProject, createState] = useCreateSaProjectMutation();
  const [updateDraft] = useUpdateSaProjectDraftMutation();
  const [publishProject] = usePublishSaProjectMutation();
  const [bulkDelete, deleteState] = useBulkDeleteSaProjectsMutation();
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [copySource, setCopySource] = useState<SaProject | null>(null);
  const [copyName, setCopyName] = useState('');
  const [rowDeleteIds, setRowDeleteIds] = useState<string[] | null>(null);
  const selection = useCrossPageRowSelection({ globalFilter: search });

  const projects = useMemo(
    () => (projectsQuery.data ?? []).filter((project) => project.status !== 'archived'),
    [projectsQuery.data],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(query));
  }, [projects, search]);
  const isEmpty = !projectsQuery.isLoading && !projectsQuery.isError && projects.length === 0;

  const openCopy = useCallback((project: SaProject) => {
    setCopySource(project);
    setCopyName(t('speechAnalytics.copyName', { name: project.name, defaultValue: '{{name}} (копия)' }));
  }, [t]);

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor('name', {
          header: () => t('speechAnalytics.projectName', 'Название проекта'),
          cell: (info) => <Text>{info.getValue()}</Text>,
        }),
        columnHelper.accessor('status', {
          header: () => t('speechAnalytics.projectStatus', 'Статус'),
          cell: (info) => <Text>{info.getValue()}</Text>,
        }),
        columnHelper.accessor('draft_revision', {
          header: () => t('speechAnalytics.draftRevision', 'Черновик'),
          cell: (info) => <Text>{String(info.getValue())}</Text>,
        }),
        columnHelper.display({
          id: 'actions',
          header: () => t('common.actions', 'Действия'),
          cell: ({ row }) => (
            <TableRowActions>
              <TableRowAction
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => setEditId(row.original.id)}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                title={t('common.copy')}
                aria-label={t('common.copy')}
                onClick={() => openCopy(row.original)}
              >
                <Copy />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => setRowDeleteIds([row.original.id])}
              >
                <Trash2 />
              </TableRowAction>
            </TableRowActions>
          ),
        }),
      ] as ColumnDef<SaProject, unknown>[],
    [openCopy, t],
  );

  const renderActions = (project: SaProject) => (
    <TableRowActions>
      <TableRowAction
        title={t('common.edit')}
        aria-label={t('common.edit')}
        onClick={() => setEditId(project.id)}
      >
        <Pencil />
      </TableRowAction>
      <TableRowAction
        title={t('common.copy')}
        aria-label={t('common.copy')}
        onClick={() => openCopy(project)}
      >
        <Copy />
      </TableRowAction>
      <TableRowAction
        danger
        title={t('common.delete')}
        aria-label={t('common.delete')}
        onClick={() => setRowDeleteIds([project.id])}
      >
        <Trash2 />
      </TableRowAction>
    </TableRowActions>
  );

  const onCreate = async (name: string, config: SaProjectConfigV1) => {
    try {
      const created = await createProject({
        name: name.trim() || t('speechAnalytics.newProjectDefault', 'Новый проект'),
      }).unwrap();
      const saved = await updateDraft({
        id: created.id,
        expectedRevision: created.draft_revision,
        config,
      }).unwrap();
      await publishProject({ id: saved.id, operationKey: `create-${saved.id}` }).unwrap();
      setCreateOpen(false);
      setNewName('');
      setEditId(saved.id);
    } catch {
      toast.error(t('speechAnalytics.saveFailed', 'Не удалось сохранить'));
    }
  };

  const onCopy = async () => {
    if (!copySource) return;
    const name = copyName.trim() || t('speechAnalytics.copyName', {
      name: copySource.name,
      defaultValue: '{{name}} (копия)',
    });
    try {
      const created = await createProject({ name }).unwrap();
      await updateDraft({
        id: created.id,
        expectedRevision: created.draft_revision,
        config: copySource.draft_config ?? defaultSaProjectConfig(),
      }).unwrap();
      setCopySource(null);
      toast.success(t('speechAnalytics.projectCopied', 'Проект скопирован'));
    } catch {
      toast.error(t('speechAnalytics.copyProjectFailed', 'Не удалось скопировать проект'));
    }
  };

  const deleteIds = rowDeleteIds ?? (selection.bulkDeleteOpen ? selection.selectedIds : []);
  const deleteLabels = deleteIds.map((id) => projects.find((project) => project.id === id)?.name || id);

  const onConfirmDelete = async () => {
    if (!deleteIds.length) return;
    try {
      await bulkDelete(deleteIds).unwrap();
      toast.success(t('speechAnalytics.projectDeleted', 'Проект удалён'));
      setRowDeleteIds(null);
      selection.afterBulkDelete();
    } catch {
      toast.error(t('speechAnalytics.deleteProjectFailed', 'Не удалось удалить проект'));
    }
  };

  const renderSelectionBanner = useCallback(
    (table: Table<SaProject>) => (
      <TableSelectionBanner
        table={table}
        pageSize={PAGE_SIZE}
        allMatchingSelected={selection.allMatchingSelected}
        selectedIds={selection.selectedIds}
        selectedCount={selection.selectedCount}
        onSelectAllMatching={selection.selectAllMatching}
        onClear={selection.clearSelection}
      />
    ),
    [selection],
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <FolderKanban size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('speechAnalytics.projectCount', { count: filtered.length, defaultValue: 'Проектов: {{count}}' })}</Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        {!isMobile && (
          <Button
            type="button"
            variant="destructive"
            className={selection.selectedCount === 0 ? cls.bulkBtnHidden : undefined}
            disabled={deleteState.isLoading || selection.selectedCount === 0}
            aria-hidden={selection.selectedCount === 0}
            tabIndex={selection.selectedCount === 0 ? -1 : undefined}
            onClick={selection.openBulkDelete}
          >
            {deleteState.isLoading ? <Loader2 size={16} className={cls.spinner} /> : <Trash2 size={16} />}
            {t('speechAnalytics.deleteSelected', { count: selection.selectedCount, defaultValue: 'Удалить ({{count}})' })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="sa-projects-search"
            placeholder={t('common.search')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={cls.searchInput}
          />
        </Flex>
      </HStack>
    </Flex>
  );

  const createCta = (
    <Button
      type="button"
      className={cls.createBtn}
      data-testid="projects-create-cta"
      onClick={() => setCreateOpen(true)}
      disabled={createState.isLoading}
    >
      <Plus size={16} className={cls.createBtnIcon} />
      <Text as="span">{t('speechAnalytics.createProject', 'Создать проект')}</Text>
    </Button>
  );

  return (
    <VStack gap="24" max className={cls.page} data-testid="speech-analytics-projects">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <FolderKanban size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('speechAnalytics.projects', 'Проекты')}
            </Text>
            <Text variant="muted">
              {t(
                'speechAnalytics.projectsSubtitle',
                'Наборы метрик для маршрутов, загрузок и внешнего API',
              )}
            </Text>
          </VStack>
        </HStack>
        {createCta}
      </Flex>

      {projectsQuery.isError ? (
        <VStack gap="12" max data-testid="projects-error">
          <Text>
            {t(
              'speechAnalytics.errorLoadProjects',
              'Не удалось загрузить проекты. Повторите попытку.',
            )}
          </Text>
          <Button type="button" variant="outline" onClick={() => void projectsQuery.refetch()}>
            {t('speechAnalytics.retry', 'Повторить')}
          </Button>
        </VStack>
      ) : null}

      {isEmpty ? (
        <VStack gap="12" max className={cls.empty} data-testid="projects-empty">
          <Text variant="h2" as="h2">
            {t('speechAnalytics.emptyProjectsHeading', 'Проектов пока нет')}
          </Text>
          <Text variant="muted">
            {t(
              'speechAnalytics.emptyProjectsBody',
              'Создайте проект и опубликуйте метрики, чтобы маршруты и загрузки могли брать этот набор.',
            )}
          </Text>
          {createCta}
        </VStack>
      ) : null}

      {!projectsQuery.isError && (projectsQuery.isLoading || projects.length > 0) ? (
        projectsQuery.isLoading && projects.length === 0 ? (
          <Flex align="center" justify="center" className={cls.loading} data-testid="projects-loading">
            <Loader2 size={24} className={cls.spinner} />
          </Flex>
        ) : isMobile ? (
          <Card className={cls.card} data-testid="projects-mobile-cards" data-hybrid="mobile-card">
            <CardHeader>{toolbar}</CardHeader>
            <CardContent>
              <VStack gap="8" max>
                {filtered.map((project) => (
                  <Flex
                    key={project.id}
                    direction="column"
                    className={cls.mobileCard}
                    data-testid={`project-row-${project.id}`}
                  >
                    <HStack justify="between" align="start" max>
                      <VStack gap="4">
                        <Text>{project.name}</Text>
                        <Text variant="muted">{project.status}</Text>
                      </VStack>
                      {renderActions(project)}
                    </HStack>
                  </Flex>
                ))}
              </VStack>
            </CardContent>
          </Card>
        ) : (
          <Card className={cls.card} data-testid="projects-wide-table" data-hybrid="overflow-x-auto">
            <CardHeader>{toolbar}</CardHeader>
            <CardContent className={cls.cardContent}>
              <Flex direction="column" align="stretch" max className={cls.tableWrap}>
                <DataTable
                  ref={selection.tableRef}
                  className={cls.table}
                  data={filtered}
                  columns={columns}
                  getRowId={(row) => row.id}
                  pageSize={PAGE_SIZE}
                  selectable
                  rowSelection={selection.rowSelection}
                  onRowSelectionChange={selection.onRowSelectionChange}
                  renderBanner={renderSelectionBanner}
                  emptyText={t('speechAnalytics.emptyProjectsHeading', 'Проектов пока нет')}
                />
              </Flex>
            </CardContent>
          </Card>
        )
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent size="large" className={cls.dialogContent}>
          <ProjectWizard
            submitting={createState.isLoading}
            onCancel={() => setCreateOpen(false)}
            onSubmit={(name, config) => { void onCreate(name, config); }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editId != null} onOpenChange={(open) => { if (!open) setEditId(null); }}>
        <DialogContent size="large" className={cls.dialogContent}>
          {editId ? (
            <ProjectSettingsForm projectId={editId} onSaved={() => setEditId(null)} />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={copySource != null} onOpenChange={(open) => { if (!open) setCopySource(null); }}>
        <DialogContent className={cls.dialogContent}>
          <DialogHeader className={cls.dialogHeader}>
            <DialogTitle>{t('speechAnalytics.copyProject', 'Копировать проект')}</DialogTitle>
          </DialogHeader>
          <form
            className={cls.form}
            onSubmit={(event) => {
              event.preventDefault();
              void onCopy();
            }}
          >
            <VStack gap="12" max className={cls.formBody}>
              <Label htmlFor="sa-project-copy-name">{t('speechAnalytics.projectName', 'Название проекта')}</Label>
              <Input
                id="sa-project-copy-name"
                value={copyName}
                onChange={(event) => setCopyName(event.target.value)}
                autoFocus
              />
            </VStack>
            <DialogFooter className={cls.footer}>
              <HStack gap="8" justify="end" max>
                <Button type="button" variant="outline" onClick={() => setCopySource(null)}>
                  {t('common.cancel', 'Отмена')}
                </Button>
                <Button type="submit" disabled={createState.isLoading}>
                  {t('common.copy')}
                </Button>
              </HStack>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BulkDeleteDialog
        open={rowDeleteIds != null || selection.bulkDeleteOpen}
        onOpenChange={(open) => {
          if (open) return;
          setRowDeleteIds(null);
          selection.setBulkDeleteOpen(false);
        }}
        labels={deleteLabels}
        allMatching={rowDeleteIds == null && selection.allMatchingSelected}
        hasFilter={search.trim().length > 0}
        isDeleting={deleteState.isLoading}
        onConfirm={onConfirmDelete}
        i18nNs="speechAnalytics"
      />
    </VStack>
  );
});

SpeechAnalyticsProjectsPage.displayName = 'SpeechAnalyticsProjectsPage';
