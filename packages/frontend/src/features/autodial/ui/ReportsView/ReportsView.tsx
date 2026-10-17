import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Loader2 } from 'lucide-react';
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
  autodialExportUrl,
  useGetAutodialCampaignsQuery,
  useGetAutodialDailyQuery,
  useGetAutodialDetailQuery,
  useGetAutodialSummaryQuery,
} from '@/shared/api/endpoints/autodialApi';
import { autodialDispositionLabel } from '../../lib/labels';
import { buildDispositionBreakdown, isoDaysAgo, isoToday, previousReportPeriod } from '../../model/reportRange';
import { ReportBreakdown } from './ReportBreakdown';
import cls from './ReportsView.module.scss';

const PIE_COLORS = ['#22c55e', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#14b8a6'];

export const ReportsView = memo(({ campaignUid }: { campaignUid?: number }) => {
  const { t } = useTranslation();
  const [from, setFrom] = useState(() => isoDaysAgo(6));
  const [to, setTo] = useState(() => isoToday());
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [compare, setCompare] = useState(false);

  const { data: campaigns } = useGetAutodialCampaignsQuery();
  const query = useMemo(
    () => ({
      from,
      to,
      campaigns: campaignUid ? [campaignUid] : selectedCampaigns.length ? selectedCampaigns.map(Number) : undefined,
    }),
    [from, to, selectedCampaigns, campaignUid],
  );

  const { data: summary, isFetching: summaryFetching } = useGetAutodialSummaryQuery(query);
  const { data: daily } = useGetAutodialDailyQuery(query);
  const { data: detail, isFetching: detailFetching } = useGetAutodialDetailQuery(query);
  const previous = previousReportPeriod(from, to);
  const { currentData: previousSummary } = useGetAutodialSummaryQuery({ ...query, ...(previous ?? {}) }, { skip: !compare || !previous });

  const nameByUid = new Map((campaigns ?? []).map((c) => [c.uid, c.name]));
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
            onChange={setSelectedCampaigns}
            placeholder={t('autodial.reports.allCampaigns')}
          />
        </VStack>}
      </HStack>
      <HStack gap="8" wrap="wrap">
        <Button variant="outline" asChild>
          <a href={autodialExportUrl(query, 'summary', 'csv')} download>
            <Download size={16} />
            {t('autodial.reports.exportSummaryCsv')}
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href={autodialExportUrl(query, 'detail', 'xlsx')} download>
            <Download size={16} />
            {t('autodial.reports.exportDetailXlsx')}
          </a>
        </Button>
      </HStack>
    </Flex>
  );

  return (
    <VStack gap="16" max>
      <HStack gap="8" wrap="wrap">{[1, 7, 30].map((days) => <Button key={days} variant="outline" onClick={() => { setFrom(isoDaysAgo(days - 1)); setTo(isoToday()); }}>
        {t('autodial.workspace.reportPreset', { days })}</Button>)}
        <Checkbox id="autodial-report-compare" checked={compare} onChange={(event) => setCompare(event.target.checked)} />
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

      <Tabs defaultValue="summary" className={cls.tabs}>
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
                  <Text variant="muted">{t('autodial.reports.noData')}</Text>
                </Flex>
              ) : (
                <div className={cls.tableScroll}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('autodial.reports.campaign')}</TableHead>
                        <TableHead>{t('autodial.reports.dials')}</TableHead>
                        <TableHead>{t('autodial.reports.answered')}</TableHead>
                        <TableHead>{t('autodial.reports.success')}</TableHead>
                        <TableHead>{t('autodial.reports.contactRate')}</TableHead>
                        <TableHead>{t('autodial.reports.rpc')}</TableHead>
                        <TableHead>{t('autodial.reports.asr')}</TableHead>
                        <TableHead>{t('autodial.reports.aht')}</TableHead>
                        <TableHead>{t('autodial.reports.acd')}</TableHead>
                        <TableHead>{t('autodial.reports.abandonRate')}</TableHead>
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
                            {row.kpi.abandon_rate}%
                          </TableCell>
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
                      stroke="#6366f1"
                    />
                    <Line
                      type="monotone"
                      dataKey="answered"
                      name={t('autodial.reports.answered')}
                      stroke="#3b82f6"
                    />
                    <Line
                      type="monotone"
                      dataKey="success"
                      name={t('autodial.reports.success')}
                      stroke="#22c55e"
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
                      {dispositionData.map((slice, index) => (
                        <Cell key={slice.disposition} fill={PIE_COLORS[index % PIE_COLORS.length]} />
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
                    <Bar dataKey="dials" name={t('autodial.reports.dials')} fill="#6366f1" />
                    <Bar dataKey="success" name={t('autodial.reports.success')} fill="#22c55e" />
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
                  <Text variant="muted">{t('autodial.reports.noData')}</Text>
                </Flex>
              ) : (
                <div className={cls.tableScroll}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('autodial.reports.startedAt')}</TableHead>
                        <TableHead>{t('autodial.reports.campaign')}</TableHead>
                        <TableHead>{t('autodial.reports.attemptNo')}</TableHead>
                        <TableHead>{t('autodial.reports.disposition')}</TableHead>
                        <TableHead>{t('autodial.reports.cause')}</TableHead>
                        <TableHead>{t('autodial.reports.trunk')}</TableHead>
                        <TableHead>{t('autodial.reports.callerId')}</TableHead>
                        <TableHead>{t('autodial.reports.queue')}</TableHead>
                        <TableHead>{t('autodial.reports.agent')}</TableHead>
                        <TableHead>{t('autodial.reports.billsec')}</TableHead>
                        <TableHead>DTMF</TableHead>
                        <TableHead>{t('autodial.workspace.businessOutcomes')}</TableHead>
                        <TableHead>AMD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detail ?? []).map((row) => (
                        <TableRow key={row.attempt_uid}>
                          <TableCell>{new Date(row.started_at).toLocaleString()}</TableCell>
                          <TableCell>
                            {nameByUid.get(row.campaign_uid) ?? `#${row.campaign_uid}`}
                          </TableCell>
                          <TableCell className={cls.num}>{row.attempt_no}</TableCell>
                          <TableCell>{autodialDispositionLabel(row.disposition, t)}</TableCell>
                          <TableCell>{row.hangup_cause ?? '-'}</TableCell>
                          <TableCell>{row.trunk_id ?? '-'}</TableCell>
                          <TableCell>{row.caller_id ?? '-'}</TableCell>
                          <TableCell>{row.queue_name ?? '-'}</TableCell>
                          <TableCell>{row.agent_interface ?? '-'}</TableCell>
                          <TableCell className={cls.num}>{row.billsec}</TableCell>
                          <TableCell>{row.scenario_result?.dtmf ?? '-'}</TableCell>
                          <TableCell>{String(row.scenario_result?.business_outcome ?? '-')}</TableCell>
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
    </VStack>
  );
});

ReportsView.displayName = 'ReportsView';
