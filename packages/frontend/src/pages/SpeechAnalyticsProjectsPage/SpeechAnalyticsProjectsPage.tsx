import { aiChatActions } from "@/features/ai-chat/model/slice/aiChatSlice";
import {
  cabinetSaProjects,
  useBulkDeleteSaProjectsMutation,
  useCreateSaProjectMutation,
  useGetSaJournalQuery,
  useGetSaProjectsQuery,
  usePublishSaProjectMutation,
  usePurgeSaProjectMutation,
  useUpdateSaProjectDraftMutation,
  type SaProject,
} from "@/features/speechAnalytics/api/speechAnalyticsApi";
import {
  mergeAnalysisJobs,
  usePendingUploads,
} from "@/features/speechAnalytics/model/pendingUploads";
import { AnalysisJobsPanel } from "@/features/speechAnalytics/ui/AnalysisJobsPanel/AnalysisJobsPanel";
import { ProjectSettingsForm } from "@/features/speechAnalytics/ui/ProjectSettingsForm/ProjectSettingsForm";
import { ProjectWizard } from "@/features/speechAnalytics/ui/ProjectWizard/ProjectWizard";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Button, Card, CardContent, CardHeader, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Table, TableCard, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";
import {
  applyIndustryTemplate,
  defaultSaProjectConfig,
  type SaProjectConfigV1,
} from "@krasterisk/shared";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { FolderKanban, Loader2, Plus } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import cls from "./SpeechAnalyticsProjectsPage.module.scss";

const columnHelper = createColumnHelper<SaProject>();
const PAGE_SIZE = 25;

function projectStatusLabel(t: TFunction, status: string): string {
  if (status === "draft")
    return t("speechAnalytics.projectStatusDraft", "Черновик");
  if (status === "active")
    return t("speechAnalytics.projectStatusActive", "Активный");
  if (status === "archived")
    return t("speechAnalytics.projectStatusArchived", "Архивный");
  return status;
}

export const SpeechAnalyticsProjectsPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const projectsQuery = useGetSaProjectsQuery();
  const journalQuery = useGetSaJournalQuery(undefined, {
    pollingInterval: 4000,
  });
  const pendingJobs = usePendingUploads();
  const [createProject, createState] = useCreateSaProjectMutation();
  const [updateDraft] = useUpdateSaProjectDraftMutation();
  const [publishProject] = usePublishSaProjectMutation();
  const [bulkDelete, deleteState] = useBulkDeleteSaProjectsMutation();
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<SaProject | null>(null);
  const [purgeProject, purgeState] = usePurgeSaProjectMutation();
  const [copySource, setCopySource] = useState<SaProject | null>(null);
  const [copyName, setCopyName] = useState("");
  const [rowDeleteIds, setRowDeleteIds] = useState<string[] | null>(null);
  const selection = useCrossPageRowSelection({ globalFilter: search });

  const projects = useMemo(() => {
    const rows = projectsQuery.data ?? [];
    return showArchived ? rows : cabinetSaProjects(rows);
  }, [projectsQuery.data, showArchived]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) =>
      project.name.toLowerCase().includes(query),
    );
  }, [projects, search]);
  const isEmpty =
    !projectsQuery.isLoading && !projectsQuery.isError && projects.length === 0;

  const openCopy = useCallback(
    (project: SaProject) => {
      setCopySource(project);
      setCopyName(
        t("speechAnalytics.copyName", {
          name: project.name,
          defaultValue: "{{name}} (копия)",
        }),
      );
    },
    [t],
  );

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("name", {
          header: () => t("speechAnalytics.projectName", "Название проекта"),
          cell: (info) => <Text>{info.getValue()}</Text>,
        }),
        columnHelper.accessor("status", {
          header: () => t("speechAnalytics.projectStatus", "Статус"),
          cell: (info) => <Text>{projectStatusLabel(t, info.getValue())}</Text>,
        }),
        columnHelper.display({
          id: "publication",
          header: () => t("speechAnalytics.publicationColumn", "Разбор"),
          cell: ({ row }) => {
            const project = row.original;
            if (!project.analysisVersionNo) {
              return (
                <Text className={cls.draftBadge}>
                  {t(
                    "speechAnalytics.draftNoAnalysis",
                    "Черновик, разбор не идёт",
                  )}
                </Text>
              );
            }
            if (project.unpublished) {
              return (
                <Text className={cls.pendingBadge}>
                  {t("speechAnalytics.unpublishedAnalysis", {
                    version: project.analysisVersionNo,
                    defaultValue:
                      "Не опубликовано, разбор по версии {{version}}",
                  })}
                </Text>
              );
            }
            return (
              <Text>
                {t("speechAnalytics.analysisVersion", {
                  version: project.analysisVersionNo,
                  defaultValue: "Версия {{version}}",
                })}
              </Text>
            );
          },
        }),
      ] as ColumnDef<SaProject, unknown>[],
    [t],
  );

  const onCreate = async (name: string, config: SaProjectConfigV1) => {
    try {
      const created = await createProject({
        name:
          name.trim() || t("speechAnalytics.newProjectDefault", "Новый проект"),
      }).unwrap();
      const saved = await updateDraft({
        id: created.id,
        expectedRevision: created.draft_revision,
        config,
      }).unwrap();
      await publishProject({
        id: saved.id,
        operationKey: `create-${saved.id}`,
      }).unwrap();
      setCreateOpen(false);
      setNewName("");
      setEditId(saved.id);
    } catch {
      toast.error(t("speechAnalytics.saveFailed", "Не удалось сохранить"));
    }
  };

  const onPromptChat = async (
    name: string,
    prompt: string,
    description: string,
  ) => {
    try {
      const created = await createProject({
        name:
          name.trim() || t("speechAnalytics.newProjectDefault", "Новый проект"),
      }).unwrap();
      const config: SaProjectConfigV1 = {
        ...applyIndustryTemplate("custom"),
        description,
        systemPrompt: prompt,
      };
      await updateDraft({
        id: created.id,
        expectedRevision: created.draft_revision,
        config,
      }).unwrap();
      dispatch(
        aiChatActions.openWithSeed(
          [
            "Настрой проект речевой аналитики по описанию пользователя.",
            `Название: ${created.name}`,
            `project_id: ${created.id}`,
            "Запиши описание в systemPrompt, собери metrics и callTaxonomy и вызови edit_speech_analytics_project.",
            "Покажи карточку подтверждения. Не публикуй проект сам.",
            "",
            prompt,
          ].join("\n"),
        ),
      );
      setCreateOpen(false);
    } catch {
      toast.error(t("speechAnalytics.saveFailed", "Не удалось сохранить"));
    }
  };

  const onCopy = async () => {
    if (!copySource) return;
    const name =
      copyName.trim() ||
      t("speechAnalytics.copyName", {
        name: copySource.name,
        defaultValue: "{{name}} (копия)",
      });
    try {
      const created = await createProject({ name }).unwrap();
      await updateDraft({
        id: created.id,
        expectedRevision: created.draft_revision,
        config: copySource.draft_config ?? defaultSaProjectConfig(),
      }).unwrap();
      setCopySource(null);
      toast.success(t("speechAnalytics.projectCopied", "Проект скопирован"));
    } catch {
      toast.error(
        t("speechAnalytics.copyProjectFailed", "Не удалось скопировать проект"),
      );
    }
  };

  const deleteIds =
    rowDeleteIds ?? (selection.bulkDeleteOpen ? selection.selectedIds : []);
  const deleteLabels = deleteIds.map(
    (id) => projects.find((project) => project.id === id)?.name || id,
  );

  const onConfirmDelete = async () => {
    if (!deleteIds.length) return;
    try {
      await bulkDelete(deleteIds).unwrap();
      toast.success(t("speechAnalytics.projectDeleted", "Проект удалён"));
      setRowDeleteIds(null);
      selection.afterBulkDelete();
    } catch {
      toast.error(
        t("speechAnalytics.deleteProjectFailed", "Не удалось удалить проект"),
      );
    }
  };



  const selectedProjects = (projectsQuery.data ?? []).filter(
    (project) => selection.rowSelection[project.id],
  );
  const singlePurge =
    selection.selectedCount === 1 &&
    selectedProjects.length === 1 &&
    selectedProjects[0].status === "archived" &&
    (selectedProjects[0].recordingCount ?? 0) === 0
      ? selectedProjects[0]
      : undefined;
  const deletableProjects = selectedProjects.filter(
    (project) => project.status !== "archived",
  );
  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <FolderKanban size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("speechAnalytics.projectCount", {
            count: filtered.length,
            defaultValue: "Проектов: {{count}}",
          })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <HStack gap="8" align="center">
          <Checkbox
            id="sa-projects-archived"
            checked={showArchived}
            onChange={() => setShowArchived((value) => !value)}
          />
          <Label htmlFor="sa-projects-archived">
            {t("speechAnalytics.showArchivedProjects", "Показать архивные")}
          </Label>
        </HStack>
        <TableToolbar
          onCopySelected={openCopy}
          selectedItem={
            selectedProjects.length === 1 ? selectedProjects[0] : undefined
          }
          onDeleteSelected={() =>
            singlePurge
              ? setPurgeTarget(singlePurge)
              : setRowDeleteIds(deletableProjects.map((project) => project.id))
          }
          deleteDisabled={
            deleteState.isLoading ||
            purgeState.isLoading ||
            (!singlePurge && !deletableProjects.length)
          }
          deleteLabel={
            singlePurge
              ? t("speechAnalytics.purgeProject", "Удалить окончательно")
              : t("speechAnalytics.deleteSelected", {
                  count: deletableProjects.length,
                })
          }

          tableRef={selection.tableRef}
          searchId="sa-projects-search"
          searchPlaceholder={t("common.search")}
          searchValue={search}
          onSearchChange={(value) => setSearch(value)}
          exportTable={{
            data: projects,
            globalFilter: search,
            columns: columns,
            getRowId: (row) => row.id,
            rowSelection: selection.rowSelection,
            filename: "speechanalyticsprojectspage-export",
          }}
          selection={selection}
        />
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
      <Text as="span">
        {t("speechAnalytics.createProject", "Создать проект")}
      </Text>
    </Button>
  );

  return (
    <VStack
      gap="24"
      max
      className={cls.page}
      data-testid="speech-analytics-projects"
    >
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <FolderKanban size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t("speechAnalytics.projects", "Проекты")}
            </Text>
            <Text variant="muted">
              {t(
                "speechAnalytics.projectsSubtitle",
                "Наборы метрик для маршрутов, загрузок и внешнего API",
              )}
            </Text>
          </VStack>
        </HStack>
        {createCta}
      </Flex>

      <AnalysisJobsPanel
        jobs={mergeAnalysisJobs(
          journalQuery.data?.analysisJobs ?? [],
          pendingJobs,
        )}
        progress={journalQuery.data?.uploadProgress ?? { done: 0, total: 0 }}
      />

      {projectsQuery.isError ? (
        <QueryErrorState
          message={t(
            "speechAnalytics.errorLoadProjects",
            "Не удалось загрузить проекты. Повторите попытку.",
          )}
          onRetry={() => void projectsQuery.refetch()}
          retryLabel={t("speechAnalytics.retry", "Повторить")}
          data-testid="projects-error"
        />
      ) : null}

      {isEmpty ? (
        <VStack gap="12" max className={cls.empty} data-testid="projects-empty">
          <Text variant="h2" as="h2">
            {t("speechAnalytics.emptyProjectsHeading", "Проектов пока нет")}
          </Text>
          <Text variant="muted">
            {t(
              "speechAnalytics.emptyProjectsBody",
              "Создайте проект и опубликуйте метрики, чтобы маршруты и загрузки могли брать этот набор.",
            )}
          </Text>
          {createCta}
        </VStack>
      ) : null}

      {!projectsQuery.isError &&
      (projectsQuery.isLoading || projects.length > 0) ? (
        projectsQuery.isLoading && projects.length === 0 ? (
          <Flex
            align="center"
            justify="center"
            className={cls.loading}
            data-testid="projects-loading"
          >
            <Loader2 size={24} className={cls.spinner} />
          </Flex>
        ) : isMobile ? (
          <Card
            className={[tableStyles.surface, cls.card].join(" ")}
            data-testid="projects-mobile-cards"
            data-hybrid="mobile-card"
          >
            <CardHeader className={tableStyles.toolbarPanel}>
              {toolbar}
            </CardHeader>
            <CardContent>
              <VStack gap="8" max>
                {filtered.map((project) => (
                  <TableCard
                    onActivate={() => setEditId(project.id)}
                    data-selected={!!selection.rowSelection[String(project.id)]}
                    key={project.id}
                    selection={selection.cardSelection(
                      String(project.id),
                      t("common.selectRowAria", { index: project.name }),
                    )}
                    direction="column"
                    className={[tableStyles.card, cls.mobileCard].join(" ")}
                    data-testid={`project-row-${project.id}`}
                  >
                    <HStack justify="between" align="start" max>
                      <VStack gap="4">
                        <Text>{project.name}</Text>
                        <Text variant="muted">
                          {projectStatusLabel(t, project.status)}
                        </Text>
                        <Text variant="muted">
                          {!project.analysisVersionNo
                            ? t(
                                "speechAnalytics.draftNoAnalysis",
                                "Черновик, разбор не идёт",
                              )
                            : project.unpublished
                              ? t("speechAnalytics.unpublishedAnalysis", {
                                  version: project.analysisVersionNo,
                                  defaultValue:
                                    "Не опубликовано, разбор по версии {{version}}",
                                })
                              : t("speechAnalytics.analysisVersion", {
                                  version: project.analysisVersionNo,
                                  defaultValue: "Версия {{version}}",
                                })}
                        </Text>
                      </VStack>
                    </HStack>
                  </TableCard>
                ))}
              </VStack>
            </CardContent>
          </Card>
        ) : (
          <Card
            className={[tableStyles.surface, cls.card].join(" ")}
            data-testid="projects-wide-table"
            data-hybrid="overflow-x-auto"
          >
            <CardHeader className={tableStyles.toolbarPanel}>
              {toolbar}
            </CardHeader>
            <CardContent className={cls.cardContent}>
              <Flex
                direction="column"
                align="stretch"
                max
                className={cls.tableWrap}
              >
                <Table
                  onRowClick={(project) => setEditId(project.id)}
                  surface={false}
                  showSearch={false}
                  showExport={false}
                  ref={selection.tableRef}
                  className={cls.table}
                  data={filtered}
                  columns={columns}
                  getRowId={(row) => row.id}
                  pageSize={PAGE_SIZE}
                  selectable
                  rowSelection={selection.rowSelection}
                  onRowSelectionChange={selection.onRowSelectionChange}

                  emptyText={t(
                    "speechAnalytics.emptyProjectsHeading",
                    "Проектов пока нет",
                  )}
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
            onContinueInChat={(name, prompt, description) => {
              void onPromptChat(name, prompt, description);
            }}
            onSubmit={(name, config) => {
              void onCreate(name, config);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={editId != null}
        onOpenChange={(open) => {
          if (!open) setEditId(null);
        }}
      >
        <DialogContent size="large" className={cls.dialogContent}>
          {editId ? (
            <ProjectSettingsForm
              projectId={editId}
              onSaved={() => setEditId(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={copySource != null}
        onOpenChange={(open) => {
          if (!open) setCopySource(null);
        }}
      >
        <DialogContent className={cls.dialogContent}>
          <DialogHeader className={cls.dialogHeader}>
            <DialogTitle>
              {t("speechAnalytics.copyProject", "Копировать проект")}
            </DialogTitle>
          </DialogHeader>
          <form
            className={cls.form}
            onSubmit={(event) => {
              event.preventDefault();
              void onCopy();
            }}
          >
            <VStack gap="12" max className={cls.formBody} align="stretch">
              <Label htmlFor="sa-project-copy-name">
                {t("speechAnalytics.projectName", "Название проекта")}
              </Label>
              <Input
                id="sa-project-copy-name"
                value={copyName}
                onChange={(event) => setCopyName(event.target.value)}
                autoFocus
              />
            </VStack>
            <DialogFooter className={cls.footer}>
              <HStack gap="8" justify="end" max>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCopySource(null)}
                >
                  {t("common.cancel", "Отмена")}
                </Button>
                <Button type="submit" disabled={createState.isLoading}>
                  {t("common.copy")}
                </Button>
              </HStack>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={purgeTarget != null}
        onOpenChange={(open) => {
          if (!open && !purgeState.isLoading) setPurgeTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("speechAnalytics.purgeProjectTitle", {
                name: purgeTarget?.name ?? "",
                defaultValue: "Удалить проект «{{name}}» окончательно?",
              })}
            </DialogTitle>
          </DialogHeader>
          <Text variant="muted">
            {t(
              "speechAnalytics.purgeProjectBody",
              "Записей нет. Проект и его настройки будут стёрты без восстановления.",
            )}
          </Text>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={purgeState.isLoading}
              onClick={() => setPurgeTarget(null)}
            >
              {t("common.cancel", "Отмена")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={purgeState.isLoading || !purgeTarget}
              onClick={() => {
                if (!purgeTarget) return;
                void purgeProject(purgeTarget.id)
                  .unwrap()
                  .then(() => {
                    toast.success(
                      t(
                        "speechAnalytics.projectPurged",
                        "Проект удалён окончательно",
                      ),
                    );
                    setPurgeTarget(null);
                    selection.clearSelection();
                  })
                  .catch(() =>
                    toast.error(
                      t(
                        "speechAnalytics.purgeProjectFailed",
                        "Не удалось удалить проект окончательно",
                      ),
                    ),
                  );
              }}
            >
              {t("speechAnalytics.purgeProject", "Удалить окончательно")}
            </Button>
          </DialogFooter>
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

SpeechAnalyticsProjectsPage.displayName = "SpeechAnalyticsProjectsPage";
