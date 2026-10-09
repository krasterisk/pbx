import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { MessageSquareText, Upload } from 'lucide-react';
import { Button, Skeleton, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { readImpersonation } from '@/features/auth/lib/impersonationSession';
import {
  useDeleteSaConversationMutation,
  useGetSaConversationQuery,
  useGetSaJournalQuery,
  cabinetSaProjects,
  useGetSaProjectsQuery,
  useRegenerateSaConversationMutation,
  useSaveSaConversationOverrideMutation,
  useUploadSaCabinetBatchMutation,
} from '@/features/speechAnalytics/api/speechAnalyticsApi';
import {
  addPendingUploads,
  mergeAnalysisJobs,
  removePendingUpload,
  usePendingUploads,
} from '@/features/speechAnalytics/model/pendingUploads';
import { journalScoreScale } from '@/features/speechAnalytics/ui/ConversationsTable/filterJournalRows';
import {
  ConversationExpandedPanel,
  type ConversationSourceKind,
} from '@/features/speechAnalytics/ui/ConversationExpandedPanel/ConversationExpandedPanel';
import { ConversationsTable } from '@/features/speechAnalytics/ui/ConversationsTable/ConversationsTable';
import {
  UploadForm,
  type UploadFormSubmitPayload,
} from '@/features/speechAnalytics/ui/UploadForm/UploadForm';
import cls from './SpeechAnalyticsJournalPage.module.scss';

function normalizeSourceKind(raw: string | undefined): ConversationSourceKind {
  if (raw === 'pbx' || raw === 'cdr' || raw === 'callcenter' || raw === 'autodial') return 'pbx';
  if (raw === 'api' || raw === 'external') return 'api';
  return 'upload';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('read_failed'));
    reader.readAsDataURL(file);
  });
}

