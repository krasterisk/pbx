import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import {
  Badge,
  Button,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
} from '@/shared/ui';
import { AudioPlayer } from '@/shared/ui/AudioPlayer';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import cls from './ConversationSheet.module.scss';

export type ConversationSourceKind = 'pbx' | 'upload' | 'api';

export interface ConversationRunCost {
  id: string;
  amount: string | null;
  currency: string | null;
  createdAt: string;
}

export interface ConversationSheetProps {
  open: boolean;
  conversationId: string | null;
  onOpenChange: (open: boolean) => void;
  sourceKind: ConversationSourceKind;
  audioUrl?: string | null;
  rebuildInProgress?: boolean;
  summary?: string | null;
  transcriptText?: string | null;
  runs?: ConversationRunCost[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function showTranscriptPlayer(sourceKind: ConversationSourceKind): boolean {
  return sourceKind === 'upload' || sourceKind === 'api';
}

export function ConversationSheet({
  open,
  conversationId,
  onOpenChange,
  sourceKind,
  audioUrl,
  rebuildInProgress = false,
  summary,
  transcriptText,
  runs = [],
  isLoading = false,
  isError = false,
  onRetry,
}: ConversationSheetProps) {
  const { t } = useTranslation();
  const closeLabel = t('speechAnalytics.sheetClose', 'Закрыть');
  const analyticsTab = t('speechAnalytics.sheetTabAnalytics', 'Аналитика');
  const transcriptTab = t('speechAnalytics.sheetTabTranscript', 'Расшифровка');
  const costTab = t('speechAnalytics.sheetTabCost', 'Стоимость');
  const costLabel = t('speechAnalytics.costNotCharged', 'Посчитано, не списано');
  const rebuildBadge = t('speechAnalytics.rebuildInProgress', 'Идёт пересборка');
  const noAudio = t('speechAnalytics.noAudio', 'Нет аудио');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cls.sheetContent}
        data-testid="conversation-sheet"
        data-conversation-id={conversationId ?? undefined}
      >
        <SheetHeader className={cls.header}>
          <HStack justify="between" align="start" max>
            <VStack gap="8" className={cls.titleBlock}>
              <SheetTitle>
                <Text variant="h2" as="span">
                  {analyticsTab}
                </Text>
              </SheetTitle>
              {rebuildInProgress ? (
                <Badge
                  className={cls.rebuildBadge}
                  data-testid="conversation-rebuild-badge"
                >
                  {rebuildBadge}
                </Badge>
              ) : null}
            </VStack>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cls.closeBtn}
              title={closeLabel}
              aria-label={closeLabel}
              onClick={() => onOpenChange(false)}
            >
              <X size={16} />
            </Button>
          </HStack>
        </SheetHeader>

        <div className={cls.body}>
          {isLoading ? (
            <VStack gap="12" max data-testid="conversation-sheet-loading">
              <Skeleton className={cls.skeletonBlock} />
              <Skeleton className={cls.skeletonBlock} />
            </VStack>
          ) : null}

          {isError ? (
            <VStack gap="12" max data-testid="conversation-sheet-error">
              <Text variant="muted">
                {t(
                  'speechAnalytics.errorLoadConversation',
                  'Не удалось загрузить разговор. Повторите попытку.',
                )}
              </Text>
              {onRetry ? (
                <Button type="button" variant="outline" onClick={onRetry}>
                  {t('common.retry', 'Повторить')}
                </Button>
              ) : null}
            </VStack>
          ) : null}

          {!isLoading && !isError ? (
            <Tabs defaultValue="analytics" className={cls.tabs}>
              <TabsList aria-label={t('speechAnalytics.sheetTabs', 'Вкладки разговора')}>
                <TabsTrigger value="analytics">{analyticsTab}</TabsTrigger>
                <TabsTrigger value="transcript">{transcriptTab}</TabsTrigger>
                <TabsTrigger value="cost">{costTab}</TabsTrigger>
              </TabsList>

              <TabsContent value="analytics" className={cls.tabPanel}>
                <ScrollArea className={cls.scroll}>
                  <VStack gap="12" max>
                    <Text>{summary || t('speechAnalytics.emptySummary', 'Нет саммари')}</Text>
                  </VStack>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="transcript" className={cls.tabPanel}>
                <VStack gap="12" max className={cls.transcriptPane}>
                  {showTranscriptPlayer(sourceKind) ? (
                    audioUrl ? (
                      <div data-testid="conversation-sheet-player-slot">
                        <AudioPlayer src={audioUrl} />
                      </div>
                    ) : (
                      <Text variant="muted" data-testid="conversation-sheet-no-audio">
                        {noAudio}
                      </Text>
                    )
                  ) : null}
                  <ScrollArea className={cls.scroll}>
                    <Text as="pre" className={cls.transcriptText}>
                      {transcriptText || t('speechAnalytics.emptyTranscript', 'Нет расшифровки')}
                    </Text>
                  </ScrollArea>
                </VStack>
              </TabsContent>

              <TabsContent value="cost" className={cls.tabPanel}>
                <ScrollArea className={cls.scroll}>
                  {runs.length === 0 ? (
                    <VStack gap="8" max data-testid="conversation-cost-empty">
                      <Text variant="muted">
                        {t('speechAnalytics.emptyCostRuns', 'Прогонов пока нет')}
                      </Text>
                    </VStack>
                  ) : (
                    <VStack gap="12" max data-testid="conversation-cost-list">
                      {runs.map((run) => (
                        <Flex
                          key={run.id}
                          justify="between"
                          align="center"
                          max
                          className={cls.costRow}
                          data-testid={`conversation-cost-run-${run.id}`}
                        >
                          <VStack gap="4">
                            <Text>
                              {run.amount != null
                                ? `${run.amount} ${run.currency ?? ''}`.trim()
                                : t('speechAnalytics.costPending', 'Сумма не посчитана')}
                            </Text>
                            <Text variant="muted" className={cls.costMeta}>
                              {run.createdAt}
                            </Text>
                          </VStack>
                          <Text variant="muted" className={cls.costLabel}>
                            {costLabel}
                          </Text>
                        </Flex>
                      ))}
                    </VStack>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
