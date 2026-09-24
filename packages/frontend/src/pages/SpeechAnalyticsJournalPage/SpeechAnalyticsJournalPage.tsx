import { memo, useCallback, useState } from 'react';
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
  useGetSaProjectsQuery,
  useRegenerateSaConversationMutation,
  useUploadSaCabinetBatchMutation,
} from '@/features/speechAnalytics/api/speechAnalyticsApi';
import {
  ConversationSheet,
  type ConversationSourceKind,
} from '@/features/speechAnalytics/ui/ConversationSheet/ConversationSheet';
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
  const sheetOpen = Boolean(conversationId);

  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const canManage = readImpersonation(accessToken) != null;
  const journalQuery = useGetSaJournalQuery();
  const projectsQuery = useGetSaProjectsQuery();
  const [uploadBatch, uploadState] = useUploadSaCabinetBatchMutation();
  const [regenerate, regenerateState] = useRegenerateSaConversationMutation();
  const [removeConversation, deleteState] = useDeleteSaConversationMutation();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFormError, setUploadFormError] = useState<string | null>(null);

  const conversationQuery = useGetSaConversationQuery(conversationId ?? '', {
    skip: !conversationId,
  });

  const items = journalQuery.data?.items ?? [];
  const uploadProgress = journalQuery.data?.uploadProgress ?? { done: 0, total: 0 };
  const isEmpty = !journalQuery.isLoading && !journalQuery.isError && items.length === 0;
  const projects = (projectsQuery.data ?? []).map((p) => ({ id: p.id, name: p.name }));

  const openConversation = (id: string) => {
    navigate(`/speech-analytics/conversations/${id}`);
  };

  const closeSheet = (open: boolean) => {
    if (!open) navigate('/speech-analytics/conversations');
  };

  const openUpload = () => {
    setUploadFormError(null);
    setUploadOpen(true);
  };

  const handleUpload = useCallback(async (payload: UploadFormSubmitPayload) => {
    setUploadFormError(null);
    try {
      const files = await Promise.all(
        payload.files.map(async (file) => ({
          filename: file.name,
          bytesBase64: await fileToBase64(file),
        })),
      );
      await uploadBatch({
        projectId: payload.projectId,
        operator: payload.operator,
        clientPhone: payload.clientPhone,
        language: payload.language,
        files,
      }).unwrap();
    } catch {
      setUploadFormError(
        t(
          'speechAnalytics.errorUpload',
          'Не удалось загрузить файл. Проверьте формат (mp3/wav/ogg/m4a) и размер до 50 МБ.',
        ),
      );
      throw new Error('upload_failed');
    }
  }, [t, uploadBatch]);

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
        <VStack gap="12" max data-testid="journal-error">
          <Text>
            {t(
              'speechAnalytics.errorLoadJournal',
              'Не удалось загрузить журнал. Обновите страницу или повторите позже.',
            )}
          </Text>
          <Button type="button" variant="outline" onClick={() => void journalQuery.refetch()}>
            {t('common.retry', 'Повторить')}
          </Button>
        </VStack>
      ) : null}

      {isEmpty ? (
        <VStack gap="12" max className={cls.empty} data-testid="journal-empty">
          <Text variant="h2" as="h2">
            {t('speechAnalytics.emptyJournalHeading', 'Разговоров пока нет')}
          </Text>
          <Text variant="muted">
            {t(
              'speechAnalytics.emptyJournalBody',
              'Загрузите запись или дождитесь разбора звонка с маршрута, где выбран проект.',
            )}
          </Text>
          <Button type="button" data-testid="journal-empty-upload-cta" onClick={openUpload}>
            <Upload size={16} className={cls.uploadIcon} />
            {t('speechAnalytics.uploadRecording', 'Загрузить запись')}
          </Button>
        </VStack>
      ) : null}

      {!journalQuery.isError && (journalQuery.isLoading || items.length > 0) ? (
        journalQuery.isLoading && items.length === 0 ? (
          <VStack gap="8" max data-testid="journal-loading">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className={cls.skeletonRow} />
            ))}
          </VStack>
        ) : (
          <ConversationsTable
            items={items}
            uploadProgress={uploadProgress}
            isLoading={journalQuery.isLoading}
            onRowClick={openConversation}
          />
        )
      ) : null}

      <ConversationSheet
        open={sheetOpen}
        conversationId={conversationId ?? null}
        onOpenChange={closeSheet}
        sourceKind={normalizeSourceKind(conversationQuery.data?.sourceKind)}
        audioUrl={conversationQuery.data?.audioUrl}
        rebuildInProgress={conversationQuery.data?.rebuildInProgress === true}
        summary={conversationQuery.data?.summary}
        metricResults={conversationQuery.data?.metricResults}
        transcriptText={conversationQuery.data?.transcriptText}
        runs={conversationQuery.data?.runs}
        isLoading={conversationQuery.isLoading}
        isError={conversationQuery.isError}
        onRetry={() => void conversationQuery.refetch()}
        canManage={canManage}
        onRegenerate={() => void handleRegenerate()}
        onDelete={() => void handleDelete()}
        isRegenerating={regenerateState.isLoading}
        isDeleting={deleteState.isLoading}
      />

      <UploadForm
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        projects={projects}
        onSubmit={handleUpload}
        isSubmitting={uploadState.isLoading}
        formError={uploadFormError}
      />
    </VStack>
  );
});

SpeechAnalyticsJournalPage.displayName = 'SpeechAnalyticsJournalPage';
