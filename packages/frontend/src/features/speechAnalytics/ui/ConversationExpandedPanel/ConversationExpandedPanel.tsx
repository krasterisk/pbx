import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, MessageSquareText, Receipt, RefreshCw, Star, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { AnalyticsView, BillingView, TranscriptView, type ConversationTurn } from './ConversationDetailViews';
import cls from './ConversationExpandedPanel.module.scss';

export type ConversationSourceKind = 'pbx' | 'upload' | 'api';

export interface ConversationRunCost {
  id: string;
  amount: string | null;
  currency: string | null;
  audioMs?: string | null;
  providerTokens?: string | null;
  createdAt: string;
}

export interface ConversationMetricResult {
  id: string;
  value: unknown;
  rationale?: string;
  quote?: string;
}

export interface ConversationExpandedPanelProps {
  conversationId: string | null;
  sourceKind: ConversationSourceKind;
  audioUrl?: string | null;
  rebuildInProgress?: boolean;
  summary?: string | null;
  metricResults?: ConversationMetricResult[];
  transcriptText?: string | null;
  turns?: ConversationTurn[];
  runs?: ConversationRunCost[];
  onSaveOverride?: (input: { metricId: string; value: string; note: string }) => void;
  isSavingOverride?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  canManage?: boolean;
  onRegenerate?: () => void;
  onDelete?: () => void;
  isRegenerating?: boolean;
  isDeleting?: boolean;
}

function isScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function ConversationExpandedPanel({
  conversationId,
  sourceKind,
  audioUrl,
  rebuildInProgress = false,
  summary,
  metricResults = [],
  transcriptText,
  turns = [],
  runs = [],
  onSaveOverride,
  isSavingOverride = false,
  isLoading = false,
  isError = false,
  onRetry,
  canManage = false,
  onRegenerate,
  onDelete,
  isRegenerating = false,
  isDeleting = false,
}: ConversationExpandedPanelProps) {
  const { t } = useTranslation();
  const analyticsTab = t('speechAnalytics.sheetTabAnalytics', 'Аналитика');
  const transcriptTab = t('speechAnalytics.sheetTabTranscript', 'Расшифровка');
  const costTab = t('speechAnalytics.sheetTabCost', 'Стоимость');
  const tabsLabel = t('speechAnalytics.sheetTabs', 'Вкладки разговора');

  const csat = useMemo(() => {
    const raw = metricResults.find((metric) => metric.id === 'csat')?.value;
    return isScore(raw) ? raw : null;
  }, [metricResults]);

  return (
    <VStack
      gap="0"
      max
      className={cls.panel}
      data-testid="conversation-expanded"
      data-conversation-id={conversationId ?? undefined}
    >
      {canManage || rebuildInProgress ? (
        <HStack justify="end" align="center" gap="8" max className={cls.actionsBar}>
          {rebuildInProgress ? (
            <Badge className={cls.rebuildBadge} data-testid="conversation-rebuild-badge">
              {t('speechAnalytics.rebuildInProgress', 'Идёт пересборка')}
            </Badge>
          ) : null}
          {canManage ? (
            <HStack justify="end" gap="8" data-testid="conversation-admin-actions">
              <Button
                type="button"
                variant="outline"
                disabled={isRegenerating || rebuildInProgress}
                data-testid="conversation-regenerate"
                onClick={onRegenerate}
              >
                <RefreshCw size={16} />
                {t('speechAnalytics.regenerateAnalytics', 'Переформировать аналитику')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isDeleting}
                data-testid="conversation-delete"
                onClick={onDelete}
              >
                <Trash2 size={16} />
                {t('speechAnalytics.deleteRecording', 'Удалить запись')}
              </Button>
            </HStack>
          ) : null}
        </HStack>
      ) : null}

      {isLoading ? (
        <VStack gap="12" max className={cls.body} data-testid="conversation-expanded-loading">
          <Skeleton className={cls.skeletonBlock} />
          <Skeleton className={cls.skeletonBlock} />
        </VStack>
      ) : null}

      {isError ? (
        <QueryErrorState message={t(
              'speechAnalytics.errorLoadConversation',
              'Не удалось загрузить разговор. Повторите попытку.',
            )} onRetry={onRetry} retryLabel={t('common.retry', 'Повторить')} data-testid="conversation-expanded-error" />
      ) : null}

      {!isLoading && !isError ? (
        <Tabs defaultValue="analytics" className={cls.tabs}>
          <TabsList aria-label={tabsLabel} className={cls.tabList}>
            <TabsTrigger value="analytics" className={cls.tab}>
              <BarChart3 size={16} />
              <Text as="span">{analyticsTab}</Text>
              {csat != null ? (
                <Text as="span" aria-hidden className={cls.tabBadge}>
                  <Star size={12} />
                  {String(csat)}
                </Text>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="transcript" className={cls.tab}>
              <MessageSquareText size={16} />
              <Text as="span">{transcriptTab}</Text>
            </TabsTrigger>
            <TabsTrigger value="cost" className={cls.tab}>
              <Receipt size={16} />
              <Text as="span">{costTab}</Text>
              {runs.length > 0 ? (
                <Text as="span" aria-hidden className={cls.tabBadge}>{String(runs.length)}</Text>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className={cls.tabPanel}>
            <VStack gap="12" max className={cls.fadeIn}>
              <AnalyticsView
                summary={summary}
                metricResults={metricResults}
                canManage={canManage}
                onSaveOverride={onSaveOverride}
                isSavingOverride={isSavingOverride}
              />
            </VStack>
          </TabsContent>

          <TabsContent value="transcript" className={cls.tabPanel}>
            <VStack gap="12" max className={cls.fadeIn}>
              <TranscriptView
                sourceKind={sourceKind}
                audioUrl={audioUrl}
                turns={turns}
                transcriptText={transcriptText}
              />
            </VStack>
          </TabsContent>

          <TabsContent value="cost" className={cls.tabPanel}>
            <VStack gap="12" max className={cls.fadeIn}>
              <BillingView runs={runs} />
            </VStack>
          </TabsContent>
        </Tabs>
      ) : null}
    </VStack>
  );
}
