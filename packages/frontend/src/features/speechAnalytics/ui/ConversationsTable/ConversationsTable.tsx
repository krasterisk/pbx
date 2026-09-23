import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, MessageSquareText, Search, Star } from 'lucide-react';
import {
  Button, Card, CardContent, CardHeader, DataTable, Input, Label, Select, Text,
} from '@/shared/ui';
import { Progress } from '@/shared/ui/Progress/Progress';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import type { SaJournalRow } from '../../api/speechAnalyticsApi';
import { filterJournalRows, type JournalTableFilters } from './filterJournalRows';
import { useConversationsTableColumns } from './useConversationsTableColumns';
import cls from './ConversationsTable.module.scss';

const PAGE_SIZE = 20;
const SCORE_VALUES = [1, 2, 3, 4, 5];

const EMPTY_FILTERS: JournalTableFilters = {
  search: '',
  source: '',
  dateFrom: '',
  dateTo: '',
  sentiment: '',
  scores: [],
};

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
  const columns = useConversationsTableColumns();
  const [filters, setFilters] = useState<JournalTableFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => filterJournalRows(items, filters), [items, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const filterKey = `${filters.search}|${filters.source}|${filters.dateFrom}|${filters.dateTo}|${filters.sentiment}|${filters.scores.join(',')}`;

  useEffect(() => {
    setPage(0);
  }, [filterKey]);

  const showProgress = uploadProgress.total > 0;
  const progressPct = showProgress
    ? Math.round((uploadProgress.done / uploadProgress.total) * 100)
    : 0;

  const toggleScore = (score: number) => {
    setFilters((prev) => ({
      ...prev,
      scores: prev.scores.includes(score)
        ? prev.scores.filter((item) => item !== score)
        : [...prev.scores, score],
    }));
  };

  const toolbar = (
    <VStack gap="12" max className={cls.toolbar}>
      <Flex justify="between" align="center" className={cls.toolbarRow} max>
        <HStack gap="8" align="center">
          <MessageSquareText size={20} className={cls.toolbarIcon} />
          <Text className={cls.count}>
            {t('speechAnalytics.journalCount', {
              count: filtered.length,
              defaultValue: `Всего: ${filtered.length}`,
            })}
          </Text>
        </HStack>
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="journal-search"
            value={filters.search}
            placeholder={t('speechAnalytics.journalSearch', 'Поиск...')}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            className={cls.searchInput}
          />
        </Flex>
      </Flex>
      <Flex align="end" className={cls.filters} max>
        <VStack gap="4" className={cls.filterField}>
          <Label htmlFor="journal-date-from">{t('speechAnalytics.filterDateFrom', 'Дата с')}</Label>
          <Input
            id="journal-date-from"
            type="date"
            value={filters.dateFrom}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
          />
        </VStack>
        <VStack gap="4" className={cls.filterField}>
          <Label htmlFor="journal-date-to">{t('speechAnalytics.filterDateTo', 'Дата по')}</Label>
          <Input
            id="journal-date-to"
            type="date"
            value={filters.dateTo}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
          />
        </VStack>
        <VStack gap="4" className={cls.filterField}>
          <Label htmlFor="journal-source">{t('speechAnalytics.colSource', 'Источник')}</Label>
          <Select
            id="journal-source"
            value={filters.source}
            onChange={(event) => setFilters((prev) => ({
              ...prev,
              source: event.target.value as JournalTableFilters['source'],
            }))}
          >
            <option value="">{t('speechAnalytics.filterAll', 'Все')}</option>
            <option value="pbx">{t('speechAnalytics.sourceCall', 'Звонок')}</option>
            <option value="upload">{t('speechAnalytics.sourceUpload', 'Аналитика')}</option>
            <option value="api">{t('speechAnalytics.sourceApi', 'Аналитика (API)')}</option>
          </Select>
        </VStack>
        <VStack gap="4" className={cls.filterField}>
          <Label htmlFor="journal-sentiment">{t('speechAnalytics.colSentiment', 'Настроение')}</Label>
          <Select
            id="journal-sentiment"
            value={filters.sentiment}
            onChange={(event) => setFilters((prev) => ({
              ...prev,
              sentiment: event.target.value as JournalTableFilters['sentiment'],
            }))}
          >
            <option value="">{t('speechAnalytics.filterAll', 'Все')}</option>
            <option value="positive">{t('speechAnalytics.sentimentPositive', 'Позитивное')}</option>
            <option value="neutral">{t('speechAnalytics.sentimentNeutral', 'Нейтральное')}</option>
            <option value="negative">{t('speechAnalytics.sentimentNegative', 'Негативное')}</option>
          </Select>
        </VStack>
        <VStack gap="4">
          <Text variant="small">{t('speechAnalytics.filterScore', 'Фильтр по оценке')}</Text>
          <HStack gap="4" align="center" role="group" aria-label={t('speechAnalytics.filterScore', 'Фильтр по оценке')}>
            {SCORE_VALUES.map((score) => {
              const selected = filters.scores.includes(score);
              return (
                <Button
                  key={score}
                  type="button"
                  variant={selected ? 'default' : 'outline'}
                  aria-pressed={selected}
                  className={cls.scoreChip}
                  onClick={() => toggleScore(score)}
                >
                  <Star size={14} className={selected ? cls.csatStar : cls.scoreStarMuted} />
                  <Text as="span">{score}</Text>
                </Button>
              );
            })}
          </HStack>
        </VStack>
      </Flex>
    </VStack>
  );

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

      <Card className={cls.card}>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent className={cls.cardContent}>
          {isLoading ? (
            <Flex align="center" justify="center" className={cls.loading} data-testid="conversations-table-loading">
              <Loader2 size={24} className={cls.spinner} />
            </Flex>
          ) : isMobile ? (
            <VStack gap="8" max className={cls.mobileList} data-testid="conversations-mobile-cards" data-hybrid="mobile-card">
              {pageRows.length === 0 ? (
                <Text variant="muted">{t('speechAnalytics.emptyFilter', 'Нет разговоров по этому фильтру')}</Text>
              ) : pageRows.map((row) => (
                <Button
                  key={row.id}
                  type="button"
                  variant="outline"
                  className={cls.mobileCard}
                  data-testid={`journal-row-${row.id}`}
                  onClick={() => onRowClick?.(row.id)}
                >
                  <VStack gap="4" max>
                    <Text>{row.operatorName || row.summary || row.id}</Text>
                    <HStack justify="between" max>
                      <Text variant="muted">{row.callerPhone || row.occurredAt}</Text>
                      <Text variant="muted">
                        {row.latestAmount != null
                          ? `${row.latestAmount} ${row.currency ?? ''}`.trim()
                          : t('speechAnalytics.costPending', 'Сумма не посчитана')}
                      </Text>
                    </HStack>
                  </VStack>
                </Button>
              ))}
              {filtered.length > PAGE_SIZE ? (
                <HStack justify="between" align="center" max>
                  <Button type="button" variant="outline" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
                    {t('speechAnalytics.pagePrev', 'Назад')}
                  </Button>
                  <Text>
                    {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} / {filtered.length}
                  </Text>
                  <Button type="button" variant="outline" disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => value + 1)}>
                    {t('speechAnalytics.pageNext', 'Вперёд')}
                  </Button>
                </HStack>
              ) : null}
            </VStack>
          ) : (
            <Flex
              direction="column"
              align="stretch"
              max
              className={cls.tableScroll}
              data-testid="conversations-wide-table"
              data-hybrid="overflow-x-auto"
            >
              <DataTable
                key={filterKey}
                data={filtered}
                columns={columns}
                pageSize={PAGE_SIZE}
                getRowId={(row) => row.id}
                getRowTestId={(row) => `journal-row-${row.id}`}
                onRowClick={(row) => onRowClick?.(row.id)}
                emptyText={t('speechAnalytics.emptyFilter', 'Нет разговоров по этому фильтру')}
                className={cls.tableFill}
              />
            </Flex>
          )}
        </CardContent>
      </Card>
    </VStack>
  );
});

ConversationsTable.displayName = 'ConversationsTable';
