import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import type { CcDashboardPreset, CcDashboardSection } from '@krasterisk/shared';
import type { CcReportId } from '@/shared/api/endpoints/callCenterReportsApi';
import {
  Button,
  Flex,
  HStack,
  Input,
  MultiSelect,
  SegmentedControl,
  Skeleton,
  Switch,
  Text,
  VStack,
} from '@/shared/ui';
import { useGetCcDashboardOverviewQuery } from '@/shared/api/endpoints/callCenterDashboardApi';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import { useGetTenantSettingsQuery } from '@/shared/api/endpoints/callCenterApi';
import { DashboardSource } from '@/features/dashboard/ui/DashboardSource';
import { CcPageHeader } from '@/features/callcenter/ui/CcPageHeader';
import { resolveKpiThresholds } from '@/features/callcenter/lib/kpiThresholds';
import { IntradayChart } from '@/features/callcenter/ui/IntradayChart';
import { buildReportsLink } from '@/features/callcenter/lib/reportsUrlState';
import { buildSupervisorLink, SUPERVISOR_PATH } from '@/features/callcenter/lib/supervisorUrlState';
import { formatCcDateRange } from '@/features/callcenter/lib/ccFormat';
import { toBadgeSource, toChartPoints, sparkValues, worstSource } from '../../lib/dashboardView';
import { buildKpiCards, formatDelta, type KpiCardId } from '../../lib/kpiCards';
import { CC_DASHBOARD_PRESETS, useCcDashboardParams } from '../../model/useCcDashboardParams';
import { CcKpiCard } from '../CcKpiCard';
import { CcLossesPanel } from '../CcLossesPanel';
import { CcNowStrip } from '../CcNowStrip';
import { CcPausesPanel } from '../CcPausesPanel';
import { CcOperatorsPanel } from '../CcOperatorsPanel';
import { CcQueueTable } from '../CcQueueTable';
import styles from './CcDashboard.module.scss';

/** One request per minute while visible - the backend refreshes today's buckets at the same pace. */
export const CC_DASHBOARD_POLL_MS = 60_000;

const KPI_TITLES: Record<KpiCardId, [string, string]> = {
  offered: ['callcenter.dashboard.kpi.offered', 'Offered'],
  handled: ['callcenter.dashboard.kpi.handled', 'Handled'],
  sla: ['callcenter.dashboard.kpi.sla', 'Service level'],
  abandon: ['callcenter.dashboard.kpi.abandon', 'Abandon rate'],
  asa: ['callcenter.dashboard.kpi.asa', 'Avg. answer time'],
  aht: ['callcenter.dashboard.kpi.aht', 'Avg. handle time'],
};

const KPI_FORMULAS: Record<KpiCardId, [string, string]> = {
  offered: ['callcenter.dashboard.kpi.formulaOffered', 'Unique inbound queue calls (ring-no-answer attempts are not counted twice)'],
  handled: ['callcenter.dashboard.kpi.formulaHandled', 'Answered calls plus calls transferred after an operator answered'],
  sla: ['callcenter.dashboard.kpi.formulaSla', 'Handled within queue service level threshold ÷ (offered − short abandons)'],
  abandon: ['callcenter.dashboard.kpi.formulaAbandon', 'Caller abandons after short_abandon_sec ÷ (offered − short abandons)'],
  asa: ['callcenter.dashboard.kpi.formulaAsa', 'Average wait time of handled calls'],
  aht: ['callcenter.dashboard.kpi.formulaAht', '(Talk time including hold + wrap-up) ÷ handled calls'],
};

/** A section that has no data says why, instead of showing zeros. */
function SectionNote({ section, testId }: { section: CcDashboardSection<unknown>; testId: string }) {
  const { t } = useTranslation();
  const key = section.source.state === 'notConfigured' ? 'notConfigured' : 'unavailable';
  return (
    <Text variant="muted" data-testid={testId}>
      {key === 'notConfigured'
        ? t('callcenter.dashboard.state.notConfigured', 'This section is not configured')
        : t('callcenter.dashboard.state.sectionError', 'This section is temporarily unavailable')}
      {key === 'notConfigured' && (
        <>
          {' '}
          <Link to="/callcenter/settings/overview" data-testid={`${testId}-setup`}>
            {t('callcenter.dashboard.state.setup', 'Open settings')}
          </Link>
        </>
      )}
    </Text>
  );
}

/**
 * Call-center management dashboard (cc-analytics E3): how the center worked over a period, where
 * it dipped, and where to dig. Read-only - every card drills into a report or the live cockpit.
 */
