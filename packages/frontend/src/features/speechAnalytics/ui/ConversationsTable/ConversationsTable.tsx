import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Text } from '@/shared/ui';
import { Progress } from '@/shared/ui/Progress/Progress';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import type { SaJournalRow } from '../../api/speechAnalyticsApi';
import cls from './ConversationsTable.module.scss';

export interface ConversationsTableProps {
  items: SaJournalRow[];
  uploadProgress?: { done: number; total: number };
  isLoading?: boolean;
  onRowClick?: (id: string) => void;
}

export const ConversationsTable = memo(({
  items,
  uploadProgress = { done: 0, total: 0 },
  isLoading = false,
  onRowClick,
}: ConversationsTableProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const showProgress = uploadProgress.total > 0;
  const progressPct = showProgress
    ? Math.round((uploadProgress.done / uploadProgress.total) * 100)
    : 0;

  return (
    <VStack gap="12" max className={cls.wrap} data-testid="conversations-table">
      {showProgress ? (
        <VStack gap="8" max className={cls.progressStrip} data-testid="journal-upload-progress">
          <Text>
            {t('speechAnalytics.journalProgress', {
              done: uploadProgress.done,
              total: uploadProgress.total,
              defaultValue: `Готово ${uploadProgress.done} из ${uploadProgress.total}`,
            })}
          </Text>
          <Progress value={progressPct} tone="info" />
        </VStack>
      ) : null}

      {isLoading ? (
        <Flex align="center" justify="center" className={cls.loading} data-testid="conversations-table-loading">
          <Loader2 size={24} className={cls.spinner} />
        </Flex>
      ) : null}

      {!isLoading && isMobile ? (
        <VStack gap="8" max className={cls.mobileList} data-testid="conversations-mobile-cards">
          {items.map((row) => (
            <button
              key={row.id}
              type="button"
              className={cls.mobileCard}
              data-testid={`journal-row-${row.id}`}
              onClick={() => onRowClick?.(row.id)}
            >
              <VStack gap="4" max>
                <Text>{row.summary || row.id}</Text>
                <HStack justify="between" max>
                  <Text variant="muted">{row.occurredAt}</Text>
                  <Text variant="muted">
                    {row.latestAmount != null
                      ? `${row.latestAmount} ${row.currency ?? ''}`.trim()
                      : t('speechAnalytics.costPending', 'Сумма не посчитана')}
                  </Text>
                </HStack>
              </VStack>
            </button>
          ))}
        </VStack>
      ) : null}

      {!isLoading && !isMobile ? (
        <div className={cls.tableScroll} data-testid="conversations-wide-table">
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t('speechAnalytics.colSummary', 'Саммари')}</th>
                <th>{t('speechAnalytics.colOccurred', 'Дата')}</th>
                <th>{t('speechAnalytics.colCost', 'Стоимость')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  data-testid={`journal-row-${row.id}`}
                  className={cls.row}
                  onClick={() => onRowClick?.(row.id)}
                >
                  <td>{row.summary || row.id}</td>
                  <td>{row.occurredAt}</td>
                  <td>
                    {row.latestAmount != null
                      ? `${row.latestAmount} ${row.currency ?? ''}`.trim()
                      : t('speechAnalytics.costPending', 'Сумма не посчитана')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </VStack>
  );
});

ConversationsTable.displayName = 'ConversationsTable';
