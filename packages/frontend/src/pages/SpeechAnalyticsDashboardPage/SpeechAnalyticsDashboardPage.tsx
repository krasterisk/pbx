import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { BarChart3, ChevronRight, CircleCheck, Coins, Gauge, Loader2, Phone, Timer, TriangleAlert, Wallet } from 'lucide-react';
import {
  Button, Card, Label, PeriodNavigator, Select, Skeleton, Text,
} from '@/shared/ui';
import { currentPeriod, resolvePeriod, type PeriodSelection } from '@/shared/ui/PeriodNavigator';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { selectIsSuperAdmin } from '@/entities/User';
import {
  cabinetSaProjects,
  useGetSaDashboardQuery,
  useGetSaProjectsQuery,
  useRequestSaInsightsMutation,
  type SaProject,
} from '@/features/speechAnalytics/api/speechAnalyticsApi';
import type { DashboardDrill, DashboardSentiment } from '@/features/speechAnalytics/model/dashboardDrill';
import { DashboardDrillSheet, type DashboardPanelEntry } from './DashboardDrillSheet';
import cls from './SpeechAnalyticsDashboardPage.module.scss';

function scoreTone(value: number | null | undefined, high = 75, mid = 45): 'good' | 'mid' | 'bad' | 'neutral' {
  if (value == null || !Number.isFinite(value)) return 'neutral';
  if (value >= high) return 'good';
  if (value >= mid) return 'mid';
  return 'bad';
}

function autoTone(value: number | null | undefined): 'good' | 'mid' | 'bad' | 'neutral' {
  if (value != null && value <= 10) return scoreTone(value, 8, 5);
  return scoreTone(value);
}

function insightToneClass(type: string): string {
  if (type === 'strength') return 'insightStrength';
  if (type === 'gap') return 'insightGap';
  if (type === 'outlier') return 'insightOutlier';
  if (type === 'trend') return 'insightTrend';
  return 'insightQuality';
}

function insightKindLabel(type: string, translate: (key: string, fallback: string) => string): string {
  if (type === 'strength') return translate('speechAnalytics.insightKindStrength', 'Сильная сторона');
  if (type === 'gap') return translate('speechAnalytics.insightKindGap', 'Просадка');
  if (type === 'outlier') return translate('speechAnalytics.insightKindOutlier', 'Выброс');
  if (type === 'trend') return translate('speechAnalytics.insightKindTrend', 'Изменение');
  if (type === 'quality') return translate('speechAnalytics.insightKindQuality', 'Качество скрипта');
  return type;
}

type KpiVariant = 'primary' | 'success' | 'warning' | 'error';

/** Cards always shown, plus the superadmin STT card. */
const DASHBOARD_KPI_COUNT = 6;

function KpiBadge({
  title,
  value,
  hint,
  icon,
  variant = 'primary',
  onClick,
  testId,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
  variant?: KpiVariant;
  onClick?: () => void;
  testId?: string;
}) {
  const variantClass = {
    primary: cls.kpiPrimary,
    success: cls.kpiSuccess,
    warning: cls.kpiWarning,
    error: cls.kpiError,
  }[variant];
  const body = (
    <>
      <span className={cls.kpiMain}>
        <Text className={cls.kpiTitle}>{title}</Text>
        <Text as="p" className={cls.kpiValue} data-testid={testId}>{value}</Text>
        {hint ? <Text variant="muted" className={cls.kpiHint}>{hint}</Text> : null}
      </span>
      <span className={cls.kpiIcon}>{icon}</span>
    </>
  );
  if (!onClick) {
    return <div className={`${cls.kpi} ${variantClass}`}>{body}</div>;
  }
  return (
    <button type="button" className={`${cls.kpi} ${cls.kpiButton} ${variantClass}`} onClick={onClick}>
      {body}
    </button>
  );
}

function formatAht(ms: number | null | undefined, minute: string, second: string): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return `0 ${second}`;
  const totalSec = Math.round(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes > 0) return `${minutes} ${minute} ${seconds} ${second}`;
  return `${seconds} ${second}`;
}

function preferredProjectId(projects: SaProject[]): string {
  const withCalls = projects.find((project) => (project.recordingCount ?? 0) > 0);
  return (withCalls ?? projects[0])?.id ?? '';
}