export function CcDashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { params, ready, setPeriod, setRange, setCompare, setQueues } = useCcDashboardParams();
  const locale: 'ru' | 'en' = i18n?.language?.startsWith('en') ? 'en' : 'ru';
  const browserTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return undefined;
    }
  }, []);

  const { data: tenantSettings } = useGetTenantSettingsQuery();
  const thresholds = useMemo(
    () => resolveKpiThresholds(tenantSettings?.alert_thresholds),
    [tenantSettings?.alert_thresholds],
  );

  const { data, isLoading, isError, refetch } = useGetCcDashboardOverviewQuery(params, {
    skip: !ready,
    pollingInterval: params.period === 'yesterday' ? 0 : CC_DASHBOARD_POLL_MS,
    skipPollingIfUnfocused: true,
  });

  const periodOptions = CC_DASHBOARD_PRESETS.map((value) => ({
    value,
    label: t(`callcenter.dashboard.period.${value}`, value),
  }));

  const queueOptions = useMemo(() => {
    const names = new Set([...(data?.availableQueues ?? []), ...params.queues]);
    return [...names].sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: queueDisplayName(name, []) }));
  }, [data?.availableQueues, params.queues]);

  const kpiCards = useMemo(
    () => (data?.service.data ? buildKpiCards(data.service.data, thresholds) : []),
    [data?.service.data, thresholds],
  );
  const chartPoints = useMemo(
    () => (data?.series.data ? toChartPoints(data.series.data, data.period.timezone) : []),
    [data?.series.data, data?.period.timezone],
  );

  /** Reports open on the same days; the queue filter is passed on only when it is a single queue. */
  const openReport = (reportId: CcReportId, queueName?: string, agentInterface?: string) => {
    const period = data?.period;
    if (!period) return;
    navigate(
      buildReportsLink({
        reportId,
        dateFrom: period.dateFrom,
        dateTo: period.dateTo,
        queueName: queueName ?? (params.queues.length === 1 ? params.queues[0] : undefined),
        agentInterface,
      }),
    );
  };

  const pointsUnit = t('callcenter.dashboard.unit.points', 'pp');
  const sources = data
    ? [data.service.source, data.series.source, data.queueTable.source, data.losses.source, data.pauses.source, data.operators.source, ...(data.now ? [data.now.source] : [])]
    : [];
  const summary = worstSource(sources);
  const hasTraffic = (data?.service.data?.current.offered ?? 0) > 0;

  const rangeLabel = data
    ? formatCcDateRange(data.period.dateFrom, data.period.dateTo, locale)
    : '';
  const showTz = Boolean(data?.period.timezone && data.period.timezone !== browserTz);

  const renderTargetText = (card: (typeof kpiCards)[number]): string | undefined => {
    if (!card.targetValue) return undefined;
    if (card.id === 'sla') {
      return t('callcenter.dashboard.kpi.targetSla', { defaultValue: 'Goal ≥ {{v}}', v: card.targetValue });
    }
    if (card.id === 'abandon') {
      return t('callcenter.dashboard.kpi.targetAbandon', { defaultValue: 'Goal ≤ {{v}}', v: card.targetValue });
    }
    if (card.id === 'asa') {
      return t('callcenter.dashboard.kpi.targetAsa', { defaultValue: 'Limit ≤ {{v}}', v: card.targetValue });
    }
    return undefined;
  };

  return (
    <VStack gap="16" max className={styles.page} data-testid="cc-dashboard">
      <CcPageHeader
        title={t('callcenter.dashboard.title', 'Call center dashboard')}
        context={
          data ? (
            <Text variant="xs" data-testid="cc-dashboard-range">
              {rangeLabel}
              {showTz ? ` · ${t('callcenter.dashboard.timezone', { defaultValue: 'Time zone: {{tz}}', tz: data.period.timezone })}` : ''}
            </Text>
          ) : undefined
        }
        actions={summary ? <DashboardSource source={toBadgeSource(summary)} timezone={data?.period.timezone} /> : undefined}
      />

      <VStack gap="12" className={styles.controls} data-testid="cc-dashboard-controls">
        <Flex align="center" gap="12" wrap="wrap">
          <SegmentedControl<CcDashboardPreset>
            options={periodOptions}
            value={params.period}
            onChange={setPeriod}
            ariaLabel={t('callcenter.dashboard.periodLabel', 'Period')}
            className={styles.periodTabs}
          />
          <HStack gap="8" align="center">
            <Switch
              id="cc-dashboard-compare"
              checked={params.compare}
              onCheckedChange={setCompare}
              aria-label={t('callcenter.dashboard.compare', 'Compare with the previous period')}
              data-testid="cc-dashboard-compare"
            />
            <Text as="span" variant="small">{t('callcenter.dashboard.compare', 'Compare with the previous period')}</Text>
          </HStack>
          <HStack className={styles.queueFilter}>
            <MultiSelect
              value={params.queues}
              onChange={setQueues}
              options={queueOptions}
              placeholder={t('callcenter.dashboard.allQueues', 'All queues')}
            />
          </HStack>
        </Flex>
        {params.period === 'custom' && (
          <Flex align="center" gap="8" wrap="wrap" data-testid="cc-dashboard-custom">
            <Flex className={styles.dateField}>
              <Input
                type="date"
                value={params.from ?? ''}
                max={params.to}
                onChange={(e) => setRange(e.target.value || undefined, params.to)}
                aria-label={t('callcenter.dashboard.from', 'From')}
                data-testid="cc-dashboard-from"
              />
            </Flex>
            <Flex className={styles.dateField}>
              <Input
                type="date"
                value={params.to ?? ''}
                min={params.from}
                onChange={(e) => setRange(params.from, e.target.value || undefined)}
                aria-label={t('callcenter.dashboard.to', 'To')}
                data-testid="cc-dashboard-to"
              />
            </Flex>
          </Flex>
        )}
      </VStack>

      {!ready && (
        <Text variant="muted" data-testid="cc-dashboard-incomplete">
          {t('callcenter.dashboard.state.pickDates', 'Pick both dates of the period')}
        </Text>
      )}

      {ready && isLoading && (
        <VStack gap="12" data-testid="cc-dashboard-loading">
          <Skeleton className="h-[72px] w-full" />
          <Skeleton className="h-[120px] w-full" />
          <Skeleton className="h-[260px] w-full" />
        </VStack>
      )}

      {ready && isError && !data && (
        <Flex align="center" gap="12" wrap="wrap" data-testid="cc-dashboard-error">
          <Text variant="error">{t('callcenter.dashboard.state.error', 'Could not load the dashboard')}</Text>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t('common.retry', 'Retry')}
          </Button>
        </Flex>
      )}

      {data && (
        <>
          {data.now && (
            <VStack gap="8">
              <DashboardSource source={toBadgeSource(data.now.source)} timezone={data.period.timezone} />
              <Text variant="large">{t('callcenter.dashboard.now.title', 'Right now')}</Text>
              {data.now.data ? (
                <CcNowStrip now={data.now.data} thresholds={thresholds} onOpen={() => navigate(SUPERVISOR_PATH)} />
              ) : (
                <SectionNote section={data.now} testId="cc-now-note" />
              )}
            </VStack>
          )}

          <VStack gap="8" id="cc-sec-service">
            <DashboardSource source={toBadgeSource(data.service.source)} timezone={data.period.timezone} />
            <Text variant="large">{t('callcenter.dashboard.service.title', 'Service')}</Text>
            {data.service.data ? (
              <Flex wrap="wrap" gap="12" align="stretch" className={styles.kpiGrid} data-testid="cc-kpi-grid">
                {kpiCards.map((card) => {
                  const [titleKey, titleDefault] = KPI_TITLES[card.id];
                  const [formulaKey, formulaDefault] = KPI_FORMULAS[card.id];
                  return (
                    <CcKpiCard
                      key={card.id}
                      testId={`cc-kpi-${card.id}`}
                      title={t(titleKey, titleDefault)}
                      value={card.value}
                      tone={card.tone}
                      targetText={renderTargetText(card)}
                      formulaHint={t(formulaKey, formulaDefault)}
                      note={
                        card.shortAbandoned > 0
                          ? t('callcenter.dashboard.kpi.shortNote', {
                              defaultValue: 'Short abandons not counted: {{n}}',
                              n: card.shortAbandoned,
                            })
                          : undefined
                      }
                      delta={card.delta}
                      deltaText={card.delta ? formatDelta(card.delta, card.deltaKind, pointsUnit) : ''}
                      noComparisonText={
                        params.compare
                          ? t('callcenter.dashboard.kpi.noData', 'No data to compare')
                          : t('callcenter.dashboard.kpi.compareOff', 'Comparison is off')
                      }
                      spark={sparkValues(data.series.data, card.spark)}
                      onOpen={() => openReport(card.reportId)}
                    />
                  );
                })}
              </Flex>
            ) : (
              <SectionNote section={data.service} testId="cc-service-note" />
            )}
          </VStack>

          <VStack gap="8" id="cc-sec-chart" className={styles.panel}>
            <DashboardSource source={toBadgeSource(data.series.source)} timezone={data.period.timezone} />
            <Text variant="large">
              {data.series.data?.granularity === 'day'
                ? t('callcenter.dashboard.chart.byDay', 'By day')
                : t('callcenter.dashboard.chart.byTime', 'By time of day')}
            </Text>
            {data.series.data && hasTraffic ? (
              <IntradayChart
                points={chartPoints}
                showPrevious={params.compare && data.series.data.previous !== null}
                labels={{
                  chart: t('callcenter.supervisor.intraday.chartLabel', 'Calls and service level by time of day'),
                  answered: t('callcenter.supervisor.intraday.answered', 'Handled'),
                  abandoned: t('callcenter.supervisor.intraday.abandoned', 'Abandoned'),
                  shortAbandoned: t('callcenter.supervisor.intraday.shortAbandoned', 'Short abandon'),
                  sla:
                    data.series.data.granularity === 'day'
                      ? t('callcenter.dashboard.chart.dailySla', 'Service level (by day)')
                      : t('callcenter.supervisor.intraday.sla', 'Service level (running)'),
                  previousOffered: t('callcenter.dashboard.chart.previousOffered', 'Offered, previous period'),
                }}
              />
            ) : data.series.data ? (
              <Text variant="muted" data-testid="cc-chart-empty">
                {t('callcenter.dashboard.state.empty', 'No queue calls in this period')}
              </Text>
            ) : (
              <SectionNote section={data.series} testId="cc-series-note" />
            )}
          </VStack>

          <VStack gap="8" id="cc-sec-queues" className={styles.panel}>
            <DashboardSource source={toBadgeSource(data.queueTable.source)} timezone={data.period.timezone} />
            <Flex align="baseline" justify="between" gap="8" wrap="wrap">
              <Text variant="large">{t('callcenter.dashboard.queues.title', 'Queues')}</Text>
              <Text variant="xs">{t('callcenter.dashboard.queues.worstFirst', 'Worst service first')}</Text>
            </Flex>
            {data.queueTable.data ? (
              <CcQueueTable
                rows={data.queueTable.data}
                thresholds={thresholds}
                onOpenQueue={(queueName) => {
                  if (data.period.preset === 'today') {
                    navigate(buildSupervisorLink({ queues: [queueName] }));
                  } else {
                    openReport('queue-summary', queueName);
                  }
                }}
              />
            ) : (
              <SectionNote section={data.queueTable} testId="cc-queues-note" />
            )}
          </VStack>

          <VStack gap="8" id="cc-sec-losses" className={styles.panel}>
            <DashboardSource source={toBadgeSource(data.losses.source)} timezone={data.period.timezone} />
            <Flex align="center" justify="between" gap="8" wrap="wrap">
              <Text variant="large">{t('callcenter.dashboard.losses.title', 'Lost calls and callbacks')}</Text>
              <Button variant="ghost" size="sm" onClick={() => openReport('missed-callback')} data-testid="cc-losses-open">
                {t('callcenter.dashboard.openReport', 'Open the report')}
              </Button>
            </Flex>
            {data.losses.data ? (
              <CcLossesPanel losses={data.losses.data} compare={params.compare} />
            ) : (
              <SectionNote section={data.losses} testId="cc-losses-note" />
            )}
          </VStack>

          <VStack gap="8" id="cc-sec-pauses" className={styles.panel}>
            <DashboardSource source={toBadgeSource(data.pauses.source)} timezone={data.period.timezone} />
            <Flex align="center" justify="between" gap="8" wrap="wrap">
              <Text variant="large">{t('callcenter.dashboard.pauses.title', 'Pauses')}</Text>
              <Button variant="ghost" size="sm" onClick={() => openReport('pause-report')} data-testid="cc-pauses-open">
                {t('callcenter.dashboard.openReport', 'Open the report')}
              </Button>
            </Flex>
            {data.pauses.data ? (
              <CcPausesPanel pauses={data.pauses.data} compare={params.compare} />
            ) : (
              <SectionNote section={data.pauses} testId="cc-pauses-note" />
            )}
          </VStack>

          <VStack gap="8" id="cc-sec-operators" className={styles.panel}>
            <DashboardSource source={toBadgeSource(data.operators.source)} timezone={data.period.timezone} />
            <Flex align="center" justify="between" gap="8" wrap="wrap">
              <Text variant="large">{t('callcenter.dashboard.operators.title', 'Operators who stand out')}</Text>
              <Button variant="ghost" size="sm" onClick={() => openReport('operator-stats', '')} data-testid="cc-operators-open">
                {t('callcenter.dashboard.openReport', 'Open the report')}
              </Button>
            </Flex>
            {data.operators.data ? (
              <CcOperatorsPanel
                operators={data.operators.data}
                onOpenOperator={(agent) => openReport('operator-stats', '', agent)}
              />
            ) : (
              <SectionNote section={data.operators} testId="cc-operators-note" />
            )}
          </VStack>
        </>
      )}
    </VStack>
  );
}
