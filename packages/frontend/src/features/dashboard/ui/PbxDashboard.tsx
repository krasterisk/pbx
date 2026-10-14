import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  DashboardQuery,
  DashboardSource as Source,
  DashboardSystemNode,
} from '@krasterisk/shared';
import {
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Users,
  Waypoints,
  Activity,
  AlertTriangle,
  RefreshCw,
  Server,
  Wallet,
  Clock,
  CalendarDays,
  CheckCircle2,
  PhoneMissed,
  CircleHelp,
  Cpu,
  MemoryStick,
  HardDrive,
  Gauge,
  CreditCard,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  HStack,
  VStack,
  Text,
  Input,
  Select,
  Skeleton,
  QueryErrorState,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  InfoTooltip,
} from '@/shared/ui';
import { DashboardChart } from '@/shared/ui/DashboardChart/DashboardChart';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { groupDashboardBuckets } from './dashboardChartData';
import { useDashboardOverview } from '../model/useDashboardOverview';
import {
  customRange,
  hasDashboardValue,
  periodQuery,
  type DashboardDetail,
} from '../model/dashboardView';
import { DashboardMetric } from './DashboardMetric';
import { DashboardSource } from './DashboardSource';
import { DashboardDetailSheet } from './DashboardDetailSheet';
import { money } from './DashboardCloud';
import cls from './Dashboard.module.scss';