type InsightCard = {
  type: string;
  title: string;
  observation: string;
  recommendation: string;
  evidence?: {
    metric?: string;
    value?: number | null;
    operators?: string[];
    recordingIds?: string[];
    journalFilter?: Record<string, string>;
  };
};

type InsightsPayload = {
  status: 'empty' | 'ok' | 'error';
  insights: InsightCard[];
  fromCache?: boolean;
};

export const SpeechAnalyticsDashboardPage = memo(() => {
  const { t } = useTranslation();
  const isSuperAdmin = useAppSelector(selectIsSuperAdmin);
  const projectsQuery = useGetSaProjectsQuery();
  const projectRows = projectsQuery.data ?? [];
  const projects = cabinetSaProjects(projectRows);
  const [projectId, setProjectId] = useState('');
  const [period, setPeriod] = useState<PeriodSelection>(() => currentPeriod('month'));
  const range = useMemo(() => resolvePeriod(period), [period]);
  useEffect(() => {
    if (!projects.length) return;
    setProjectId((current) => (
      current && projects.some((project) => project.id === current) ? current : preferredProjectId(projects)
    ));
  }, [projects]);
  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const dashboardQuery = useGetSaDashboardQuery(
    { projectId: projectId || '00000000-0000-4000-8000-000000000000', from: range.from, to: range.to },
    { skip: !projectId, refetchOnMountOrArgChange: true },
  );
  const [requestInsights, insightsMutation] = useRequestSaInsightsMutation();

  const [localInsights, setLocalInsights] = useState<InsightsPayload | null>(null);
  const [insightsScope, setInsightsScope] = useState('');
  const [insightsError, setInsightsError] = useState(false);
  const [panelStack, setPanelStack] = useState<DashboardPanelEntry[]>([]);
  useEffect(() => {
    setPanelStack([]);
  }, [projectId, range.from, range.to]);

  const dashboard = dashboardQuery.data;
  const dashboardLoadError = projectsQuery.isError || (Boolean(projectId) && dashboardQuery.isError);
  const conversationCount = dashboard?.conversationCount ?? dashboard?.scored ?? 0;
  const isEmptyPeriod = !dashboardQuery.isLoading
    && !dashboardLoadError
    && !dashboardQuery.isUninitialized
    && conversationCount === 0;
  const belowMinInsights = conversationCount < 10;

  const currentInsightsScope = `${projectId}|${range.from}|${range.to}`;
  const displayedInsights = useMemo(() => {
    if (insightsScope && insightsScope !== currentInsightsScope) return null;
    if (insightsMutation.data && typeof insightsMutation.data === 'object') {
      return insightsMutation.data as InsightsPayload;
    }
    return localInsights;
  }, [currentInsightsScope, insightsMutation.data, insightsScope, localInsights]);

  const openPanel = useCallback((entry: DashboardPanelEntry) => {
    if (!projectId) return;
    setPanelStack([entry]);
  }, [projectId]);
  const openList = useCallback((title: string, drill: DashboardDrill) => {
    if (!projectId) return;
    setPanelStack([{ kind: 'list', title, drill }]);
  }, [projectId]);
  const pushPanel = useCallback((entry: DashboardPanelEntry) => {
    setPanelStack((current) => [...current, entry]);
  }, []);

  const operatorLabel = useCallback((name: string | null | undefined) => (
    name?.trim() || t('speechAnalytics.operatorUnnamed', 'Без имени')
  ), [t]);

  const sentimentLabel = useCallback((sentiment: DashboardSentiment) => {
    if (sentiment === 'positive') return t('speechAnalytics.sentimentPositive', 'Позитивное');
    if (sentiment === 'negative') return t('speechAnalytics.sentimentNegative', 'Негативное');
    return t('speechAnalytics.sentimentNeutral', 'Нейтральное');
  }, [t]);

  const successSliceLabel = useCallback((name: 'yes' | 'no') => (
    name === 'yes'
      ? t('speechAnalytics.successYes', 'Успешные')
      : t('speechAnalytics.successNo', 'Без успеха')
  ), [t]);

  const onGetInsights = useCallback(async () => {
    if (!projectId || belowMinInsights) return;
    setInsightsError(false);
    try {
      const scope = `${projectId}|${range.from}|${range.to}`;
      const result = await requestInsights({
        projectId,
        from: range.from,
        to: range.to,
      }).unwrap();
      setInsightsScope(scope);
      setLocalInsights(result as InsightsPayload);
    } catch {
      setInsightsError(true);
    }
  }, [belowMinInsights, projectId, range.from, range.to, requestInsights]);

  const sentimentData = useMemo(() => {
    const s = dashboard?.sentiment;
    if (!s) return [];
    return [
      { name: 'positive' as const, value: s.positive },
      { name: 'neutral' as const, value: s.neutral },
      { name: 'negative' as const, value: s.negative },
    ].filter((slice) => slice.value > 0);
  }, [dashboard?.sentiment]);

  const successData = useMemo(() => {
    let yes = 0;
    let no = 0;
    for (const call of dashboard?.calls ?? []) {
      if (call.lowStt) continue;
      if (call.success === true) yes += 1;
      else if (call.success === false) no += 1;
    }
    return [
      { name: 'yes' as const, value: yes },
      { name: 'no' as const, value: no },
    ].filter((slice) => slice.value > 0);
  }, [dashboard?.calls]);

  const averageScore = dashboard?.averageScore ?? null;
  const successPct = dashboard?.successRate != null ? Math.round(dashboard.successRate * 100) : null;
  const toneClass = {
    good: cls.toneGood,
    mid: cls.toneMid,
    bad: cls.toneBad,
    neutral: cls.toneNeutral,
  };
  const successVariant: KpiVariant = successPct == null
    ? 'primary'
    : successPct >= 80 ? 'success' : successPct >= 50 ? 'warning' : 'error';
  const averageVariant: KpiVariant = (() => {
    const tone = autoTone(averageScore);
    if (tone === 'good') return 'success';
    if (tone === 'mid') return 'warning';
    if (tone === 'bad') return 'error';
    return 'primary';
  })();

  return (
    <VStack gap="32" max className={cls.page} data-testid="speech-analytics-dashboard">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <BarChart3 size={24} />
          </Flex>
          <VStack gap="4">
            <Text variant="h1" as="h1" className={cls.title}>
              {t('speechAnalytics.dashboard', 'Дашборд')}
            </Text>
            <Text variant="muted">
              {t(
                'speechAnalytics.dashboardSubtitle',
                'Сводка по разобранным разговорам за 30 дней',
              )}
            </Text>
          </VStack>
        </HStack>
        {projects.length > 1 || selectedProject ? (
          <HStack gap="8" align="center" className={cls.projectPicker}>
            <Label htmlFor={projects.length > 1 ? 'sa-dashboard-project' : undefined}>
              {t('speechAnalytics.dashboardProject', 'Проект')}
            </Label>
            {projects.length > 1 ? (
              <Select
                id="sa-dashboard-project"
                className={cls.projectSelect}
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </Select>
            ) : (
              <Text data-testid="dashboard-project-name" className={cls.projectName}>
                {selectedProject?.name}
              </Text>
            )}
          </HStack>
        ) : null}
      </Flex>
      <PeriodNavigator value={period} onChange={setPeriod} />
      {dashboardLoadError ? <QueryErrorState message={t('common.queryLoadError')} onRetry={() => void (projectsQuery.isError ? projectsQuery.refetch() : dashboardQuery.refetch())} data-testid="dashboard-error" /> : null}

      {projectsQuery.isLoading || (Boolean(projectId) && dashboardQuery.isLoading) ? (
        <div className={cls.statGrid} data-testid="dashboard-skeleton">
          {Array.from({ length: DASHBOARD_KPI_COUNT + (isSuperAdmin ? 1 : 0) }).map((_, i) => (
            <Card key={i} className={cls.kpi}>
              <Skeleton className={cls.skeletonBlock} />
            </Card>
          ))}
        </div>
      ) : null}

      {!dashboardLoadError && !projectsQuery.isLoading && !projectId ? (
        <VStack gap="12" max className={cls.empty} data-testid="dashboard-empty">
          <Text variant="h2" as="h2">
            {t('speechAnalytics.emptyDashboardHeading', 'Недостаточно данных')}
          </Text>
          <Text variant="muted">
            {t(
              'speechAnalytics.emptyDashboardBody',
              'Нужны разобранные разговоры за выбранный период. Откройте журнал или загрузите записи.',
            )}
          </Text>
        </VStack>
      ) : null}

      {isEmptyPeriod ? (
        <VStack gap="12" max className={cls.empty} data-testid="dashboard-empty">
          <Text variant="h2" as="h2">
            {t('speechAnalytics.emptyDashboardHeading', 'Недостаточно данных')}
          </Text>
          <Text variant="muted">
            {t(
              'speechAnalytics.emptyDashboardBody',
              'Нужны разобранные разговоры за выбранный период. Откройте журнал или загрузите записи.',
            )}
          </Text>
        </VStack>
      ) : null}

      {!dashboardLoadError && Boolean(projectId) && !dashboardQuery.isLoading && !dashboardQuery.isUninitialized && !isEmptyPeriod ? (
        <>
          <div className={cls.statGrid} data-testid="dashboard-stat-cards">
            <KpiBadge
              title={t('speechAnalytics.statTotalCalls', 'Всего звонков')}
              value={conversationCount}
              hint={t('speechAnalytics.statTotalCallsHint', 'Количество разобранных звонков')}
              icon={<Phone size={22} />}
              onClick={() => openList(t('speechAnalytics.statTotalCalls', 'Всего звонков'), { type: 'all' })}
            />
            <KpiBadge
              title={t('speechAnalytics.statAverageScore', 'Средняя оценка')}
              value={averageScore != null ? averageScore.toFixed(1) : '-'}
              icon={<Gauge size={22} />}
              variant={averageVariant}
            />
            <KpiBadge
              title={t('speechAnalytics.statAht', 'AHT')}
              value={formatAht(
                dashboard?.averageDurationMs,
                t('speechAnalytics.unitMin', 'мин'),
                t('speechAnalytics.unitSec', 'сек'),
              )}
              hint={t('speechAnalytics.statAhtHint', 'Среднее время разговора')}
              icon={<Timer size={22} />}
            />
            <KpiBadge
              title={t('speechAnalytics.statSuccessCalls', 'Успешных звонков')}
              value={successPct != null ? `${successPct}%` : '-'}
              icon={<CircleCheck size={22} />}
              variant={successVariant}
              onClick={() => openList(t('speechAnalytics.statSuccessCalls', 'Успешных звонков'), { type: 'success' })}
            />
            <KpiBadge
              title={t('speechAnalytics.statAnalyticsCost', 'Стоимость аналитики')}
              value={dashboard?.costTotal ?? '0'}
              hint={t('speechAnalytics.statAnalyticsCostHint', 'Суммарные расходы за период')}
              icon={<Wallet size={22} />}
              testId="dashboard-cost-total"
              onClick={() => openList(t('speechAnalytics.statAnalyticsCost', 'Стоимость аналитики'), { type: 'cost' })}
            />
            <KpiBadge
              title={t('speechAnalytics.statAverageCost', 'Средняя стоимость')}
              value={dashboard?.averageCost ?? '0'}
              hint={t('speechAnalytics.statAverageCostHint', 'Средняя стоимость разговора')}
              icon={<Coins size={22} />}
              onClick={() => openList(t('speechAnalytics.statAverageCost', 'Средняя стоимость'), { type: 'cost' })}
            />
            {isSuperAdmin ? (
              <KpiBadge
                title={t('speechAnalytics.statLowStt', 'Плохое распознавание')}
                value={dashboard?.lowSttCount ?? 0}
                icon={<TriangleAlert size={22} />}
                variant={(dashboard?.lowSttCount ?? 0) > 0 ? 'error' : 'primary'}
                onClick={() => openList(t('speechAnalytics.statLowStt', 'Плохое распознавание'), { type: 'lowStt' })}
              />
            ) : null}
          </div>

          <Card className={cls.sectionCard} data-testid="sa-insights-block">
            <VStack gap="16" max>
              <HStack gap="12" align="center" justify="between" max className={cls.insightsHeader}>
                <Text variant="h2" as="h2">
                  {t('speechAnalytics.insightsTitle', 'Инсайты')}
                </Text>
                <Button
                  type="button"
                  data-testid="sa-get-insights"
                  disabled={insightsMutation.isLoading}
                  aria-busy={insightsMutation.isLoading}
                  onClick={() => {
                    void onGetInsights();
                  }}
                >
                  {insightsMutation.isLoading ? (
                    <HStack gap="8" align="center">
                      <span data-testid="sa-insights-busy" className={cls.busyWrap}>
                        <Loader2 size={16} className={cls.spinner} />
                      </span>
                      <span>{t('speechAnalytics.getInsights', 'Получить инсайты')}</span>
                    </HStack>
                  ) : (
                    t('speechAnalytics.getInsights', 'Получить инсайты')
                  )}
                </Button>
              </HStack>

              {belowMinInsights ? (
                <Text data-testid="sa-insights-empty">
                  {t(
                    'speechAnalytics.emptyInsights',
                    'Для инсайтов нужно минимум 10 разговоров',
                  )}
                </Text>
              ) : null}

              {insightsError ? (
                <QueryErrorState message={t(
                      'speechAnalytics.errorInsights',
                      'Не удалось получить инсайты. Повторите запрос.',
                    )} onRetry={() => { void onGetInsights(); }} retryLabel={t('speechAnalytics.retry', 'Повторить')} data-testid="sa-insights-error" />
              ) : null}

              <div className={cls.insightGrid}>
                {(displayedInsights?.insights ?? []).map((insight, index) => (
                  <Card
                    key={`${insight.type}-${insight.title}-${index}`}
                    className={`${cls.insightCard} ${cls[insightToneClass(insight.type)] ?? ''}`}
                    data-testid={`sa-insight-${insight.type}`}
                    onClick={() => {
                      const recordingIds = insight.evidence?.recordingIds?.filter(Boolean) ?? [];
                      if (recordingIds.length > 0) {
                        openList(insight.title, { type: 'recordings', recordingIds });
                        return;
                      }
                      if (insight.evidence?.metric) {
                        const insightType = insight.type;
                        openList(insight.title, {
                          type: insightType === 'gap' || insightType === 'outlier' || insightType === 'quality'
                            ? 'exemplars'
                            : 'metric',
                          metricId: insight.evidence.metric,
                          insightType,
                        });
                      }
                    }}
                  >
                    <span className={cls.insightKind}>{insightKindLabel(insight.type, t)}</span>
                    <div className={cls.insightMain}>
                      <Text className={cls.insightTitle}>{insight.title}</Text>
                      <div className={cls.insightColumns}>
                        <div className={cls.insightColumn}>
                          <span className={cls.insightCaption}>{t('speechAnalytics.insightObservation', 'Что видно')}</span>
                          <Text className={cls.insightBody}>{insight.observation}</Text>
                        </div>
                        <div className={`${cls.insightColumn} ${cls.insightAdvice}`}>
                          <span className={cls.insightCaption}>{t('speechAnalytics.insightAction', 'Что сделать')}</span>
                          <Text className={cls.insightBody}>{insight.recommendation}</Text>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </VStack>
          </Card>

          <div className={cls.chartsRow}>
          <Card className={cls.sectionCard} data-testid="sa-sentiment">
            <Text variant="h2" as="h2">{t('speechAnalytics.sentimentTitle', 'Настроение')}</Text>
            <Text variant="muted" className={cls.sectionHint}>{t('speechAnalytics.chartClickHint', 'Нажмите на сектор, чтобы увидеть звонки')}</Text>
            {sentimentData.length === 0 ? (
              <Text variant="muted">-</Text>
            ) : (
            <>
            <div className={cls.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="92%"
                    onClick={(entry) => {
                      const name = (entry as { name?: DashboardSentiment }).name;
                      if (name !== 'positive' && name !== 'neutral' && name !== 'negative') return;
                      openList(sentimentLabel(name), { type: 'sentiment', sentiment: name });
                    }}
                  >
                    {sentimentData.map((slice) => (
                      <Cell
                        key={slice.name}
                        fill={slice.name === 'positive' ? '#22c55e' : slice.name === 'negative' ? '#ef4444' : '#f59e0b'}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, _name, item) => {
                    const key = (item?.payload as { name?: DashboardSentiment } | undefined)?.name;
                    return [value, key ? sentimentLabel(key) : ''];
                  }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className={cls.legend}>
              {sentimentData.map((slice) => (
                <li key={slice.name}>
                  <button
                    type="button"
                    className={cls.legendItem}
                    onClick={() => openList(sentimentLabel(slice.name), { type: 'sentiment', sentiment: slice.name })}
                  >
                    <span
                      className={cls.legendSwatch}
                      style={{ background: slice.name === 'positive' ? '#22c55e' : slice.name === 'negative' ? '#ef4444' : '#f59e0b' }}
                    />
                    <Text>{sentimentLabel(slice.name)}: {slice.value}</Text>
                  </button>
                </li>
              ))}
            </ul>
            </>
            )}
          </Card>

          <Card className={cls.sectionCard} data-testid="sa-success">
            <Text variant="h2" as="h2">{t('speechAnalytics.successTitle', 'Успех')}</Text>
            <Text variant="muted" className={cls.sectionHint}>{t('speechAnalytics.chartClickHint', 'Нажмите на сектор, чтобы увидеть звонки')}</Text>
            {successData.length === 0 ? (
              <Text>
                {dashboard?.successRate != null
                  ? `${Math.round(dashboard.successRate * 100)}%`
                  : '-'}
              </Text>
            ) : (
            <>
            <div className={cls.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={successData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="92%"
                    onClick={(entry) => {
                      const name = (entry as { name?: 'yes' | 'no' }).name;
                      if (name !== 'yes' && name !== 'no') return;
                      openList(successSliceLabel(name), { type: 'success', success: name === 'yes' });
                    }}
                  >
                    {successData.map((slice) => (
                      <Cell key={slice.name} fill={slice.name === 'yes' ? '#22c55e' : '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, _name, item) => {
                    const key = (item?.payload as { name?: 'yes' | 'no' } | undefined)?.name;
                    return [value, key === 'yes' || key === 'no' ? successSliceLabel(key) : ''];
                  }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className={cls.legend}>
              {successData.map((slice) => {
                const title = successSliceLabel(slice.name);
                return (
                  <li key={slice.name}>
                    <button
                      type="button"
                      className={cls.legendItem}
                      onClick={() => openList(title, { type: 'success', success: slice.name === 'yes' })}
                    >
                      <span
                        className={cls.legendSwatch}
                        style={{ background: slice.name === 'yes' ? '#22c55e' : '#64748b' }}
                      />
                      <Text>{title}: {slice.value}</Text>
                    </button>
                  </li>
                );
              })}
            </ul>
            </>
            )}
          </Card>
          </div>

          <Card className={cls.sectionCard} data-testid="sa-metrics">
            <Text variant="h2" as="h2">{t('speechAnalytics.metricsTitle', 'Метрики')}</Text>
            <Text variant="muted" className={cls.sectionHint}>{t('speechAnalytics.metricsHint', 'Нажмите на метрику, чтобы открыть звонки')}</Text>
            <VStack gap="8" max>
              {(dashboard?.metrics ?? []).map((metric) => {
                const tone = autoTone(metric.avg);
                const width = Math.max(0, Math.min(100, metric.avg <= 10 ? metric.avg * 10 : metric.avg));
                return (
                  <button
                    key={metric.id}
                    type="button"
                    className={cls.metricBar}
                    onClick={() => openList(metric.label || metric.id, { type: 'metric', metricId: metric.id })}
                  >
                    <span className={cls.metricBarHead}>
                      <Text className={cls.metricName}>{metric.label || metric.id}</Text>
                      <Text className={`${cls.metricBarValue} ${toneClass[tone]}`}>{Math.round(metric.avg)}</Text>
                    </span>
                    <span className={cls.metricTrack}>
                      <span className={`${cls.metricFill} ${toneClass[tone]}`} style={{ width: `${width}%` }} />
                    </span>
                  </button>
                );
              })}
            </VStack>
          </Card>

          <Card className={cls.sectionCard} data-testid="sa-topics">
            <Text variant="h2" as="h2">{t('speechAnalytics.colTopics', 'Темы')}</Text>
            <Text variant="muted" className={cls.sectionHint}>{t('speechAnalytics.topicsHint', 'Нажмите на тему, чтобы увидеть её звонки')}</Text>
            <div className={cls.topicGrid}>
              {(dashboard?.topics ?? []).map((topic) => (
                <button
                  key={topic.label}
                  type="button"
                  className={cls.topicCard}
                  onClick={() => openList(topic.label, { type: 'topic', topic: topic.label })}
                >
                  <span className={cls.topicHead}>
                    <Text className={cls.metricName}>{topic.label}</Text>
                    <ChevronRight size={16} className={cls.topicChevron} />
                  </span>
                  <Text className={cls.topicCount}>{topic.count}</Text>
                  <Text variant="muted" className={cls.fieldLabel}>{t('speechAnalytics.statConversations', 'Разговоры')}</Text>
                </button>
              ))}
            </div>
          </Card>

          <Card className={cls.sectionCard} data-testid="sa-operators">
            <VStack gap="8" max>
              <Text variant="h2" as="h2">{t('speechAnalytics.operatorRanking', 'Рейтинг операторов')}</Text>
              {dashboard?.ranking === 'insufficient_sample' ? (
                <Text variant="muted">
                  {t(
                    'speechAnalytics.rankingInsufficient',
                    'Рейтинг операторов появится после 20 разговоров.',
                  )}
                </Text>
              ) : null}
              <div className={cls.rankTable}>
                <div className={cls.rankHead}>
                  <Text variant="muted">{t('speechAnalytics.colName', 'Имя')}</Text>
                  <Text variant="muted">{t('speechAnalytics.statConversations', 'Разговоры')}</Text>
                  <Text variant="muted">{t('speechAnalytics.colScore', 'Оценка')}</Text>
                  <Text variant="muted">{t('speechAnalytics.statSuccess', 'Успех')}</Text>
                  <Text variant="muted">{t('speechAnalytics.colNegative', 'Негатив')}</Text>
                </div>
                {(dashboard?.operators ?? []).map((operator) => (
                  <button
                    key={operator.operatorName ?? 'unnamed'}
                    type="button"
                    className={cls.rankRow}
                    onClick={() => openPanel({
                      kind: 'operator',
                      operatorName: operator.operatorName,
                      title: operatorLabel(operator.operatorName),
                    })}
                  >
                    <span className={cls.rankCell}>
                      <Text variant="muted" className={cls.rankLabel}>{t('speechAnalytics.colName', 'Имя')}</Text>
                      <Text className={cls.metricName}>{operatorLabel(operator.operatorName)}</Text>
                    </span>
                    <span className={cls.rankCell}>
                      <Text variant="muted" className={cls.rankLabel}>{t('speechAnalytics.statConversations', 'Разговоры')}</Text>
                      <Text variant="muted">{operator.callsCount}</Text>
                    </span>
                    <span className={cls.rankCell}>
                      <Text variant="muted" className={cls.rankLabel}>{t('speechAnalytics.colScore', 'Оценка')}</Text>
                      <Text className={`${cls.scorePill} ${toneClass[autoTone(operator.averageScore)]}`}>
                        {operator.averageScore != null ? operator.averageScore.toFixed(1) : '-'}
                      </Text>
                    </span>
                    <span className={cls.rankCell}>
                      <Text variant="muted" className={cls.rankLabel}>{t('speechAnalytics.statSuccess', 'Успех')}</Text>
                      <Text className={`${cls.fieldValue} ${toneClass[scoreTone(operator.successRate != null ? operator.successRate * 100 : null, 80, 50)]}`}>
                        {operator.successRate != null ? `${Math.round(operator.successRate * 100)}%` : '-'}
                      </Text>
                    </span>
                    <span className={cls.rankCell}>
                      <Text variant="muted" className={cls.rankLabel}>{t('speechAnalytics.colNegative', 'Негатив')}</Text>
                      <Text className={`${cls.fieldValue} ${toneClass[scoreTone(operator.negativeRate != null ? 100 - operator.negativeRate * 100 : null, 80, 50)]}`}>
                        {operator.negativeRate != null ? `${Math.round(operator.negativeRate * 100)}%` : '-'}
                      </Text>
                    </span>
                  </button>
                ))}
              </div>
            </VStack>
          </Card>
        </>
      ) : null}

      <DashboardDrillSheet
        projectId={projectId}
        stack={panelStack}
        operators={dashboard?.operators ?? []}
        calls={dashboard?.calls ?? []}
        metrics={(dashboard?.metrics ?? []).map((metric) => ({
          id: metric.id,
          label: metric.label || metric.id,
          avg: metric.avg,
        }))}
        onClose={() => setPanelStack([])}
        onBack={() => setPanelStack((current) => current.slice(0, -1))}
        onOpenCall={(recordingId, title) => pushPanel({ kind: 'call', recordingId, title })}
        from={range.from}
        to={range.to}
        onOpenMetric={(metricId, title, operatorName) => pushPanel({
          kind: 'metric',
          metricId,
          title,
          operatorName,
        })}
      />
    </VStack>
  );
});

SpeechAnalyticsDashboardPage.displayName = 'SpeechAnalyticsDashboardPage';
