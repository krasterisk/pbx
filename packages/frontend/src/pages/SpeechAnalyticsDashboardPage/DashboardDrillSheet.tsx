import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle, Skeleton, Text } from '@/shared/ui';
import { useTenantTablePageSize } from '@/shared/ui/DataTable/TablePageSizeContext';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import {
  useDrillSaDashboardMutation,
  useGetSaConversationQuery,
} from '@/features/speechAnalytics/api/speechAnalyticsApi';
import {
  ConversationExpandedPanel,
  type ConversationSourceKind,
} from '@/features/speechAnalytics/ui/ConversationExpandedPanel/ConversationExpandedPanel';
import type { DashboardCall, DashboardDrill } from '@/features/speechAnalytics/model/dashboardDrill';
import cls from './SpeechAnalyticsDashboardPage.module.scss';

export type DashboardPanelEntry =
  | { kind: 'list'; title: string; drill: DashboardDrill }
  | { kind: 'operator'; operatorName: string | null; title: string }
  | { kind: 'metric'; title: string; metricId: string; operatorName?: string | null }
  | { kind: 'call'; recordingId: string; title: string };

interface DashboardDrillSheetProps {
  projectId: string;
  from: string;
  to: string;
  stack: DashboardPanelEntry[];
  operators: Array<{
    operatorName: string | null;
    callsCount: number;
    averageScore: number | null;
    successRate: number | null;
    negativeRate: number | null;
  }>;
  metrics: Array<{ id: string; label: string; avg?: number }>;
  calls: DashboardCall[];
  onClose: () => void;
  onBack: () => void;
  onOpenCall: (recordingId: string, title: string) => void;
  onOpenMetric: (metricId: string, title: string, operatorName: string | null) => void;
}

function metricTone(value: number | null): 'toneGood' | 'toneMid' | 'toneBad' | 'toneNeutral' {
  if (value == null || !Number.isFinite(value)) return 'toneNeutral';
  const high = value <= 10 ? 8 : 75;
  const mid = value <= 10 ? 5 : 45;
  if (value >= high) return 'toneGood';
  if (value >= mid) return 'toneMid';
  return 'toneBad';
}

function sourceKindOf(raw: string | undefined): ConversationSourceKind {
  if (raw === 'pbx' || raw === 'cdr' || raw === 'callcenter' || raw === 'autodial') return 'pbx';
  if (raw === 'api' || raw === 'external') return 'api';
  return 'upload';
}