export function PbxDashboard() {
  const { t, i18n } = useTranslation();
  const isPhone = useIsMobile(768);
  const [params, setParams] = useState<DashboardQuery>({ period: 'today' });
  const [periodChoice, setPeriodChoice] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [rangeError, setRangeError] = useState(false);
  const [entry, setEntry] = useState<DashboardDetail | null>(null);
  const [chartMode, setChartMode] = useState('direction');
  const [bucket, setBucket] = useState('');
  const [chartSeries, setChartSeries] = useState('');
  const query = useDashboardOverview(params);
  const data = query.currentData;
  const timezone = data?.period.timezone ?? 'UTC';
  const formatDate = (at: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(at));
  const value = (number: number, source: Source) =>
    hasDashboardValue(source) ? number.toLocaleString(i18n.language) : t('dashboard.noData');
  const baseFilters = data ? periodQuery(data.period) : {};
  const open = (
    kind: DashboardDetail['kind'],
    title: string,
    filters?: DashboardDetail['filters'],
    nodeId?: string,
  ) => setEntry({ kind, title, filters: { ...baseFilters, ...filters }, nodeId });
  const calls = (title: string, filters?: DashboardDetail['filters']) =>
    open('calls', title, filters);
  const buckets = data
    ? groupDashboardBuckets(data.buckets.slice(0, 300), data.period, isPhone ? 24 : 96)
    : [];
  const selectedBucket = buckets.some((item) => item.at === bucket) ? bucket : '';
  const formatInterval = (at: string) => {
    const interval = buckets.find((item) => item.at === at);
    return formatDate(at) + (interval ? ' → ' + formatDate(interval.until) : '');
  };
  const chartPoint = (at: string, key: string) => {
    const index = buckets.findIndex((row) => row.at === at);
    if (index < 0 || !data) return;
    const next = buckets[index].until;
    const mapping: Record<string, DashboardDetail['filters']> = {
      incoming: { direction: 'in' },
      outgoing: { direction: 'out' },
      internal: { direction: 'internal' },
      accepted: { direction: 'in', outcome: 'accepted' },
      missed: { direction: 'in', outcome: 'missed' },
    };
    const clampedFrom = Date.parse(at) < Date.parse(data.period.from) ? data.period.from : at;
    calls(t('dashboard.chartDetail'), {
      ...mapping[key],
      from: clampedFrom,
      to: next,
      period: 'custom',
    });
  };
  const series =
    chartMode === 'direction'
      ? [
          { key: 'incoming', label: t('dashboard.incoming'), color: 'var(--color-primary)' },
          { key: 'outgoing', label: t('dashboard.outgoing'), color: 'var(--color-success)' },
          {
            key: 'internal',
            label: t('dashboard.internal'),
            color: 'var(--color-muted-foreground)',
          },
        ]
      : [
          { key: 'accepted', label: t('dashboard.accepted'), color: 'var(--color-success)' },
          { key: 'missed', label: t('dashboard.missed'), color: 'var(--color-destructive)' },
        ];
  const nodeMetrics = (node: DashboardSystemNode) => {
    const known = hasDashboardValue(node.source);
    const sample = node.current;
    const percent = (number: number | null | undefined) =>
      known && number !== undefined && number !== null
        ? number.toFixed(1) + '%'
        : t('dashboard.noData');
    const disk = sample?.disks.reduce(
      (worst, row) => (!worst || row.usedPercent > worst.usedPercent ? row : worst),
      undefined as (typeof sample.disks)[number] | undefined,
    );
    return (
      <VStack key={node.id} gap="12" align="stretch" className={cls.nodeOverview}>
        <HStack gap="8" wrap="wrap">
          <Text variant="h4">{node.label}</Text>
          <Badge variant="secondary">{t('dashboard.nodeRole.' + node.role)}</Badge>
        </HStack>
        <DashboardSource source={node.source} timezone={timezone} />
        <HStack className={cls.grid}>
          <DashboardMetric
            title={t('dashboard.cpu')}
            value={percent(sample?.cpu)}
            icon={Cpu}
            onClick={() => open('system', node.label, undefined, node.id)}
          />
          <DashboardMetric
            title={t('dashboard.memory')}
            value={percent(sample?.memory)}
            icon={MemoryStick}
            onClick={() => open('system', node.label, undefined, node.id)}
          />
          <DashboardMetric
            title={t('dashboard.disk')}
            icon={HardDrive}
            value={percent(disk?.usedPercent)}
            hint={
              disk && known
                ? t('dashboard.diskFree', { free: (disk.availableBytes / 1024 ** 3).toFixed(1) })
                : undefined
            }
            onClick={() => open('system', node.label, undefined, node.id)}
          />
          <DashboardMetric
            title={t('dashboard.load')}
            icon={Gauge}
            value={known && sample?.load != null ? sample.load.toFixed(2) : t('dashboard.noData')}
            hint={t('dashboard.moreResources')}
            onClick={() => open('system', node.label, undefined, node.id)}
          />
        </HStack>
      </VStack>
    );
  };
  const changePeriod = (period: string) => {
    setPeriodChoice(period);
    setRangeError(false);
    setBucket('');
    setEntry(null);
    if (period !== 'custom') setParams({ period: period as DashboardQuery['period'] });
  };
  return (
    <Tabs value={periodChoice} onValueChange={changePeriod} asChild>
      <VStack className={cls.page} gap="32" align="stretch" max data-testid="dashboard-responsive">
        <HStack justify="between" gap="16" className={cls.header}>
          <HStack gap="16" align="start">
            <HStack justify="center" className={cls.headerIcon}>
              <Activity size={24} aria-hidden="true" />
            </HStack>
            <VStack gap="4" align="start">
              <Text variant="h1" className={cls.title}>
                {t('dashboard.title')}
              </Text>
              <Text variant="muted">{t('dashboard.systemOverview')}</Text>
            </VStack>
          </HStack>
          <Button
            variant="outline"
            className={cls.refresh}
            aria-label={t('dashboard.refresh')}
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw size={16} />
            {t('dashboard.refresh')}
          </Button>
        </HStack>
        <VStack gap="12" align="stretch" className={cls.controls}>
          <HStack gap="8" justify="between" wrap="wrap">
            <HStack gap="8">
              <CalendarDays className={cls.icon} aria-hidden="true" />
              <Text variant="small">{t('dashboard.periodLabel')}</Text>
            </HStack>
            {data && (
              <Text variant="xs" className={cls.dateRange}>
                {formatDate(data.period.from)} → {formatDate(data.period.to)}
              </Text>
            )}
          </HStack>
          <TabsList aria-label={t('dashboard.periodLabel')} className={cls.periodTabs}>
            {['today', 'yesterday', '7d', '30d', 'custom'].map((period) => (
              <TabsTrigger key={period} value={period} className={cls.periodTab}>
                {t('dashboard.period.' + period)}
              </TabsTrigger>
            ))}
          </TabsList>
        </VStack>
        <TabsContent value={periodChoice} className={cls.periodContent}>
          <VStack gap="32" align="stretch" max>
            {periodChoice === 'custom' && (
              <VStack gap="8" align="stretch" className={cls.customPanel}>
                <HStack gap="8" className={cls.custom}>
                  <Input
                    type="date"
                    aria-label={t('dashboard.fromDate')}
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                  <Input
                    type="date"
                    aria-label={t('dashboard.toDate')}
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                  <Button
                    onClick={() => {
                      const range = customRange(customFrom, customTo, timezone);
                      setRangeError(!range);
                      if (range) {
                        setParams(range);
                        setEntry(null);
                        setBucket('');
                      }
                    }}
                  >
                    {t('dashboard.apply')}
                  </Button>
                </HStack>
                {rangeError && (
                  <Text variant="error" role="alert">
                    {t('dashboard.rangeError')}
                  </Text>
                )}
              </VStack>
            )}
            {!data &&
              (query.isError ? (
                <QueryErrorState onRetry={query.refetch} />
              ) : (
                <Skeleton className={cls.empty} />
              ))}
            {data && (
              <>
                {query.isError && (
                  <Text variant="error" role="alert">
                    {t('dashboard.refreshFailed')}
                  </Text>
                )}
                <VStack gap="12" align="stretch" className={cls.status}>
                  <HStack gap="8">
                    <Activity className={cls.icon} />
                    <Text variant="h4">{t('dashboard.pbxState')}</Text>
                  </HStack>
                  <DashboardSource source={data.live.source} timezone={timezone} />
                  {data.warnings.length === 0 &&
                    data.live.source.state === 'ok' &&
                    !query.isError && <Text variant="muted">{t('dashboard.noProblems')}</Text>}
                  <VStack className={cls.warnings} align="stretch">
                    {data.warnings.slice(0, 5).map((warning) => (
                      <Button
                        key={warning.code}
                        variant="outline"
                        className={
                          cls.warning +
                          (warning.severity === 'critical' ? ' ' + cls.warningCritical : '')
                        }
                        onClick={() =>
                          open(
                            warning.target,
                            t('dashboard.warning.' + warning.code, {
                              defaultValue: t('dashboard.warningFallback'),
                            }),
                            warning.target === 'trunks' || warning.target === 'endpoints'
                              ? { status: 'offline' }
                              : undefined,
                          )
                        }
                      >
                        <HStack gap="8">
                          <AlertTriangle className={cls.icon} />
                          <Text as="span">
                            {t('dashboard.warning.' + warning.code, {
                              defaultValue: t('dashboard.warningFallback'),
                            })}
                          </Text>
                        </HStack>
                        <Badge
                          variant={warning.severity === 'critical' ? 'destructive' : 'secondary'}
                        >
                          {warning.count}
                        </Badge>
                      </Button>
                    ))}
                  </VStack>
                  {data.warningCount > data.warnings.slice(0, 5).length && (
                    <Text variant="muted">
                      {t('dashboard.moreWarnings', {
                        count: data.warningCount - data.warnings.slice(0, 5).length,
                      })}
                    </Text>
                  )}
                </VStack>
                <VStack gap="16" align="stretch">
                  <HStack gap="8" className={cls.groupHeading}>
                    <Activity className={cls.icon} aria-hidden="true" />
                    <Text variant="h3">{t('dashboard.now')}</Text>
                  </HStack>
                  <HStack className={cls.grid}>
                    <DashboardMetric
                      title={t('dashboard.activeCalls')}
                      value={value(
                        data.live.activeCalls,
                        data.live.callsSource ?? data.live.source,
                      )}
                      icon={PhoneCall}
                      onClick={() => calls(t('dashboard.activeCalls'), { outcome: 'active' })}
                    />
                    <DashboardMetric
                      title={t('dashboard.ringing')}
                      value={value(data.live.ringing, data.live.callsSource ?? data.live.source)}
                      tone="warning"
                      icon={PhoneIncoming}
                      onClick={() =>
                        calls(t('dashboard.ringing'), { outcome: 'active', state: 'ringing' })
                      }
                    />
                    <DashboardMetric
                      title={t('dashboard.talking')}
                      value={value(data.live.talking, data.live.callsSource ?? data.live.source)}
                      tone="success"
                      icon={PhoneCall}
                      onClick={() =>
                        calls(t('dashboard.talking'), { outcome: 'active', state: 'talking' })
                      }
                    />
                    <DashboardMetric
                      title={t('dashboard.waiting')}
                      value={value(data.live.waiting, data.live.callsSource ?? data.live.source)}
                      tone="warning"
                      icon={Clock}
                      onClick={() =>
                        calls(t('dashboard.waiting'), { outcome: 'active', state: 'waiting' })
                      }
                    />
                    <DashboardMetric
                      title={t('dashboard.peersOnline')}
                      value={
                        hasDashboardValue(data.live.inventorySource ?? data.live.source)
                          ? value(
                              data.live.endpoints.online,
                              data.live.inventorySource ?? data.live.source,
                            ) +
                            ' / ' +
                            value(
                              data.live.endpoints.total,
                              data.live.inventorySource ?? data.live.source,
                            )
                          : t('dashboard.noData')
                      }
                      hint={
                        hasDashboardValue(data.live.inventorySource ?? data.live.source)
                          ? t('dashboard.unknownStatuses', { count: data.live.endpoints.unknown })
                          : undefined
                      }
                      icon={Users}
                      onClick={() => open('endpoints', t('dashboard.peersOnline'))}
                    />
                    <DashboardMetric
                      title={t('dashboard.trunksOnline')}
                      value={
                        hasDashboardValue(data.live.inventorySource ?? data.live.source)
                          ? value(
                              data.live.trunks.online,
                              data.live.inventorySource ?? data.live.source,
                            ) +
                            ' / ' +
                            value(
                              data.live.trunks.total,
                              data.live.inventorySource ?? data.live.source,
                            )
                          : t('dashboard.noData')
                      }
                      hint={
                        hasDashboardValue(data.live.inventorySource ?? data.live.source)
                          ? t('dashboard.unknownStatuses', { count: data.live.trunks.unknown })
                          : undefined
                      }
                      icon={Waypoints}
                      onClick={() => open('trunks', t('dashboard.trunksOnline'))}
                    />
                  </HStack>
                </VStack>
                <VStack gap="16" align="stretch">
                  <HStack gap="12" wrap="wrap" className={cls.groupHeading}>
                    <Text variant="h3">{t('dashboard.forPeriod')}</Text>
                    <InfoTooltip text={t('dashboard.outcomeDefinitions')} />
                    <DashboardSource source={data.historySource} timezone={timezone} />
                  </HStack>
                  <HStack className={cls.grid}>
                    <DashboardMetric
                      title={t('dashboard.totalCalls')}
                      value={value(data.totals.total, data.historySource)}
                      hint={t('dashboard.allCallsHint')}
                      icon={PhoneCall}
                      onClick={() => calls(t('dashboard.totalCalls'))}
                    />
                    <DashboardMetric
                      title={t('dashboard.incoming')}
                      value={value(data.totals.incoming, data.historySource)}
                      icon={PhoneIncoming}
                      onClick={() => calls(t('dashboard.incoming'), { direction: 'in' })}
                    />
                    <DashboardMetric
                      title={t('dashboard.outgoing')}
                      value={value(data.totals.outgoing, data.historySource)}
                      icon={PhoneOutgoing}
                      onClick={() => calls(t('dashboard.outgoing'), { direction: 'out' })}
                    />
                    <DashboardMetric
                      title={t('dashboard.internal')}
                      value={value(data.totals.internal, data.historySource)}
                      icon={Users}
                      onClick={() => calls(t('dashboard.internal'), { direction: 'internal' })}
                    />
                    <DashboardMetric
                      title={t('dashboard.accepted')}
                      value={value(data.totals.accepted, data.historySource)}
                      hint={t('dashboard.acceptedHint')}
                      tone="success"
                      icon={CheckCircle2}
                      onClick={() =>
                        calls(t('dashboard.accepted'), { direction: 'in', outcome: 'accepted' })
                      }
                    />
                    <DashboardMetric
                      title={t('dashboard.missed')}
                      value={value(data.totals.missed, data.historySource)}
                      hint={t('dashboard.missedHint')}
                      tone="danger"
                      icon={PhoneMissed}
                      onClick={() =>
                        calls(t('dashboard.missed'), { direction: 'in', outcome: 'missed' })
                      }
                    />
                    <DashboardMetric
                      title={t('dashboard.unknown')}
                      value={value(data.totals.unknown, data.historySource)}
                      hint={t('dashboard.unknownHint')}
                      tone="warning"
                      icon={CircleHelp}
                      onClick={() => calls(t('dashboard.unknown'), { outcome: 'unknown' })}
                    />
                  </HStack>
                </VStack>
                <Card className={cls.section}>
                  <HStack justify="between" gap="12" className={cls.sectionHead}>
                    <Text variant="h3">{t('dashboard.callDynamics')}</Text>
                    <Select
                      className={cls.period}
                      aria-label={t('dashboard.chartMode')}
                      value={chartMode}
                      onChange={(e) => {
                        setChartMode(e.target.value);
                        setChartSeries('');
                      }}
                      options={[
                        { value: 'direction', label: t('dashboard.byDirection') },
                        { value: 'result', label: t('dashboard.byResult') },
                      ]}
                    />
                  </HStack>
                  <VStack gap="12" className={cls.sectionBody} align="stretch">
                    {hasDashboardValue(data.historySource) && buckets.length ? (
                      <DashboardChart
                        label={t('dashboard.callDynamics')}
                        points={buckets.map((item) => ({ ...item }))}
                        series={series}
                        showLegend
                        formatTime={formatDate}
                        formatTooltip={formatInterval}
                        onPoint={chartPoint}
                      />
                    ) : (
                      <Text variant="muted" className={cls.empty}>
                        {t(
                          data.historySource.state === 'ok'
                            ? 'dashboard.noCalls'
                            : 'dashboard.noData',
                        )}
                      </Text>
                    )}
                    {buckets.length > 0 && hasDashboardValue(data.historySource) && (
                      <HStack gap="8" wrap="wrap">
                        <Select
                          className={cls.search}
                          aria-label={t('dashboard.chartInterval')}
                          value={selectedBucket}
                          onChange={(e) => setBucket(e.target.value)}
                          options={[
                            { value: '', label: t('dashboard.chooseInterval') },
                            ...buckets.map((item) => ({
                              value: item.at,
                              label: formatInterval(item.at),
                            })),
                          ]}
                        />
                        <Select
                          className={cls.filter}
                          aria-label={t('dashboard.chartSeries')}
                          value={chartSeries}
                          onChange={(e) => setChartSeries(e.target.value)}
                          options={[
                            { value: '', label: t('dashboard.totalCalls') },
                            ...series.map((item) => ({ value: item.key, label: item.label })),
                          ]}
                        />
                        <Button
                          variant="outline"
                          disabled={!selectedBucket}
                          onClick={() => chartPoint(selectedBucket, chartSeries)}
                        >
                          {t('dashboard.showInterval')}
                        </Button>
                      </HStack>
                    )}
                    {selectedBucket && (
                      <Text variant="xs" className={cls.caption}>
                        {formatInterval(selectedBucket)}
                      </Text>
                    )}
                    <Text variant="xs">{t('dashboard.chartHint')}</Text>
                  </VStack>
                </Card>
                {data.deploymentMode === 'cloud' ? (
                  <Card className={cls.section}>
                    <HStack gap="8" className={cls.sectionHead}>
                      <Wallet className={cls.icon} />
                      <Text variant="h3">{t('dashboard.cloudTitle')}</Text>
                    </HStack>
                    <VStack gap="16" className={cls.sectionBody}>
                      {data.cloud ? (
                        <>
                          <DashboardSource source={data.cloud.source} timezone={timezone} />
                          <HStack className={cls.grid + ' ' + cls.cloudGrid}>
                            <DashboardMetric
                              title={t('dashboard.plan')}
                              icon={CreditCard}
                              value={
                                hasDashboardValue(data.cloud.source)
                                  ? data.cloud.planName || t('dashboard.planUnset')
                                  : t('dashboard.noData')
                              }
                              hint={
                                data.cloud.expiresAt
                                  ? t('dashboard.planExpires', {
                                      date: formatDate(data.cloud.expiresAt),
                                    })
                                  : t('dashboard.expiryUnknown')
                              }
                              onClick={() => open('cloud', t('dashboard.cloudTitle'))}
                            />
                            <DashboardMetric
                              title={t('dashboard.balance')}
                              icon={Wallet}
                              value={
                                hasDashboardValue(data.cloud.source)
                                  ? (money(data.cloud.balanceKopecks, i18n.language) ??
                                    t('dashboard.noData'))
                                  : t('dashboard.noData')
                              }
                              onClick={() => open('cloud', t('dashboard.balance'))}
                            />
                            <DashboardMetric
                              title={t('dashboard.availableBalance')}
                              icon={Wallet}
                              value={
                                hasDashboardValue(data.cloud.source) &&
                                data.cloud.balanceKopecks !== null &&
                                data.cloud.creditLimitKopecks !== null
                                  ? money(
                                      data.cloud.balanceKopecks + data.cloud.creditLimitKopecks,
                                      i18n.language,
                                    )!
                                  : t('dashboard.noData')
                              }
                              hint={
                                hasDashboardValue(data.cloud.billingSource ?? data.cloud.source)
                                  ? t(
                                      data.cloud.blocked
                                        ? 'dashboard.billingBlocked'
                                        : 'dashboard.billingActive',
                                    )
                                  : t('dashboard.source.notConfigured')
                              }
                              onClick={() => open('cloud', t('dashboard.cloudTitle'))}
                            />
                            <DashboardMetric
                              title={t('dashboard.limit.concurrentCalls')}
                              icon={PhoneCall}
                              value={
                                hasDashboardValue(data.cloud.source) &&
                                hasDashboardValue(data.live.callsSource ?? data.live.source)
                                  ? data.cloud.usage.concurrentCalls +
                                    ' / ' +
                                    (data.cloud.limits.concurrentCalls ??
                                      t('dashboard.limitUnknown'))
                                  : t('dashboard.noData')
                              }
                              hint={t('dashboard.moreLimits')}
                              onClick={() => open('cloud', t('dashboard.cloudTitle'))}
                            />
                          </HStack>
                        </>
                      ) : (
                        <Text variant="muted">{t('dashboard.noData')}</Text>
                      )}
                    </VStack>
                  </Card>
                ) : (
                  <Card className={cls.section}>
                    <HStack justify="between" gap="12" className={cls.sectionHead}>
                      <HStack gap="8">
                        <Server className={cls.icon} />
                        <Text variant="h3">{t('dashboard.serverTitle')}</Text>
                      </HStack>
                      <Button
                        variant="outline"
                        onClick={() => open('system', t('dashboard.serverTitle'))}
                      >
                        {t('dashboard.resourceDetails')}
                      </Button>
                    </HStack>
                    <VStack gap="20" className={cls.sectionBody} align="stretch">
                      {data.system?.length ? (
                        data.system.slice(0, 8).map(nodeMetrics)
                      ) : (
                        <Text variant="muted">{t('dashboard.source.notConfigured')}</Text>
                      )}
                    </VStack>
                  </Card>
                )}
                <DashboardDetailSheet
                  entry={entry}
                  overview={data}
                  onClose={() => setEntry(null)}
                />
              </>
            )}
          </VStack>
        </TabsContent>
      </VStack>
    </Tabs>
  );
}
