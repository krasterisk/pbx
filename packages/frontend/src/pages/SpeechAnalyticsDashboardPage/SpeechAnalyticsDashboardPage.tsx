import { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Loader2 } from 'lucide-react';
import { Button, Card, Label, Skeleton, Switch, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useGetSaCapturePolicyQuery,
  useGetSaDashboardQuery,
  useGetSaProjectsQuery,
  useRequestSaInsightsMutation,
  useSetSaCapturePolicyMutation,
} from '@/features/speechAnalytics/api/speechAnalyticsApi';
import cls from './SpeechAnalyticsDashboardPage.module.scss';

type InsightCard = {
  type: string;
  title: string;
  observation: string;
  recommendation: string;
  evidence?: {
    metric?: string;
    value?: number | null;
    journalFilter?: Record<string, string>;
  };
};

type InsightsPayload = {
  status: 'empty' | 'ok' | 'error';
  insights: InsightCard[];
  amount: string | null;
  currency: string | null;
  fromCache?: boolean;
};

const SENTIMENT_COLORS = [
  'var(--color-success)',
  'var(--color-muted-foreground)',
  'var(--color-destructive)',
];

export const SpeechAnalyticsDashboardPage = memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: projects = [] } = useGetSaProjectsQuery();
  const projectId = projects[0]?.id;
  const dashboardQuery = useGetSaDashboardQuery(
    { projectId: projectId || '00000000-0000-4000-8000-000000000000' },
    { skip: !projectId },
  );
  const { data: policy } = useGetSaCapturePolicyQuery();
  const [setPolicy] = useSetSaCapturePolicyMutation();
  const [requestInsights, insightsMutation] = useRequestSaInsightsMutation();

  const [localInsights, setLocalInsights] = useState<InsightsPayload | null>(null);
  const [insightsError, setInsightsError] = useState(false);

  const dashboard = dashboardQuery.data;
  const conversationCount = dashboard?.conversationCount ?? dashboard?.scored ?? 0;
  const isEmptyPeriod = !dashboardQuery.isLoading && conversationCount === 0;
  const belowMinInsights = conversationCount < 10;

  const displayedInsights = useMemo(() => {
    if (insightsMutation.data && typeof insightsMutation.data === 'object') {
      return insightsMutation.data as InsightsPayload;
    }
    return localInsights;
  }, [insightsMutation.data, localInsights]);

  const openJournalFilter = useCallback((filter: Record<string, string>) => {
    const params = new URLSearchParams(filter);
    navigate(`/speech-analytics/conversations?${params.toString()}`);
  }, [navigate]);

  const onGetInsights = useCallback(async () => {
    if (!projectId || belowMinInsights) return;
    setInsightsError(false);
    try {
      const result = await requestInsights({
        projectId,
        filterDigest: dashboard?.filterDigest,
        conversationCount,
      }).unwrap();
      setLocalInsights(result as InsightsPayload);
    } catch {
      setInsightsError(true);
    }
  }, [belowMinInsights, dashboard?.filterDigest, projectId, requestInsights]);

  const sentimentData = useMemo(() => {
    const s = dashboard?.sentiment;
    if (!s) return [];
    return [
      { name: 'positive', value: s.positive },
      { name: 'neutral', value: s.neutral },
      { name: 'negative', value: s.negative },
    ];
  }, [dashboard?.sentiment]);

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
              {t('speechAnalytics.rankingInsufficient')}: {dashboard?.ranking ?? '—'}
            </Text>
          </VStack>
        </HStack>
        <HStack gap="8" align="center">
          <Label htmlFor="sa-pause">{t('speechAnalytics.pauseNew')}</Label>
          <Switch
            id="sa-pause"
            checked={policy?.pause_new === true}
            onCheckedChange={(checked) => {
              void setPolicy({ pauseNew: checked });
            }}
          />
        </HStack>
      </Flex>

      {dashboardQuery.isLoading ? (
        <div className={cls.statGrid} data-testid="dashboard-skeleton">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className={cls.statCard}>
              <Skeleton className={cls.skeletonBlock} />
            </Card>
          ))}
        </div>
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

      {!dashboardQuery.isLoading && !isEmptyPeriod ? (
        <>
          <div className={cls.statGrid} data-testid="dashboard-stat-cards">
            <Card className={cls.statCard}>
              <Text variant="muted">{t('speechAnalytics.statConversations', 'Разговоры')}</Text>
              <Text variant="h2" as="p">{conversationCount}</Text>
            </Card>
            <Card className={cls.statCard}>
              <Text variant="muted">{t('speechAnalytics.statLowStt', 'Плохое распознавание')}</Text>
              <Text variant="h2" as="p">{dashboard?.lowSttCount ?? 0}</Text>
            </Card>
            <Card className={cls.statCard}>
              <Text variant="muted">{t('speechAnalytics.statCost', 'Стоимость')}</Text>
              <Text variant="h2" as="p" data-testid="dashboard-cost-total">
                {dashboard?.costTotal ?? '0'}
              </Text>
            </Card>
            <Card className={cls.statCard}>
              <Text variant="muted">{t('speechAnalytics.statSuccess', 'Успех')}</Text>
              <Text variant="h2" as="p">
                {dashboard?.successRate != null
                  ? `${Math.round(dashboard.successRate * 100)}%`
                  : '—'}
              </Text>
            </Card>
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
                <VStack gap="8" data-testid="sa-insights-error">
                  <Text>
                    {t(
                      'speechAnalytics.errorInsights',
                      'Не удалось получить инсайты. Повторите запрос.',
                    )}
                  </Text>
                  <Button type="button" variant="outline" onClick={() => { void onGetInsights(); }}>
                    {t('speechAnalytics.retry', 'Повторить')}
                  </Button>
                </VStack>
              ) : null}

              {displayedInsights?.amount != null ? (
                <VStack gap="4">
                  <Text>
                    {displayedInsights.amount} {displayedInsights.currency ?? ''}
                  </Text>
                  <Text variant="muted" data-testid="sa-insights-cost-label">
                    {t('speechAnalytics.costNotCharged', 'Посчитано, не списано')}
                  </Text>
                </VStack>
              ) : null}

              <div className={cls.insightGrid}>
                {(displayedInsights?.insights ?? []).map((insight, index) => (
                  <Card
                    key={`${insight.type}-${insight.title}-${index}`}
                    className={cls.insightCard}
                    data-testid={`sa-insight-${insight.type}`}
                    onClick={() => {
                      if (insight.evidence?.journalFilter) {
                        openJournalFilter(insight.evidence.journalFilter);
                      } else if (insight.evidence?.metric) {
                        openJournalFilter({ metric: insight.evidence.metric });
                      }
                    }}
                  >
                    <Text variant="muted">{insight.type}</Text>
                    <Text className={cls.insightTitle}>{insight.title}</Text>
                    <Text className={cls.insightBody}>{insight.observation}</Text>
                    <Text className={cls.insightBody}>{insight.recommendation}</Text>
                  </Card>
                ))}
              </div>
            </VStack>
          </Card>

          <Card className={cls.sectionCard} data-testid="sa-sentiment">
            <Text variant="h2" as="h2">{t('speechAnalytics.sentimentTitle', 'Настроение')}</Text>
            <div className={cls.chartWrap}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={sentimentData} dataKey="value" nameKey="name" outerRadius={80}>
                    {sentimentData.map((_, i) => (
                      <Cell key={i} fill={SENTIMENT_COLORS[i % SENTIMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className={cls.sectionCard} data-testid="sa-success">
            <Text variant="h2" as="h2">{t('speechAnalytics.successTitle', 'Успех')}</Text>
            <Text>
              {dashboard?.successRate != null
                ? `${Math.round(dashboard.successRate * 100)}%`
                : '—'}
            </Text>
          </Card>

          <Card className={cls.sectionCard} data-testid="sa-scales">
            <Text variant="h2" as="h2">{t('speechAnalytics.scalesTitle', 'Шкалы')}</Text>
            <VStack gap="8" max>
              {(dashboard?.scales ?? []).map((scale) => (
                <button
                  key={scale.key}
                  type="button"
                  className={cls.segmentBtn}
                  onClick={() => openJournalFilter({ scale: scale.key })}
                >
                  <Text>{scale.key}: {Math.round(scale.avg)}</Text>
                </button>
              ))}
            </VStack>
          </Card>

          <Card className={cls.sectionCard} data-testid="sa-custom-metrics">
            <Text variant="h2" as="h2">{t('speechAnalytics.customMetricsTitle', 'Свои метрики')}</Text>
            <VStack gap="8" max>
              {(dashboard?.customMetrics ?? []).map((metric) => (
                <button
                  key={metric.id}
                  type="button"
                  className={cls.segmentBtn}
                  onClick={() => openJournalFilter({ metric: metric.id })}
                >
                  <Text>{metric.label}: {Math.round(metric.avg)}</Text>
                </button>
              ))}
            </VStack>
          </Card>

          <Card className={cls.sectionCard} data-testid="sa-dynamics">
            <Text variant="h2" as="h2">{t('speechAnalytics.dynamicsTitle', 'Динамика')}</Text>
            <div className={cls.chartWrap}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dashboard?.dynamics ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" stroke="var(--color-muted-foreground)" />
                  <YAxis stroke="var(--color-muted-foreground)" />
                  <Tooltip />
                  <Bar
                    dataKey="avgScore"
                    fill="var(--color-primary)"
                    onClick={(entry) => {
                      const label = (entry as { label?: string })?.label;
                      if (label) openJournalFilter({ day: label });
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      ) : null}
    </VStack>
  );
});

SpeechAnalyticsDashboardPage.displayName = 'SpeechAnalyticsDashboardPage';
