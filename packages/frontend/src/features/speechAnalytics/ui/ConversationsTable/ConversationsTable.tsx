import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { ChevronDown, ChevronUp, Download, Loader2, MessageSquareText, Search, Trash2 } from 'lucide-react';
import {
  Button, Card, CardContent, CardHeader, DataTable, Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, TableRowAction, Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useCrossPageRowSelection } from '@/shared/hooks/useCrossPageRowSelection';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { UserLevel } from '@krasterisk/shared';
import { accessTokenIsImpersonation } from '@/features/auth/lib/impersonationSession';
import { downloadBlob } from '@/shared/lib/csv';
import { toast } from 'react-toastify';
import { type SaAnalysisJob, type SaJournalRow, useDeleteSaConversationsMutation, useExportSaJournalExcelMutation } from '../../api/speechAnalyticsApi';
import { AnalysisJobsPanel } from '../AnalysisJobsPanel/AnalysisJobsPanel';
import { filterJournalRows, sourceGroup, type JournalTableFilters } from './filterJournalRows';
import { formatJournalDuration, formatJournalWhen, useConversationsTableColumns } from './useConversationsTableColumns';
import cls from './ConversationsTable.module.scss';

const PAGE_SIZE = 20;
const DEFAULT_SCORE_SCALE = { min: 1, max: 5 };

const EMPTY_FILTERS: JournalTableFilters = {
  search: '',
  source: '',
  dateFrom: '',
  dateTo: '',
  sentiment: '',
  scoreFrom: '',
  scoreTo: '',
};

export interface ConversationsTableProps {
  items: SaJournalRow[];
  uploadProgress?: { done: number; total: number };
  analysisJobs?: SaAnalysisJob[];
  isLoading?: boolean;
  expandedId?: string | null;
  onRowClick?: (id: string) => void;
  renderExpanded?: (row: SaJournalRow) => ReactNode;
  /** Cabinet CSAT bounds. The inputs stay two fields even when max is 100. */
  scoreScale?: { min: number; max: number };
}

