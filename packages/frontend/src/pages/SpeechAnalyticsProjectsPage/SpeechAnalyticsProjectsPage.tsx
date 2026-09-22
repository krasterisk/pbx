import { memo, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { FolderKanban, Loader2, Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import {
  useCreateSaProjectMutation,
  useGetSaProjectsQuery,
  type SaProject,
} from '@/features/speechAnalytics/api/speechAnalyticsApi';
import cls from './SpeechAnalyticsProjectsPage.module.scss';

const columnHelper = createColumnHelper<SaProject>();

export const SpeechAnalyticsProjectsPage = memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);
  const projectsQuery = useGetSaProjectsQuery();
  const [createProject, createState] = useCreateSaProjectMutation();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const projects = projectsQuery.data ?? [];
  const isEmpty = !projectsQuery.isLoading && !projectsQuery.isError && projects.length === 0;

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor('name', {
          header: () => t('speechAnalytics.projectName', 'Название проекта'),
          cell: (info) => info.getValue(),
        }),
        columnHelper.accessor('status', {
          header: () => t('speechAnalytics.projectStatus', 'Статус'),
          cell: (info) => info.getValue(),
        }),
        columnHelper.accessor('draft_revision', {
          header: () => t('speechAnalytics.draftRevision', 'Черновик'),
          cell: (info) => info.getValue(),
        }),
        columnHelper.display({
          id: 'actions',
          header: () => t('common.actions', 'Действия'),
          cell: ({ row }) => (
            <Button asChild variant="outline" size="sm">
              <Link to={`/speech-analytics/projects/${row.original.id}`}>
                {t('speechAnalytics.open', 'Открыть')}
              </Link>
            </Button>
          ),
        }),
      ] as ColumnDef<SaProject, unknown>[],
    [t],
  );

  const onCreate = async () => {
    const name = newName.trim() || t('speechAnalytics.newProjectDefault', 'Новый проект');
    try {
      const created = await createProject({ name }).unwrap();
      setCreateOpen(false);
      setNewName('');
      navigate(`/speech-analytics/projects/${created.id}`);
    } catch {
      toast.error(t('speechAnalytics.saveFailed', 'Не удалось сохранить'));
    }
  };

  const createCta = (
    <Button
      type="button"
      className={cls.createBtn}
      data-testid="projects-create-cta"
      onClick={() => setCreateOpen(true)}
      disabled={createState.isLoading}
    >
      <Plus size={16} className={cls.createIcon} />
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
            <Skeleton className={cls.skeletonRow} />
          </Flex>
        ) : isMobile ? (
          <VStack gap="8" max data-testid="projects-mobile-cards">
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/speech-analytics/projects/${project.id}`}
                className={cls.mobileCard}
                data-testid={`project-row-${project.id}`}
              >
                <VStack gap="4" max>
                  <Text>{project.name}</Text>
                  <Text variant="muted">{project.status}</Text>
                </VStack>
              </Link>
            ))}
          </VStack>
        ) : (
          <Flex direction="column" align="stretch" max className={cls.tableWrap} data-testid="projects-wide-table">
            <DataTable
              data={projects}
              columns={columns}
              getRowId={(row) => row.id}
              pageSize={25}
              emptyText={t('speechAnalytics.emptyProjectsHeading', 'Проектов пока нет')}
            />
          </Flex>
        )
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('speechAnalytics.createProject', 'Создать проект')}</DialogTitle>
          </DialogHeader>
          <VStack gap="12" max>
            <Label htmlFor="sa-project-name">{t('speechAnalytics.projectName', 'Название проекта')}</Label>
            <Input
              id="sa-project-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              autoFocus
            />
            <Button type="button" onClick={() => void onCreate()} disabled={createState.isLoading}>
              {t('speechAnalytics.createProject', 'Создать проект')}
            </Button>
          </VStack>
        </DialogContent>
      </Dialog>
    </VStack>
  );
});

SpeechAnalyticsProjectsPage.displayName = 'SpeechAnalyticsProjectsPage';