export const SpeechAnalyticsJournalPage = memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const canManage = readImpersonation(accessToken) != null;
  const journalQuery = useGetSaJournalQuery(undefined, { pollingInterval: 4000 });
  const projectsQuery = useGetSaProjectsQuery();
  const [uploadBatch] = useUploadSaCabinetBatchMutation();
  const [regenerate, regenerateState] = useRegenerateSaConversationMutation();
  const [saveOverride, overrideState] = useSaveSaConversationOverrideMutation();
  const [removeConversation, deleteState] = useDeleteSaConversationMutation();
  const [uploadOpen, setUploadOpen] = useState(false);
  const pendingJobs = usePendingUploads();

  const conversationQuery = useGetSaConversationQuery(conversationId ?? '', {
    skip: !conversationId,
  });

  const items = journalQuery.data?.items ?? [];
  const uploadProgress = journalQuery.data?.uploadProgress ?? { done: 0, total: 0 };
  const analysisJobs = mergeAnalysisJobs(journalQuery.data?.analysisJobs ?? [], pendingJobs);
  const isEmpty = !journalQuery.isLoading && !journalQuery.isError && items.length === 0 && analysisJobs.length === 0;
  const cabinetProjects = cabinetSaProjects(projectsQuery.data);
  const projects = cabinetProjects.map((p) => ({
    id: p.id,
    name: p.name,
    unpublished: p.unpublished,
    analysisVersionNo: p.analysisVersionNo,
  }));
  const scoreScale = useMemo(
    () => journalScoreScale(cabinetSaProjects(projectsQuery.data)),
    [projectsQuery.data],
  );

  const openConversation = (id: string) => {
    if (conversationId === id) {
      navigate('/speech-analytics/conversations');
      return;
    }
    navigate(`/speech-analytics/conversations/${id}`);
  };

  const openUpload = () => {
    setUploadOpen(true);
  };

  const handleUpload = useCallback((payload: UploadFormSubmitPayload) => {
    const projectName = projects.find((project) => project.id === payload.items[0]?.projectId)?.name ?? null;
    const pending = payload.items.map((item) => ({
      id: crypto.randomUUID(),
      filename: item.file.name,
      projectName,
      item,
    }));
    addPendingUploads(pending.map(({ id, filename, projectName: name }) => ({
      id,
      filename,
      projectName: name,
    })));
    void (async () => {
      for (const row of pending) {
        let accepted = false;
        try {
          await uploadBatch({
            projectId: row.item.projectId,
            configSource: payload.configSource,
            operator: row.item.operatorName ? { name: row.item.operatorName } : undefined,
            clientPhone: row.item.clientPhone,
            language: payload.language,
            files: [{
              filename: row.item.file.name,
              bytesBase64: await fileToBase64(row.item.file),
            }],
          }).unwrap();
          accepted = true;
        } catch (error) {
          const code = (error as { data?: { code?: string } })?.data?.code;
          const message = code === 'analysis_provider_missing'
            ? t(
              'speechAnalytics.errorUploadNoProvider',
              'Разбор не запущен: для речевой аналитики не назначены распознавание и LLM. Запись не сохранена.',
            )
            : t(
              'speechAnalytics.errorUpload',
              'Не удалось загрузить файл. Проверьте формат (mp3/wav/ogg/m4a) и размер до 50 МБ.',
            );
          toast.error(`${row.filename}: ${message}`);
        }
        if (accepted) await journalQuery.refetch().catch(() => undefined);
        removePendingUpload(row.id);
      }
    })();
    return Promise.resolve();
  }, [journalQuery, projects, t, uploadBatch]);

  const handleRegenerate = useCallback(async () => {
    if (!conversationId) return;
    try {
      await regenerate(conversationId).unwrap();
      toast.success(t('speechAnalytics.regenerateStarted', 'Аналитика поставлена на переформирование'));
    } catch {
      toast.error(t('speechAnalytics.regenerateFailed', 'Не удалось переформировать аналитику'));
    }
  }, [conversationId, regenerate, t]);

  const handleDelete = useCallback(async () => {
    if (!conversationId) return;
    const confirmed = window.confirm(
      t('speechAnalytics.confirmDeleteRecording', 'Вы уверены, что хотите удалить запись?'),
    );
    if (!confirmed) return;
    try {
      await removeConversation(conversationId).unwrap();
      toast.success(t('speechAnalytics.recordingDeleted', 'Запись удалена'));
      navigate('/speech-analytics/conversations');
    } catch {
      toast.error(t('speechAnalytics.deleteRecordingFailed', 'Не удалось удалить запись'));
    }
  }, [conversationId, navigate, removeConversation, t]);

  return (
    <VStack gap="24" max className={cls.page} data-testid="speech-analytics-journal">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <MessageSquareText size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('speechAnalytics.journalTitle', 'Разговоры')}
            </Text>
            <Text variant="muted">
              {t(
                'speechAnalytics.journalSubtitle',
                'Журнал разобранных разговоров и загрузок',
              )}
            </Text>
          </VStack>
        </HStack>
        <Button
          type="button"
          className={cls.uploadBtn}
          data-testid="journal-upload-cta"
          onClick={openUpload}
        >
          <Upload size={16} className={cls.uploadIcon} />
          <Text as="span">{t('speechAnalytics.uploadRecording', 'Загрузить запись')}</Text>
        </Button>
      </Flex>

      {journalQuery.isError ? (
        <QueryErrorState message={t(
              'speechAnalytics.errorLoadJournal',
              'Не удалось загрузить журнал. Обновите страницу или повторите позже.',
            )} onRetry={() => void journalQuery.refetch()} retryLabel={t('common.retry', 'Повторить')} data-testid="journal-error" />
      ) : null}

      {isEmpty ? (
        <VStack gap="16" max align="center" className={cls.empty} data-testid="journal-empty">
          <Flex align="center" justify="center" className={cls.emptyIcon}>
            <MessageSquareText size={28} />
          </Flex>
          <VStack gap="8" align="center" className={cls.emptyCopy}>
            <Text variant="h2" as="h2">
              {t('speechAnalytics.emptyJournalHeading', 'Разговоров пока нет')}
            </Text>
            <Text variant="muted">
              {t(
                'speechAnalytics.emptyJournalBody',
                'Загрузите запись или дождитесь разбора звонка с маршрута, где выбран проект.',
              )}
            </Text>
          </VStack>
          <Button type="button" className={cls.uploadBtn} data-testid="journal-empty-upload-cta" onClick={openUpload}>
            <Upload size={16} className={cls.uploadIcon} />
            {t('speechAnalytics.uploadRecording', 'Загрузить запись')}
          </Button>
        </VStack>
      ) : null}

      {!journalQuery.isError && (journalQuery.isLoading || items.length > 0 || analysisJobs.length > 0) ? (
        journalQuery.isLoading && items.length === 0 && analysisJobs.length === 0 ? (
          <VStack gap="8" max data-testid="journal-loading">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className={cls.skeletonRow} />
            ))}
          </VStack>
        ) : (
          <ConversationsTable
            items={items}
            uploadProgress={uploadProgress}
            analysisJobs={analysisJobs}
            isLoading={journalQuery.isLoading}
            expandedId={conversationId ?? null}
            onRowClick={openConversation}
            scoreScale={scoreScale}
            renderExpanded={() => (
              <ConversationExpandedPanel
                conversationId={conversationId ?? null}
                sourceKind={normalizeSourceKind(conversationQuery.data?.sourceKind)}
                audioUrl={conversationQuery.data?.audioUrl}
                rebuildInProgress={conversationQuery.data?.rebuildInProgress === true}
                summary={conversationQuery.data?.summary}
                metricResults={conversationQuery.data?.metricResults}
                transcriptText={conversationQuery.data?.transcriptText}
                turns={conversationQuery.data?.turns}
                runs={conversationQuery.data?.runs}
                onSaveOverride={canManage && conversationId
                  ? (input) => { void saveOverride({ id: conversationId, ...input }); }
                  : undefined}
                isSavingOverride={overrideState.isLoading}
                isLoading={conversationQuery.isLoading}
                isError={conversationQuery.isError}
                onRetry={() => void conversationQuery.refetch()}
                canManage={canManage}
                onRegenerate={() => void handleRegenerate()}
                onDelete={() => void handleDelete()}
                isRegenerating={regenerateState.isLoading}
                isDeleting={deleteState.isLoading}
              />
            )}
          />
        )
      ) : null}

      <UploadForm
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        projects={projects}
        onSubmit={handleUpload}
      />
    </VStack>
  );
});

SpeechAnalyticsJournalPage.displayName = 'SpeechAnalyticsJournalPage';
