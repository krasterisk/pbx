import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Loader2 } from 'lucide-react';
import { shiftDateKey, zonedDateKey } from '@krasterisk/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Button,
  Checkbox,
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
  MultiSelect,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useDownloadAutodialReportMutation,
  useGetAutodialCampaignsQuery,
  useGetAutodialDailyQuery,
  useGetAutodialDetailQuery,
  useGetAutodialSummaryQuery,
  useGetAutodialReportContextQuery,
  type AutodialDetailRow,
} from '@/shared/api/endpoints/autodialApi';
import { autodialDispositionLabel } from '../../lib/labels';
import { downloadBlob } from '@/shared/lib/csv';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { buildDispositionBreakdown, previousReportPeriod } from '../../model/reportRange';
import { useReportSearch, validReportDate } from '../../model/useReportSearch';
import { ReportBreakdown } from './ReportBreakdown';
import cls from './ReportsView.module.scss';
import { MetricDefinitions } from '../MetricDefinitions/MetricDefinitions';
import { AttemptInspector } from './AttemptInspector';

const DISPOSITION_COLORS: Record<string, string> = { success: 'var(--color-success)', answered_short: 'var(--color-primary)',
  no_answer: 'var(--color-muted-foreground)', busy: 'var(--color-warning)', amd_machine: 'var(--color-secondary-foreground)', failed: 'var(--color-destructive)' };