export const DashboardDrillSheet = memo(({
  projectId,
  from,
  to,
  stack,
  operators,
  metrics,
  calls: periodCalls,
  onClose,
  onBack,
  onOpenCall,
  onOpenMetric,
}: DashboardDrillSheetProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const entry = stack[stack.length - 1];
  const [drillDashboard] = useDrillSaDashboardMutation();
  const [calls, setCalls] = useState<DashboardCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = useTenantTablePageSize() ?? 50;
  const conversationId = entry?.kind === 'call' ? entry.recordingId : '';
  const conversationQuery = useGetSaConversationQuery(conversationId, { skip: !conversationId });

  useEffect(() => {
    if (!entry || entry.kind === 'call' || entry.kind === 'operator') {
      setCalls([]);
      return;
    }
    const drill: DashboardDrill = entry.kind === 'metric'
      ? { type: 'metric', metricId: entry.metricId, operatorName: entry.operatorName }
      : entry.drill;
    let cancelled = false;
    setLoading(true);
    void drillDashboard({ projectId, from, to, drill }).unwrap()
      .then((result) => { if (!cancelled) setCalls(result.calls ?? []); })
      .catch(() => { if (!cancelled) setCalls([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [drillDashboard, entry, from, projectId, to]);

  useEffect(() => {
    setPage(0);
  }, [entry, calls]);

  const operatorLabel = (name: string | null | undefined) => (
    name?.trim() || t('speechAnalytics.operatorUnnamed', 'Без имени')
  );
  const operator = entry?.kind === 'operator'
    ? operators.find((row) => row.operatorName === entry.operatorName)
    : undefined;
  const operatorMetrics = useMemo(() => {
    if (entry?.kind !== 'operator') return [];
    const mine = periodCalls.filter((call) => (
      !call.lowStt && (call.operatorName?.trim() || null) === entry.operatorName
    ));
    return metrics.map((metric) => {
      const values = mine
        .map((call) => call.metrics.find((row) => row.id === metric.id)?.value)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      return { ...metric, operatorAvg: avg };
    });
  }, [entry, metrics, periodCalls]);

  return (
    <Sheet open={stack.length > 0} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cls.sheet}
        aria-describedby={undefined}
        style={isMobile ? undefined : { width: '40vw', maxWidth: '100%' }}
      >
        <SheetHeader className={cls.sheetHeader}>
          <HStack gap="8" align="center">
            {stack.length > 1 ? (
              <Button type="button" variant="ghost" className={cls.backBtn} onClick={onBack}>
                <ChevronLeft size={16} />
                {t('speechAnalytics.drillBack', 'Назад')}
              </Button>
            ) : null}
            <SheetTitle>{entry?.title}</SheetTitle>
          </HStack>
        </SheetHeader>
        <div className={cls.sheetBody}>
          {entry?.kind === 'operator' ? (
            <VStack gap="16" max>
              <div className={cls.operatorStats}>
                <div className={cls.operatorStat}>
                  <Text variant="muted" className={cls.fieldLabel}>{t('speechAnalytics.statConversations', 'Разговоры')}</Text>
                  <Text className={cls.operatorStatValue}>{operator?.callsCount ?? 0}</Text>
                </div>
                <div className={cls.operatorStat}>
                  <Text variant="muted" className={cls.fieldLabel}>{t('speechAnalytics.colScore', 'Оценка')}</Text>
                  <Text className={cls.operatorStatValue}>{operator?.averageScore != null ? operator.averageScore.toFixed(1) : '-'}</Text>
                </div>
                <div className={cls.operatorStat}>
                  <Text variant="muted" className={cls.fieldLabel}>{t('speechAnalytics.statSuccess', 'Успех')}</Text>
                  <Text className={cls.operatorStatValue}>{operator?.successRate != null ? `${Math.round(operator.successRate * 100)}%` : '-'}</Text>
                </div>
                <div className={cls.operatorStat}>
                  <Text variant="muted" className={cls.fieldLabel}>{t('speechAnalytics.colNegative', 'Негатив')}</Text>
                  <Text className={cls.operatorStatValue}>{operator?.negativeRate != null ? `${Math.round(operator.negativeRate * 100)}%` : '-'}</Text>
                </div>
              </div>
              <VStack gap="8" max>
                <Text variant="h3" as="h3">{t('speechAnalytics.metricsTitle', 'Метрики')}</Text>
                <Text variant="muted">{t('speechAnalytics.operatorMetricsHint', 'Среднее по звонкам этого оператора. Цвет показывает, где оценка высокая, а где проседает.')}</Text>
                {operatorMetrics.map((metric) => {
                  const tone = metricTone(metric.operatorAvg);
                  const width = metric.operatorAvg == null
                    ? 0
                    : Math.max(0, Math.min(100, metric.operatorAvg <= 10 ? metric.operatorAvg * 10 : metric.operatorAvg));
                  return (
                    <button
                      key={metric.id}
                      type="button"
                      className={cls.metricBar}
                      onClick={() => onOpenMetric(metric.id, metric.label, entry.operatorName)}
                    >
                      <span className={cls.metricBarHead}>
                        <Text className={cls.metricName}>{metric.label}</Text>
                        <Text className={`${cls.metricBarValue} ${cls[tone]}`}>
                          {metric.operatorAvg != null ? String(Math.round(metric.operatorAvg)) : '-'}
                        </Text>
                      </span>
                      {metric.operatorAvg != null ? (
                        <span className={cls.metricTrack}>
                          <span className={`${cls.metricFill} ${cls[tone]}`} style={{ width: `${width}%` }} />
                        </span>
                      ) : (
                        <Text variant="muted">{t('speechAnalytics.operatorMetricEmpty', 'Нет оценок')}</Text>
                      )}
                      {metric.avg != null ? (
                        <Text variant="muted">
                          {t('speechAnalytics.operatorMetricProject', 'По проекту')} {Math.round(metric.avg)}
                        </Text>
                      ) : null}
                    </button>
                  );
                })}
              </VStack>
            </VStack>
          ) : null}
          {entry?.kind === 'call' ? (
            <div data-testid="dashboard-call-panel">
              <ConversationExpandedPanel
                conversationId={entry.recordingId}
                sourceKind={sourceKindOf(conversationQuery.data?.sourceKind)}
                audioUrl={conversationQuery.data?.audioUrl}
                rebuildInProgress={conversationQuery.data?.rebuildInProgress === true}
                summary={conversationQuery.data?.summary}
                metricResults={conversationQuery.data?.metricResults}
                transcriptText={conversationQuery.data?.transcriptText}
                turns={conversationQuery.data?.turns}
                runs={conversationQuery.data?.runs}
                isLoading={conversationQuery.isLoading}
                isError={conversationQuery.isError}
                onRetry={() => void conversationQuery.refetch()}
              />
            </div>
          ) : null}
          {entry && entry.kind !== 'operator' && entry.kind !== 'call' ? (
            loading ? (
              <VStack gap="8" max>
                <Skeleton className={cls.skeletonBlock} />
                <Skeleton className={cls.skeletonBlock} />
              </VStack>
            ) : calls.length === 0 ? (
              <Text variant="muted">{t('speechAnalytics.drillEmpty', 'В эту цифру не вошёл ни один разговор.')}</Text>
            ) : (
              <VStack gap="8" max>
                {calls.slice(
                  Math.min(page, Math.max(0, Math.ceil(calls.length / pageSize) - 1)) * pageSize,
                  Math.min(page, Math.max(0, Math.ceil(calls.length / pageSize) - 1)) * pageSize + pageSize,
                ).map((call) => {
                  const metricId = entry.kind === 'metric' ? entry.metricId : undefined;
                  const metric = metricId
                    ? call.metrics.find((row) => row.id === metricId)
                    : undefined;
                  const note = metric?.rationale
                    || call.metrics.find((row) => row.rationale)?.rationale;
                  return (
                    <button
                      key={call.id}
                      type="button"
                      className={cls.drillCard}
                      onClick={() => onOpenCall(call.id, operatorLabel(call.operatorName))}
                    >
                      <span className={cls.drillField}>
                        <Text variant="muted" className={cls.fieldLabel}>{t('speechAnalytics.colName', 'Имя')}</Text>
                        <Text className={cls.fieldValue}>{operatorLabel(call.operatorName)}</Text>
                      </span>
                      <span className={cls.drillField}>
                        <Text variant="muted" className={cls.fieldLabel}>{t('speechAnalytics.colScore', 'Оценка')}</Text>
                        <Text className={cls.scorePill}>
                          {call.score != null ? String(call.score) : '-'}
                        </Text>
                      </span>
                      <span className={cls.drillField}>
                        <Text variant="muted" className={cls.fieldLabel}>{t('speechAnalytics.colOccurred', 'Дата')}</Text>
                        <Text className={cls.fieldValue}>{call.dayLabel || '-'}</Text>
                      </span>
                      <span className={cls.drillField}>
                        <Text variant="muted" className={cls.fieldLabel}>{t('speechAnalytics.colCaller', 'Номер')}</Text>
                        <Text className={cls.fieldValue}>{call.callerPhone || '-'}</Text>
                      </span>
                      {metric ? (
                        <span className={cls.drillField}>
                          <Text variant="muted" className={cls.fieldLabel}>
                            {entry.kind === 'metric' ? entry.title : t('speechAnalytics.drillMetricValue', 'Значение')}
                          </Text>
                          <Text className={cls.fieldValue}>{String(metric.value)}</Text>
                        </span>
                      ) : null}
                      {note ? (
                        <span className={`${cls.drillField} ${cls.drillNote}`}>
                          <Text variant="muted" className={cls.fieldLabel}>{t('speechAnalytics.drillRationale', 'Обоснование')}</Text>
                          <Text className={cls.drillMeta}>{note}</Text>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                <DrillPager page={page} pageSize={pageSize} total={calls.length} onPageChange={setPage} />
              </VStack>
            )
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
});

function DrillPager({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount <= 1) return null;
  const current = Math.min(page, pageCount - 1);
  const from = current * pageSize + 1;
  const to = Math.min((current + 1) * pageSize, total);
  return (
    <HStack justify="between" align="center" max className={cls.drillPager}>
      <Text variant="muted">{from}–{to} из {total}</Text>
      <HStack gap="4" align="center">
        <Button type="button" variant="ghost" size="icon" aria-label="Первая" disabled={current === 0} onClick={() => onPageChange(0)}>
          <ChevronsLeft size={16} />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Назад" disabled={current === 0} onClick={() => onPageChange(current - 1)}>
          <ChevronLeft size={16} />
        </Button>
        <Text>{current + 1} / {pageCount}</Text>
        <Button type="button" variant="ghost" size="icon" aria-label="Вперёд" disabled={current >= pageCount - 1} onClick={() => onPageChange(current + 1)}>
          <ChevronRight size={16} />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Последняя" disabled={current >= pageCount - 1} onClick={() => onPageChange(pageCount - 1)}>
          <ChevronsRight size={16} />
        </Button>
      </HStack>
    </HStack>
  );
}

DashboardDrillSheet.displayName = 'DashboardDrillSheet';