export const ConversationsTable = memo(({
  items,
  uploadProgress = { done: 0, total: 0 },
  analysisJobs = [],
  isLoading = false,
  expandedId = null,
  onRowClick,
  renderExpanded,
  scoreScale = DEFAULT_SCORE_SCALE,
}: ConversationsTableProps) => {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile(768);
  const userLevel = useAppSelector((state) => state.auth.user?.level);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const canDeleteSelected = userLevel === UserLevel.SUPERADMIN || accessTokenIsImpersonation(accessToken);
  const baseColumns = useConversationsTableColumns();
  const columns = useMemo<ColumnDef<SaJournalRow, unknown>[]>(() => [
    ...baseColumns,
    {
      id: 'expand',
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => {
        const open = expandedId === row.original.id;
        const label = open
          ? t('speechAnalytics.collapseConversation', 'Скрыть разбор')
          : t('speechAnalytics.expandConversation', 'Показать разбор');
        return (
          <HStack justify="end">
            <TableRowAction
              title={label}
              aria-label={label}
              aria-expanded={open}
              data-testid={`journal-expand-${row.original.id}`}
              onClick={(event) => {
                event.stopPropagation();
                onRowClick?.(row.original.id);
              }}
            >
              {open ? <ChevronUp /> : <ChevronDown />}
            </TableRowAction>
          </HStack>
        );
      },
    },
  ], [baseColumns, expandedId, onRowClick, t]);
  const [filters, setFilters] = useState<JournalTableFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const scoreMin = Number.isInteger(scoreScale.min) ? scoreScale.min : DEFAULT_SCORE_SCALE.min;
  const scoreMax = Number.isInteger(scoreScale.max) && scoreScale.max >= scoreMin
    ? scoreScale.max
    : DEFAULT_SCORE_SCALE.max;

  const filtered = useMemo(() => filterJournalRows(items, filters), [items, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const filterKey = `${filters.search}|${filters.source}|${filters.dateFrom}|${filters.dateTo}|${filters.sentiment}|${filters.scoreFrom}|${filters.scoreTo}`;
  const selection = useCrossPageRowSelection({ globalFilter: filterKey });
  const [exportJournalExcel, { isLoading: isExporting }] = useExportSaJournalExcelMutation();
  const [deleteConversations, { isLoading: isDeleting }] = useDeleteSaConversationsMutation();
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setPage(0);
  }, [filterKey]);

  useEffect(() => {
    setFilters((prev) => {
      const clamp = (raw: string) => {
        if (!raw.trim()) return raw;
        const value = Number(raw);
        if (!Number.isFinite(value)) return '';
        return String(Math.min(scoreMax, Math.max(scoreMin, value)));
      };
      const scoreFrom = clamp(prev.scoreFrom);
      const scoreTo = clamp(prev.scoreTo);
      if (scoreFrom === prev.scoreFrom && scoreTo === prev.scoreTo) return prev;
      return { ...prev, scoreFrom, scoreTo };
    });
  }, [scoreMin, scoreMax]);

  useEffect(() => {
    if (!expandedId) return;
    const index = filtered.findIndex((row) => row.id === expandedId);
    if (index < 0) return;
    const nextPage = Math.floor(index / PAGE_SIZE);
    setPage((current) => (current === nextPage ? current : nextPage));
  }, [expandedId, filtered]);

  const setScoreBound = (key: 'scoreFrom' | 'scoreTo', raw: string) => {
    setFilters((prev) => ({ ...prev, [key]: raw }));
  };

  const selectedActionIds = selection.allMatchingSelected
    ? filtered.map((row) => row.id)
    : selection.selectedIds;

  const handleExportSelected = useCallback(async () => {
    if (selectedActionIds.length === 0) return;
    try {
      const blob = await exportJournalExcel({
        ids: selectedActionIds,
        locale: i18n.language,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        headers: {
          occurredAt: t('speechAnalytics.colOccurred', 'Дата'),
          sourceKind: t('speechAnalytics.colSource', 'Источник'),
          latestAmount: t('speechAnalytics.colCost', 'Стоимость'),
          currency: t('speechAnalytics.excelCurrency', 'Валюта'),
          summary: t('speechAnalytics.colSummary', 'Саммари'),
          transcript: t('speechAnalytics.sheetTabTranscript', 'Расшифровка'),
          sttQuality: t('speechAnalytics.excelSttQuality', 'Качество распознавания'),
          topics: t('speechAnalytics.colTopics', 'Темы'),
          rationales: t('speechAnalytics.excelRationales', 'Обоснования'),
        },
      }).unwrap();
      downloadBlob(blob, 'speech-analytics-journal.xlsx');
    } catch {
      toast.error(t('speechAnalytics.errorExport', 'Не удалось выгрузить Excel. Повторите попытку.'));
    }
  }, [exportJournalExcel, i18n.language, selectedActionIds, t]);

  const handleDeleteSelected = useCallback(async () => {
    const ids = selectedActionIds;
    if (ids.length === 0) return;
    try {
      const result = await deleteConversations(ids).unwrap();
      setDeleteOpen(false);
      selection.clearSelection();
      toast.success(t('speechAnalytics.journalDeleted', {
        count: result.deleted,
        defaultValue: `Удалено записей: ${result.deleted}`,
      }));
    } catch {
      setDeleteOpen(false);
      toast.error(t('speechAnalytics.deleteRecordingFailed', 'Не удалось удалить запись'));
    }
  }, [deleteConversations, selectedActionIds, selection, t]);

  const hasSelection = selection.selectedCount > 0;

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
        <HStack gap="8" align="center" className={cls.toolbarActions}>
          {hasSelection ? (
            <HStack gap="8" align="center" className={cls.selectionInline} data-testid="table-selection-banner">
              <Text variant="muted">
                {t('common.selectionBannerCount', {
                  count: selection.allMatchingSelected ? filtered.length : selection.selectedCount,
                })}
              </Text>
              {filtered.length > (selection.allMatchingSelected ? filtered.length : selection.selectedCount) ? (
                <Button variant="link" className={cls.selectionLink} onClick={selection.selectAllMatching}>
                  {t('common.selectionBannerSelectAll', { total: filtered.length })}
                </Button>
              ) : null}
            </HStack>
          ) : null}
          {hasSelection ? (
            <Button
              type="button"
              variant="outline"
              disabled={isExporting}
              onClick={() => void handleExportSelected()}
              data-testid="journal-export-selected"
            >
              {isExporting ? <Loader2 size={16} className={cls.spinner} /> : <Download size={16} />}
              {t('speechAnalytics.exportSelectedExcel', 'Экспорт')}
            </Button>
          ) : null}
          {hasSelection && canDeleteSelected ? (
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => setDeleteOpen(true)}
              data-testid="journal-delete-selected"
            >
              <Trash2 size={16} />
              {t('common.delete', 'Удалить')}
            </Button>
          ) : null}
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
        </HStack>
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
        <VStack gap="4" className={cls.filterField}>
          <Label htmlFor="journal-score-from">
            {t('speechAnalytics.filterScore', 'Оценка')}
          </Label>
          <HStack gap="8" align="center">
            <Input
              id="journal-score-from"
              type="number"
              inputMode="numeric"
              min={scoreMin}
              max={scoreMax}
              className={cls.scoreBound}
              placeholder={t('speechAnalytics.settingsScaleFrom', 'От')}
              aria-label={t('speechAnalytics.filterScoreFrom', 'Оценка от')}
              value={filters.scoreFrom}
              onChange={(event) => setScoreBound('scoreFrom', event.target.value)}
            />
            <Input
              id="journal-score-to"
              type="number"
              inputMode="numeric"
              min={scoreMin}
              max={scoreMax}
              className={cls.scoreBound}
              placeholder={t('speechAnalytics.settingsScaleTo', 'До')}
              aria-label={t('speechAnalytics.filterScoreTo', 'Оценка до')}
              value={filters.scoreTo}
              onChange={(event) => setScoreBound('scoreTo', event.target.value)}
            />
          </HStack>
        </VStack>
      </Flex>
    </VStack>
  );

  return (
    <VStack gap="12" max className={cls.wrap} data-testid="conversations-table">
      <AnalysisJobsPanel jobs={analysisJobs} progress={uploadProgress} />

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
              ) : pageRows.map((row) => {
                const group = sourceGroup(row.sourceKind);
                const sourceLabel = group === 'api'
                  ? t('speechAnalytics.sourceApi', 'Аналитика (API)')
                  : group === 'upload'
                    ? t('speechAnalytics.sourceUpload', 'Аналитика')
                    : t('speechAnalytics.sourceCall', 'Звонок');
                const sentimentLabel = row.sentiment === 'positive'
                  ? t('speechAnalytics.sentimentPositive', 'Позитивное')
                  : row.sentiment === 'negative'
                    ? t('speechAnalytics.sentimentNegative', 'Негативное')
                    : row.sentiment === 'neutral'
                      ? t('speechAnalytics.sentimentNeutral', 'Нейтральное')
                      : '-';
                const resultLabel = row.success === true
                  ? t('speechAnalytics.resultSuccess', 'Успех')
                  : row.success === false
                    ? t('speechAnalytics.resultEscalation', 'Эскалация')
                    : '-';
                const fields = [
                  [t('speechAnalytics.colOccurred', 'Дата'), formatJournalWhen(row.occurredAt)],
                  [t('speechAnalytics.colName', 'Имя'), row.operatorName?.trim() || '-'],
                  [t('speechAnalytics.colCaller', 'Номер'), row.callerPhone?.trim() || '-'],
                  [t('speechAnalytics.colSource', 'Источник'), sourceLabel],
                  [t('speechAnalytics.colDuration', 'Длительность'), formatJournalDuration(row.durationMs)],
                  [t('speechAnalytics.colCost', 'Стоимость'), row.latestAmount != null
                    ? `${row.latestAmount} ${row.currency ?? ''}`.trim()
                    : t('speechAnalytics.costPending', 'Сумма не посчитана')],
                  [t('speechAnalytics.colScore', 'Оценка'), row.score != null ? String(row.score) : '-'],
                  [t('speechAnalytics.colSentiment', 'Настроение'), sentimentLabel],
                  [t('speechAnalytics.colTopics', 'Темы'), (row.topics ?? []).join(', ') || '-'],
                  [t('speechAnalytics.colResult', 'Результат'), resultLabel],
                ];
                const open = expandedId === row.id;
                const toggleLabel = open
                  ? t('speechAnalytics.collapseConversation', 'Скрыть разбор')
                  : t('speechAnalytics.expandConversation', 'Показать разбор');
                return (
                <VStack key={row.id} gap="8" max>
                  <Button
                    type="button"
                    variant="outline"
                    className={cls.mobileCard}
                    data-testid={`journal-row-${row.id}`}
                    aria-expanded={open}
                    aria-label={toggleLabel}
                    onClick={() => onRowClick?.(row.id)}
                  >
                    <VStack gap="4" max>
                      <HStack justify="end" max>
                        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </HStack>
                      {fields.map(([label, value]) => (
                        <HStack key={label} justify="between" align="start" max className={cls.mobileField}>
                          <Text variant="muted" className={cls.mobileLabel}>{label}</Text>
                          <Text className={cls.mobileValue}>{value}</Text>
                        </HStack>
                      ))}
                    </VStack>
                  </Button>
                  {open ? renderExpanded?.(row) : null}
                </VStack>
                );
              })}
              {filtered.length > PAGE_SIZE ? (
                <HStack justify="between" align="center" max>
                  <Button type="button" variant="outline" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
                    {t('speechAnalytics.pagePrev', 'Назад')}
                  </Button>
                  <Text>
                    {safePage * PAGE_SIZE + 1}-{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} / {filtered.length}
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
              className={`${cls.tableScroll} ${cls.journalTable}`}
              data-testid="conversations-wide-table"
              data-hybrid="overflow-x-auto"
            >
              <DataTable
                key={filterKey}
                ref={selection.tableRef}
                data={filtered}
                columns={columns}
                pageSize={PAGE_SIZE}
                getRowId={(row) => row.id}
                getRowTestId={(row) => `journal-row-${row.id}`}
                selectable
                rowSelection={selection.rowSelection}
                onRowSelectionChange={selection.onRowSelectionChange}
                onRowClick={(row) => onRowClick?.(row.id)}
                getRowClassName={(row) => (expandedId === row.id ? cls.rowOpen : cls.row)}
                renderExpandedRow={(row) => (expandedId === row.id ? renderExpanded?.(row) : null)}
                emptyText={t('speechAnalytics.emptyFilter', 'Нет разговоров по этому фильтру')}
                className={cls.tableFill}
                selectAllAriaLabel={t('speechAnalytics.selectPageAria', 'Выбрать страницу')}
              />
            </Flex>
          )}
        </CardContent>
      </Card>
      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!isDeleting) setDeleteOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('speechAnalytics.journalConfirmDeleteSelected', {
                count: selection.selectedCount,
                defaultValue: `Удалить выбранные записи (${selection.selectedCount})?`,
              })}
            </DialogTitle>
            <DialogDescription>
              {t('speechAnalytics.journalConfirmDeleteSelectedBody', 'Записи и их разборы будут удалены без восстановления.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isDeleting} onClick={() => setDeleteOpen(false)}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button type="button" variant="destructive" disabled={isDeleting} onClick={() => void handleDeleteSelected()}>
              {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : null}
              {t('common.delete', 'Удалить')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VStack>
  );
});

ConversationsTable.displayName = 'ConversationsTable';