export const ReportsView = memo(({ campaignUid }: { campaignUid?: number }) => {
  const { t } = useTranslation();
  const { read, write } = useReportSearch();
  const { currentData: context } = useGetAutodialReportContextQuery(undefined, { pollingInterval: 60000 });
  const today = zonedDateKey(new Date(), context?.timezone ?? 'UTC');
  const from = validReportDate(read('from')) ?? shiftDateKey(today, -6);
  const to = validReportDate(read('to')) ?? today;
  const selectedCampaigns = (read('campaigns') ?? '').split(',').filter((value) => /^[1-9]\d*$/.test(value)).slice(0, 50);
  const compare = read('compare') === '1';
  const setFrom = (value: string) => write({ from: value });
  const setTo = (value: string) => write({ to: value });
  const [exportError, setExportError] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<AutodialDetailRow | null>(null);
  const [download, { isLoading: exporting, reset: resetDownload }] = useDownloadAutodialReportMutation();

  const { data: campaigns } = useGetAutodialCampaignsQuery();
  const query = useMemo(
    () => ({
      from,
      to,
      campaigns: campaignUid ? [campaignUid] : selectedCampaigns.length ? selectedCampaigns.map(Number) : undefined,
    }),
    [from, to, selectedCampaigns, campaignUid],
  );

  const { currentData: summary, isFetching: summaryFetching, isError: summaryError, refetch: refetchSummary } = useGetAutodialSummaryQuery(query);
  const { currentData: daily, isError: dailyError, refetch: refetchDaily } = useGetAutodialDailyQuery(query);
  const { currentData: detail, isFetching: detailFetching, isError: detailError, refetch: refetchDetail } = useGetAutodialDetailQuery(query);
  const previous = previousReportPeriod(from, to);
  const { currentData: previousSummary } = useGetAutodialSummaryQuery({ ...query, ...(previous ?? {}) }, { skip: !compare || !previous });

  const nameByUid = new Map((campaigns ?? []).map((c) => [c.uid, c.name]));
  const exportReport = async (kind: 'summary' | 'detail', format: 'csv' | 'xlsx') => {
    setExportError(false);
    try {
      const blob = await download({ query, kind, format }).unwrap();
      downloadBlob(blob, `autodial-${kind}.${format}`);
    } catch { setExportError(true); }
    finally { resetDownload(); }
  };
  const summaryRows = summary ?? [];
  const dispositionData = useMemo(
    () => buildDispositionBreakdown(summaryRows).map((slice) => ({
      ...slice,
      label: autodialDispositionLabel(slice.disposition, t),
    })),
    [summaryRows, t],
  );

  const dailyData = useMemo(
    () =>
      (daily ?? []).map((row) => ({
        day: row.day,
        dials: Number(row.dials),
        answered: Number(row.answered),
        success: Number(row.success),
      })),
    [daily],
  );

  const filters = (
    <Flex justify="between" align="end" max className={cls.filters} wrap="wrap">
      <HStack gap="12" align="end" wrap="wrap">
        <VStack gap="4">
          <Label htmlFor="autodial-report-from">{t('autodial.reports.from')}</Label>
          <Input
            id="autodial-report-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </VStack>
        <VStack gap="4">
          <Label htmlFor="autodial-report-to">{t('autodial.reports.to')}</Label>
          <Input
            id="autodial-report-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </VStack>
        {!campaignUid && <VStack gap="4" className={cls.campaignPicker}>
          <Label>{t('autodial.reports.campaigns')}</Label>
          <MultiSelect
            options={(campaigns ?? []).map((c) => ({ value: String(c.uid), label: c.name }))}
            value={selectedCampaigns}
            onChange={(value) => write({ campaigns: value.join(',') || null })}
            placeholder={t('autodial.reports.allCampaigns')}
          />
        </VStack>}
      </HStack>
      <HStack gap="8" wrap="wrap">
        <Button variant="outline" disabled={exporting} onClick={() => void exportReport('summary', 'csv')}>
            <Download size={16} />
            {t('autodial.reports.exportSummaryCsv')}
        </Button>
        <Button variant="outline" disabled={exporting} onClick={() => void exportReport('detail', 'xlsx')}>
            <Download size={16} />
            {t('autodial.reports.exportDetailXlsx')}
        </Button>
      </HStack>
    </Flex>
  );

  return (
    <VStack gap="16" max>
      {exportError && <Text role="alert">{t('autodial.workspace.exportFailed')}</Text>}
      {(summaryError || dailyError || detailError) && <QueryErrorState message={t('autodial.common.loadFailed')}
        onRetry={() => { void Promise.all([refetchSummary(), refetchDaily(), refetchDetail()]); }} retryLabel={t('autodial.common.retry')} />}
      {(summaryError || dailyError || detailError) && (summary || daily || detail) && <Text role="status">{t('autodial.workspace.reportStale')}</Text>}
      <HStack gap="8" wrap="wrap">{[1, 7, 30].map((days) => <Button key={days} variant="outline" onClick={() => write({ from: shiftDateKey(today, 1 - days), to: today })}>
        {t('autodial.workspace.reportPreset', { days })}</Button>)}
        <Checkbox id="autodial-report-compare" checked={compare} onChange={(event) => write({ compare: event.target.checked ? '1' : null })} />
        <Label htmlFor="autodial-report-compare">{t('autodial.workspace.comparePrevious')}</Label>
      </HStack>
      {compare && previous && <VStack gap="4" max><Text>{t('autodial.workspace.previousPeriod', previous)}</Text>
        {(['dials', 'answered', 'success'] as const).map((key) => {
          const current = summaryRows.reduce((sum, row) => sum + row[key], 0), before = (previousSummary ?? []).reduce((sum, row) => sum + row[key], 0);
          return <Text key={key}>{t(`autodial.reports.${key}`)}: {current} / {previousSummary ? before : '…'} · Δ {previousSummary ? current - before : '…'}</Text>;
        })}</VStack>}
      <Card className={cls.card}>
        <CardHeader>{filters}</CardHeader>
      </Card>

      <MetricDefinitions timezone={context?.timezone} from={from} to={to} />
      <Tabs value={['summary', 'charts', 'detail', 'breakdown'].includes(read('report') ?? '') ? read('report')! : 'summary'} onValueChange={(value) => write({ report: value })} className={cls.tabs}>
        <TabsList>
          <TabsTrigger value="summary">{t('autodial.reports.tabs.summary')}</TabsTrigger>
          <TabsTrigger value="charts">{t('autodial.reports.tabs.charts')}</TabsTrigger>
          <TabsTrigger value="detail">{t('autodial.reports.tabs.detail')}</TabsTrigger>
          <TabsTrigger value="breakdown">{t('autodial.workspace.breakdown')}</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card className={cls.card}>
            <CardContent className={cls.content}>
              {summaryFetching ? (
                <Flex justify="center" className={cls.loading}>
                  <Loader2 size={24} className={cls.spinner} />
                </Flex>
              ) : summaryRows.length === 0 ? (
                <Flex justify="center" className={cls.empty}>
                  <Text variant="muted">{t(summaryError ? 'autodial.common.loadFailed' : 'autodial.reports.noData')}</Text>
                </Flex>
              ) : (
                <div className={cls.tableScroll}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('autodial.reports.campaign')}</TableHead>
                        <TableHead>{t('autodial.reports.dials')}</TableHead>
                        <TableHead>{t('autodial.reports.answered')}</TableHead>
                        <TableHead>{t('autodial.workspace.metrics.technicalLabel')}</TableHead>
                        <TableHead>{t('autodial.workspace.metrics.reachedLabel')}</TableHead>
                        <TableHead>{t('autodial.reports.contactRate')}</TableHead>
                        <TableHead>{t('autodial.workspace.metrics.technicalRateLabel')}</TableHead>
                        <TableHead>{t('autodial.reports.asr')}</TableHead>
                        <TableHead>{t('autodial.workspace.metrics.talkLabel')}</TableHead>
                        <TableHead>{t('autodial.workspace.metrics.billableLabel')}</TableHead>
                        <TableHead>{t('autodial.reports.penetration')}</TableHead>
                        <TableHead>{t('autodial.reports.callsPerHour')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaryRows.map((row) => (
                        <TableRow key={row.campaign_uid}>
                          <TableCell>
                            {row.campaign_name || nameByUid.get(row.campaign_uid) || `#${row.campaign_uid}`}
                          </TableCell>
                          <TableCell className={cls.num}>{row.dials}</TableCell>
                          <TableCell className={cls.num}>{row.answered}</TableCell>
                          <TableCell className={cls.num}>{row.success}</TableCell>
                          <TableCell className={cls.num}>{row.contacts_reached ?? '—'}</TableCell>
                          <TableCell className={cls.num}>
                            {row.kpi.contact_rate}%
                          </TableCell>
                          <TableCell className={cls.num}>
                            {row.kpi.rpc}%
                          </TableCell>
                          <TableCell className={cls.num}>
                            {row.kpi.asr}%
                          </TableCell>
                          <TableCell className={cls.num}>{Math.round(row.kpi.aht)}</TableCell>
                          <TableCell className={cls.num}>{Math.round(row.kpi.acd)}</TableCell>
                          <TableCell className={cls.num}>
                            {row.kpi.list_penetration}%
                          </TableCell>
                          <TableCell className={cls.num}>
                            {Math.round(row.kpi.calls_per_hour)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="breakdown"><ReportBreakdown key={JSON.stringify(query)} query={query} /></TabsContent>

        <TabsContent value="charts">
          <div className={cls.chartGrid}>
            <Card className={cls.card}>
              <CardHeader>
                <Text className={cls.title}>{t('autodial.reports.dailyChart')}</Text>
              </CardHeader>
              <CardContent className={cls.chartBox}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="day" fontSize={12} />
                    <YAxis fontSize={12} />
                    <RechartsTooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="dials"
                      name={t('autodial.reports.dials')}
                      stroke="var(--color-primary)"
                    />
                    <Line
                      type="monotone"
                      dataKey="answered"
                      name={t('autodial.reports.answered')}
                      stroke="var(--color-muted-foreground)"
                    />
                    <Line
                      type="monotone"
                      dataKey="success"
                      name={t('autodial.reports.success')}
                      stroke="var(--color-success)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className={cls.card}>
              <CardHeader>
                <Text className={cls.title}>{t('autodial.reports.dispositionChart')}</Text>
              </CardHeader>
              <CardContent className={cls.chartBox}>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={dispositionData} dataKey="value" nameKey="label" outerRadius={90}>
                      {dispositionData.map((slice) => (
                        <Cell key={slice.disposition} fill={DISPOSITION_COLORS[slice.disposition]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className={cls.cardWide}>
              <CardHeader>
                <Text className={cls.title}>{t('autodial.reports.campaignChart')}</Text>
              </CardHeader>
              <CardContent className={cls.chartBox}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={summaryRows.map((row) => ({
                      name: row.campaign_name || `#${row.campaign_uid}`,
                      dials: row.dials,
                      success: row.success,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="dials" name={t('autodial.reports.dials')} fill="var(--color-primary)" />
                    <Bar dataKey="success" name={t('autodial.workspace.metrics.technicalLabel')} fill="var(--color-success)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="detail">
          <Card className={cls.card}>
            <CardContent className={cls.content}>
              {detailFetching ? (
                <Flex justify="center" className={cls.loading}>
                  <Loader2 size={24} className={cls.spinner} />
                </Flex>
              ) : (detail ?? []).length === 0 ? (
                <Flex justify="center" className={cls.empty}>
                  <Text variant="muted">{t(detailError ? 'autodial.common.loadFailed' : 'autodial.reports.noData')}</Text>
                </Flex>
              ) : (
                <div className={cls.tableScroll}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('autodial.workspace.clientId')}</TableHead>
                        <TableHead>{t('autodial.workspace.dialledPhone')}</TableHead>
                        <TableHead>{t('autodial.reports.startedAt')} ({context?.timezone ?? '…'})</TableHead>
                        <TableHead>{t('autodial.reports.campaign')}</TableHead>
                        <TableHead>{t('autodial.reports.attemptNo')}</TableHead>
                        <TableHead>{t('autodial.reports.disposition')}</TableHead>
                        <TableHead>{t('autodial.workspace.businessOutcomes')}</TableHead>
                        <TableHead>{t('autodial.workspace.outcomeDefinition.goal')}</TableHead>
                        <TableHead>{t('autodial.reports.cause')}</TableHead>
                        <TableHead>{t('autodial.reports.trunk')}</TableHead>
                        <TableHead>{t('autodial.reports.callerId')}</TableHead>
                        <TableHead>{t('autodial.reports.queue')}</TableHead>
                        <TableHead>{t('autodial.reports.agent')}</TableHead>
                        <TableHead>{t('autodial.reports.billsec')}</TableHead>
                        <TableHead>DTMF</TableHead>
                        <TableHead>AMD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detail ?? []).map((row) => (
                        <TableRow key={row.attempt_uid}>
                          <TableCell><Button variant="link" onClick={() => setSelectedAttempt(row)}>{row.external_id ?? row.contact_uid ?? `#${row.attempt_uid}`}</Button></TableCell>
                          <TableCell>{row.dialled_phone ?? '—'}</TableCell>
                          <TableCell>{context ? new Date(row.started_at).toLocaleString(undefined, { timeZone: context.timezone }) : '—'}</TableCell>
                          <TableCell>
                            {nameByUid.get(row.campaign_uid) ?? `#${row.campaign_uid}`}
                          </TableCell>
                          <TableCell className={cls.num}>{row.attempt_no}</TableCell>
                          <TableCell>{autodialDispositionLabel(row.disposition, t)}</TableCell>
                          <TableCell>{String(row.scenario_result?.business_outcome_label ?? row.scenario_result?.business_outcome ?? '—')}</TableCell>
                          <TableCell>{t(`autodial.workspace.outcomeDefinition.relations.${row.scenario_result?.business_goal_relation ?? 'unknown'}`)}</TableCell>
                          <TableCell>{row.hangup_cause ?? '-'}</TableCell>
                          <TableCell>{row.trunk_id ?? '-'}</TableCell>
                          <TableCell>{row.caller_id ?? '-'}</TableCell>
                          <TableCell>{row.queue_name ?? '-'}</TableCell>
                          <TableCell>{row.agent_interface ?? '-'}</TableCell>
                          <TableCell className={cls.num}>{row.billsec}</TableCell>
                          <TableCell>{row.scenario_result?.dtmf ?? '-'}</TableCell>
                          <TableCell>{row.amd_result ?? '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <AttemptInspector row={selectedAttempt} timezone={context?.timezone} onClose={() => setSelectedAttempt(null)} />
    </VStack>
  );
});

ReportsView.displayName = 'ReportsView';
