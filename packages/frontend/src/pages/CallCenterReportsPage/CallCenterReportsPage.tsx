import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { BarChart3, Inbox } from 'lucide-react';
import {
  VStack, HStack, Text, Button, Input, Skeleton, Badge, Label, MultiSelect,
} from '@/shared/ui';
import { CcPageHeader } from '@/features/callcenter/ui/CcPageHeader';
import {
  useGetReportQuery,
  useGetAgentTimelineQuery,
  useLazyExportReportQuery,
  type CcReportId,
  type HourlyHeatmapRow,
  type ReportColumn,
} from '@/shared/api/endpoints/callCenterReportsApi';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import {
  useGetSupervisorAccessScopeQuery,
  useGetTenantSettingsQuery,
} from '@/shared/api/endpoints/callCenterApi';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { AgentTimeline } from '@/features/callcenter/ui/AgentTimeline/AgentTimeline';
import { OperatorPicker, type OperatorOption } from '@/features/callcenter/ui/OperatorPicker';
import { ReportPeriodBar } from '@/features/callcenter/ui/ReportPeriodBar';
import { ReportCatalog } from '@/features/callcenter/ui/ReportCatalog';
import { ReportFilterChips, type ReportFilterChip } from '@/features/callcenter/ui/ReportFilterChips';
import { ReportExportMenu, type ReportExportFormat } from '@/features/callcenter/ui/ReportExportMenu';
import { ReportTable } from '@/features/callcenter/ui/ReportTable';
import { CallDetailSheet } from '@/features/callcenter/ui/CallDetailSheet';
import { generateReportPdf } from '@/features/callcenter/lib/reportPdf';
import { buildReportsSearch, parseReportsUrl, splitQueueNames } from '@/features/callcenter/lib/reportsUrlState';
import { presetRange, type DateRange } from '@/features/callcenter/lib/reportPeriod';
import { agentLabelWithExt } from '@/features/callcenter/lib/displayLabels';
import { REPORT_CATALOG, reportQuestionKey, reportSupportsAgent, reportSupportsQueue } from '@/features/callcenter/lib/reportCatalog';
import { formatReportValue, type ReportCellContext } from '@/features/callcenter/lib/reportCells';
import { resolveKpiThresholds } from '@/features/callcenter/lib/kpiThresholds';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import { buildCcSettingsPath } from '@/features/callcenter/lib/settingsUrlState';
import styles from './CallCenterReportsPage.module.scss';

type Row = Record<string, unknown>;

const PAGE_SIZE = 50;

function previousWindow(from: string, to: string): { from: string; to: string } {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  const days = Number.isFinite(start) && Number.isFinite(end) ? Math.max(1, Math.round((end - start) / 86_400_000) + 1) : 1;
  const prevEnd = new Date(start - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86_400_000);
  const fmt = (date: Date) => date.toISOString().slice(0, 10);
  return { from: fmt(prevStart), to: fmt(prevEnd) };
}

function downloadBlob(blob: Blob, filename: string): { url: string; filename: string } {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return { url, filename };
}

const HEATMAP_STEPS = [8, 25, 45, 70, 100] as const;

function heatmapIntensityPct(count: number, max: number): number {
  if (max <= 0 || count <= 0) return HEATMAP_STEPS[0];
  const ratio = count / max;
  const idx = Math.min(
    HEATMAP_STEPS.length - 1,
    Math.floor(ratio * HEATMAP_STEPS.length),
  );
  return HEATMAP_STEPS[Math.max(0, idx)];
}

export function CallCenterReportsPage() {
  const { t, i18n } = useTranslation();
  const [preparedDownload, setPreparedDownload] = useState<{ url: string; filename: string } | null>(null);
  const [exportError, setExportError] = useState(false);
  useEffect(() => () => {
    if (preparedDownload) setTimeout(() => URL.revokeObjectURL(preparedDownload.url), 60_000);
  }, [preparedDownload]);
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);
  const locale: 'ru' | 'en' = i18n.language?.startsWith('ru') ? 'ru' : 'en';
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters live in the URL: a dashboard drill-down or a shared link opens the same view.
  const [defaultRange] = useState(() => presetRange('7d'));
  const [initial] = useState(() =>
    parseReportsUrl(searchParams, { dateFrom: defaultRange.from, dateTo: defaultRange.to }),
  );
  const [reportId, setReportId] = useState<CcReportId>(initial.reportId);
  const [range, setRange] = useState<DateRange>({ from: initial.dateFrom, to: initial.dateTo });
  const [queueName, setQueueName] = useState(initial.queueName);
  const [agentInterface, setAgentInterface] = useState(initial.agentInterface);
  const [operatorUserId, setOperatorUserId] = useState(initial.operatorUserId);
  const [compare, setCompare] = useState(initial.compare);
  const [groupBy, setGroupBy] = useState(initial.groupBy);
  const [kind, setKind] = useState<'' | 'rna'>('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [callRow, setCallRow] = useState<Row | null>(null);
  const [pageState, setPageState] = useState<{ key: string; page: number }>({ key: '', page: 0 });

  useEffect(() => {
    const next = buildReportsSearch({
      reportId,
      dateFrom: range.from,
      dateTo: range.to,
      queueName,
      agentInterface,
      operatorUserId,
      compare,
      groupBy,
    });
    if (next !== searchParams.toString()) setSearchParams(new URLSearchParams(next), { replace: true });
  }, [reportId, range, queueName, agentInterface, operatorUserId, compare, groupBy, searchParams, setSearchParams]);

  const { data: queues = [] } = useGetQueuesQuery();
  const { data: accessScope } = useGetSupervisorAccessScopeQuery();
  const { data: tenantSettings } = useGetTenantSettingsQuery();

  const operators = useMemo<OperatorOption[]>(
    () => (accessScope?.candidates ?? []).map((c) => ({
      userId: c.userId, name: c.name, exten: c.exten, interface: c.interface,
    })),
    [accessScope],
  );

  const selectedOperator = useMemo(
    () => operators.find((o) => String(o.userId) === operatorUserId)
      ?? (agentInterface ? operators.find((o) => o.interface === agentInterface) : undefined),
    [operators, operatorUserId, agentInterface],
  );
  /** The interface sent to the server: the picked operator's, else a raw one from a legacy link. */
  const supportsAgent = reportSupportsAgent(reportId);
  const supportsQueue = reportSupportsQueue(reportId);
  const effectiveInterface = supportsAgent ? (selectedOperator?.interface ?? agentInterface) : '';
  const appliedQueueName = supportsQueue ? queueName : '';

  const queueOptions = useMemo(
    () => queues.map((q) => ({ name: q.name, displayName: q.display_name || q.name, exten: q.exten })),
    [queues],
  );
  const queueLabel = useCallback(
    (name: string) => queueDisplayName(name, queueOptions),
    [queueOptions],
  );
  const operatorLabel = useCallback(
    (o: OperatorOption) => (o.exten ? `${o.name} (${o.exten})` : o.name),
    [],
  );
  const agentLabel = useCallback(
    (iface: string) => {
      const o = operators.find((x) => x.interface === iface);
      return o ? operatorLabel(o) : agentLabelWithExt({ interface: iface, name: iface });
    },
    [operators, operatorLabel],
  );

  const thresholds = useMemo(
    () => resolveKpiThresholds(tenantSettings?.alert_thresholds),
    [tenantSettings],
  );


  const isTimeline = reportId === 'agent-timeline';
  const isHeatmap = reportId === 'hourly-heatmap';
  const isCallList = reportId === 'call-detail' || reportId === 'missed-callback';
  const aggregate = REPORT_CATALOG.find((r) => r.id === reportId)?.aggregate ?? false;
  const serverPaged = reportId === 'call-detail';

  const filterKey = `${reportId}|${range.from}|${range.to}|${queueName}|${effectiveInterface}`;
  const page = pageState.key === filterKey ? pageState.page : 0;

  const queryParams = useMemo(() => ({
    reportId,
    dateFrom: range.from,
    dateTo: range.to,
    ...(appliedQueueName ? { queueName: appliedQueueName } : {}),
    ...(operatorUserId ? { agentUserUid: operatorUserId } : {}),
    ...(!operatorUserId && effectiveInterface ? { agentInterface: effectiveInterface } : {}),
    ...(reportId === 'operator-stats' && groupBy ? { groupBy } : {}),
    ...(reportId === 'call-detail' && kind ? { kind } : {}),
    ...(serverPaged ? { page: page + 1, pageSize: PAGE_SIZE } : {}),
  }), [reportId, range, appliedQueueName, operatorUserId, effectiveInterface, groupBy, kind, serverPaged, page]);

  const timelineSkip = !isTimeline || !effectiveInterface;

  const {
    data: reportData,
    isLoading: reportLoading,
    isFetching: reportFetching,
    isError: reportError,
    refetch: refetchReport,
  } = useGetReportQuery(queryParams, { skip: isTimeline });

  const previousRange = previousWindow(range.from, range.to);
  const { data: previousData } = useGetReportQuery(
    compare === 'previous'
      ? { ...queryParams, dateFrom: previousRange.from, dateTo: previousRange.to }
      : queryParams,
    { skip: isTimeline || compare !== 'previous' || reportId !== 'operator-stats' },
  );

  const {
    data: timelineData,
    isLoading: timelineLoading,
    isFetching: timelineFetching,
    isError: timelineError,
    refetch: refetchTimeline,
  } = useGetAgentTimelineQuery(
    { agentInterface: effectiveInterface, date: range.from },
    { skip: timelineSkip },
  );

  const [triggerExport, { isFetching: isExporting }] = useLazyExportReportQuery();

  const activeData = isTimeline ? timelineData : reportData;
  const ctx = useMemo<ReportCellContext>(
    () => ({ timezone: activeData?.timezone, locale, t: t as ReportCellContext['t'], agentLabel, queueLabel, thresholds }),
    [activeData?.timezone, locale, t, agentLabel, queueLabel, thresholds],
  );
  const isLoading = isTimeline ? timelineLoading : reportLoading;
  const isFetching = isTimeline ? timelineFetching : reportFetching;
  const isError = isTimeline ? timelineError : reportError;
  const refetch = isTimeline ? refetchTimeline : refetchReport;

  const rows = useMemo(() => (activeData?.rows ?? []) as Row[], [activeData]);
  const columns = useMemo<ReportColumn[]>(() => activeData?.columns ?? [], [activeData]);
  const hasRows = rows.length > 0;
  const exportDisabled = isLoading || isFetching || !hasRows || isExporting || pdfBusy
    || (isTimeline && !effectiveInterface);

  const heatmapRows = useMemo(
    () => (isHeatmap ? (rows as unknown as HourlyHeatmapRow[]) : []),
    [isHeatmap, rows],
  );

  const maxHeat = useMemo(() => {
    let m = 0;
    for (const r of heatmapRows) m = Math.max(m, Number(r.callCount) || 0);
    return m || 1;
  }, [heatmapRows]);

  const heatLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of heatmapRows) {
      map.set(`${r.dayOfWeek}-${r.hour}`, Number(r.callCount) || 0);
    }
    return map;
  }, [heatmapRows]);

  const timelineSegments = useMemo(() => {
    if (!isTimeline || !timelineData?.rows?.[0]) return [];
    return timelineData.rows[0].segments ?? [];
  }, [isTimeline, timelineData]);

  const dayLabels = useMemo(
    () => [
      t('callcenter.reports.days.sun'),
      t('callcenter.reports.days.mon'),
      t('callcenter.reports.days.tue'),
      t('callcenter.reports.days.wed'),
      t('callcenter.reports.days.thu'),
      t('callcenter.reports.days.fri'),
      t('callcenter.reports.days.sat'),
    ],
    [t],
  );

  // ─── Filters ──────────────────────────────────────────────────
  const pickOperator = useCallback((userId: string) => {
    setOperatorUserId(userId);
    setAgentInterface('');
  }, []);

  const resetAll = useCallback(() => {
    setQueueName('');
    setAgentInterface('');
    setOperatorUserId('');
    setRange(presetRange('7d'));
  }, []);

  const chips = useMemo<ReportFilterChip[]>(() => {
    const out: ReportFilterChip[] = [];
    const selectedQueues = splitQueueNames(appliedQueueName);
    for (const name of selectedQueues) {
      const known = queues.length === 0 || queues.some((q) => q.name === name);
      out.push({
        id: selectedQueues.length === 1 ? 'queue' : `queue-${name}`,
        label: `${t('callcenter.reports.filters.queue')}: ${queueLabel(name)}`,
        warning: known ? undefined : t('callcenter.reports.chips.unknownQueue', 'This queue is not in the list of queues.'),
        onRemove: () => setQueueName(selectedQueues.filter((item) => item !== name).join(',')),
      });
    }
    if (effectiveInterface) {
      const unknown = !selectedOperator && operators.length > 0;
      out.push({
        id: 'operator',
        label: `${t('callcenter.reports.filters.agent')}: ${selectedOperator ? operatorLabel(selectedOperator) : effectiveInterface}`,
        warning: unknown
          ? t('callcenter.reports.chips.unknownAgent', 'This operator is not among the operators you can see; the report is still filtered by it.')
          : undefined,
        onRemove: () => {
          setAgentInterface('');
          setOperatorUserId('');
        },
      });
    }
    return out;
  }, [appliedQueueName, effectiveInterface, selectedOperator, operators.length, queues, queueLabel, operatorLabel, t]);

  // ─── Drill-down ───────────────────────────────────────────────
  const drillToOperator = useCallback((row: Row, target: CcReportId, nextKind: '' | 'rna' = '') => {
    const userId = row.agentUserUid != null && Number(row.agentUserUid) > 0 ? String(row.agentUserUid) : '';
    const iface = String(row.agentInterface ?? '');
    if (!userId && !iface) return;
    if (userId) {
      setOperatorUserId(userId);
      setAgentInterface('');
    } else {
      const known = operators.find((o) => o.interface === iface);
      if (known) {
        setOperatorUserId(String(known.userId));
        setAgentInterface('');
      } else {
        setOperatorUserId('');
        setAgentInterface(iface);
      }
    }
    if (target === 'agent-timeline') setRange((r) => ({ from: r.to, to: r.to }));
    setKind(nextKind);
    setReportId(target);
  }, [operators]);

  const handleRowActivate = useCallback((row: Row) => {
    switch (reportId) {
      case 'queue-summary':
        if (row.queueName) {
          setQueueName(String(row.queueName));
          setReportId('call-detail');
        }
        break;
      case 'operator-stats':
        drillToOperator(row, 'call-detail');
        break;
      case 'pause-report':
        drillToOperator(row, 'agent-timeline');
        break;
      case 'call-detail':
      case 'missed-callback':
        setCallRow(row);
        break;
      default:
        break;
    }
  }, [reportId, drillToOperator]);

  const openable = reportId !== 'hourly-heatmap' && reportId !== 'agent-timeline';

  const rowLabel = useCallback((row: Row) => {
    const parts = isCallList
      ? [row.callerIdName, row.callerIdNum, row.enterTime ?? row.createdAt]
      : [row.queueName ? queueLabel(String(row.queueName)) : '', row.agentInterface ? agentLabel(String(row.agentInterface)) : ''];
    return t('callcenter.reports.openRow', {
      label: parts.filter(Boolean).join(' '),
      defaultValue: 'Open {{label}}',
    });
  }, [isCallList, queueLabel, agentLabel, t]);

  const renderRowActions = useCallback((row: Row) => (
    <HStack gap="4">
      <Button type="button" variant="ghost" size="sm" data-testid="cc-report-row-timeline" onClick={() => drillToOperator(row, 'agent-timeline')}>
        {t('callcenter.reports.drill.timeline', 'Shift')}
      </Button>
      <Button type="button" variant="ghost" size="sm" data-testid="cc-report-row-pauses" onClick={() => drillToOperator(row, 'pause-report')}>
        {t('callcenter.reports.drill.pauses', 'Pauses')}
      </Button>
      <Button type="button" variant="ghost" size="sm" data-testid="cc-report-row-rna" onClick={() => drillToOperator(row, 'call-detail', 'rna')}>
        {t('callcenter.reports.drill.missed', 'Missed')}
      </Button>
    </HStack>
  ), [drillToOperator, t]);

  // ─── Export ───────────────────────────────────────────────────
  const handleServerExport = useCallback(async (format: 'csv' | 'xlsx') => {
    setExportError(false);
    try {
      const blob = await triggerExport({
        reportId,
        format,
        dateFrom: range.from,
        dateTo: isTimeline ? range.from : range.to,
        ...(appliedQueueName ? { queueName: appliedQueueName } : {}),
        ...(effectiveInterface ? { agentInterface: effectiveInterface } : {}),
      }).unwrap();
      setPreparedDownload(downloadBlob(blob, `cc_${reportId}_${range.from}_${isTimeline ? range.from : range.to}.${format}`));
    } catch {
      setExportError(true);
      toast.error(t('callcenter.reports.export.failed', 'Could not export the report. Try again.'));
    }
  }, [triggerExport, reportId, range, isTimeline, appliedQueueName, effectiveInterface, t]);

  const handlePdf = useCallback(async () => {
    if (!activeData || !hasRows) return;
    setExportError(false);
    setPdfBusy(true);
    try {
      const pdfRows = rows.map((row) => {
        const out: Row = {};
        for (const col of activeData.columns) {
          const v = row[col.key];
          if (col.key === 'segments' && Array.isArray(v)) out[col.key] = `${v.length} segments`;
          else out[col.key] = formatReportValue(col, v, ctx);
        }
        return out;
      });
      const blob = await generateReportPdf({
        title: t(reportQuestionKey(reportId), t(`callcenter.reports.ids.${reportId}`)),
        columns: activeData.columns.map((col) => ({ ...col, header: ctx.t(col.labelKey || '', col.header) })),
        rows: pdfRows,
        meta: {
          dateFrom: range.from,
          dateTo: isTimeline ? range.from : range.to,
          queueName: appliedQueueName ? splitQueueNames(appliedQueueName).map(queueLabel).join(', ') : undefined,
          timezone: activeData.timezone,
          agentInterface: effectiveInterface ? agentLabel(effectiveInterface) : undefined,
        },
      });
      setPreparedDownload(downloadBlob(blob, `cc_${reportId}_${range.from}_${isTimeline ? range.from : range.to}.pdf`));
    } catch {
      setExportError(true);
      toast.error(t('callcenter.reports.export.failed', 'Could not export the report. Try again.'));
    } finally {
      setPdfBusy(false);
    }
  }, [activeData, hasRows, rows, ctx, t, reportId, range, isTimeline, appliedQueueName, queueLabel, effectiveInterface, agentLabel]);

  const handleExport = useCallback((format: ReportExportFormat) => {
    if (exportDisabled) return;
    if (format === 'pdf') void handlePdf();
    else void handleServerExport(format);
  }, [exportDisabled, handlePdf, handleServerExport]);

  // ─── Content ──────────────────────────────────────────────────
  const sourceLabel = activeData?.source
    ? t(`callcenter.reports.sourceKind.${activeData.source}`, activeData.source)
    : null;

  const renderContent = () => {
    if (isTimeline && !effectiveInterface) {
      return (
        <div className={styles.emptyState}>
          <Inbox size={32} className="text-muted-foreground" />
          <Text className={styles.emptyTitle}>
            {t('callcenter.reports.timelineNeedAgent')}
          </Text>
          <Text className={styles.emptyBody}>
            {t('callcenter.reports.timelineNeedAgentBody')}
          </Text>
        </div>
      );
    }

    if (isLoading || isFetching) {
      return (
        <VStack gap="8" max>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-40 w-full" />
        </VStack>
      );
    }

    if (isError) {
      return (
        <QueryErrorState message={t('callcenter.reports.loadError')} onRetry={() => refetch()} retryLabel={t('callcenter.reports.retry')} />
      );
    }

    if (!hasRows) {
      return (
        <div className={styles.emptyState}>
          <Inbox size={32} className="text-muted-foreground" />
          <Text className={styles.emptyTitle}>
            {t('callcenter.reports.emptyTitle')}
          </Text>
          <Text className={styles.emptyBody}>
            {t('callcenter.reports.emptyBody')}
          </Text>
        </div>
      );
    }

    if (isHeatmap) {
      return (
        <div className={styles.heatmapWrap}>
          <div className={styles.heatmapGrid}>
            <div className={styles.heatmapCorner} />
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={`h-${hour}`} className={styles.heatmapHourLabel}>
                {hour}
              </div>
            ))}
            {Array.from({ length: 7 }, (_, dow) => (
              <Fragment key={`dow-${dow}`}>
                <div className={styles.heatmapDayLabel}>
                  {dayLabels[dow]}
                </div>
                {Array.from({ length: 24 }, (_, hour) => {
                  const count = heatLookup.get(`${dow}-${hour}`) ?? 0;
                  const pct = heatmapIntensityPct(count, maxHeat);
                  return (
                    <div
                      key={`${dow}-${hour}`}
                      className={styles.heatCell}
                      style={{
                        background: `color-mix(in srgb, var(--color-primary) ${pct}%, transparent)`,
                      }}
                      tabIndex={0}
                      aria-label={`${dayLabels[dow]} ${hour}:00 - ${count}`}
                      title={`${dayLabels[dow]} ${hour}:00 - ${count}`}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
          <ReportTable reportId={reportId} columns={columns} rows={rows} ctx={ctx} aggregate={false} mobile={isMobile} emptyText={t('callcenter.reports.emptyTitle')} />
        </div>
      );
    }

    if (isTimeline) {
      return (
        <div className={styles.timelineWrap}>
          <Text className={styles.metaLine}>
            {agentLabel(effectiveInterface)} · {range.from}
          </Text>
          <AgentTimeline
            segments={timelineSegments}
            date={range.from}
            periodStart={activeData?.periodStart}
            periodEnd={activeData?.periodEnd}
            timezone={activeData?.timezone}
            live={false}
          />
        </div>
      );
    }

    return (
      <ReportTable
        reportId={reportId}
        columns={columns}
        rows={rows}
        ctx={ctx}
        aggregate={aggregate}
        mobile={isMobile}
        onRowActivate={openable ? handleRowActivate : undefined}
        getRowLabel={openable ? rowLabel : undefined}
        renderRowActions={reportId === 'operator-stats' ? renderRowActions : undefined}
        previousRows={compare === 'previous' ? (previousData?.rows as Row[] | undefined) : undefined}
        server={serverPaged
          ? {
            total: reportData?.total ?? rows.length,
            page,
            pageSize: PAGE_SIZE,
            onPageChange: (next) => setPageState({ key: filterKey, page: next }),
          }
          : undefined}
        emptyText={t('callcenter.reports.emptyTitle')}
      />
    );
  };

  return (
    <VStack gap="16" max className={styles.wrapper} data-testid="cc-reports-responsive">
      <CcPageHeader
        title={t('callcenter.reports.title')}
        description={t('callcenter.reports.subtitle')}
        data="period"
      />

      <VStack gap="12" max className={styles.filterBar}>
        <Text variant="muted">{t('callcenter.reports.timezone', 'Report time zone')}: {activeData?.timezone || '…'}</Text>
        <ReportPeriodBar value={range} onChange={setRange} singleDay={isTimeline} locale={locale} />
        <div className={styles.filterRow}>
          {supportsQueue && (
            <div className={styles.filterField}>
              <Label>{t('callcenter.reports.filters.queue')}</Label>
              <MultiSelect
                ariaLabel={t('callcenter.reports.filters.queue')}
                value={splitQueueNames(queueName)}
                onChange={(names) => setQueueName(names.join(','))}
                options={[
                  ...splitQueueNames(queueName)
                    .filter((name) => !queues.some((q) => q.name === name))
                    .map((name) => ({ value: name, label: queueLabel(name) })),
                  ...queues.map((q) => ({ value: q.name, label: queueLabel(q.name) })),
                ]}
                placeholder={t('callcenter.reports.filters.queueAll')}
                searchable
                searchPlaceholder={t('callcenter.reports.filters.queueSearch', 'Queue name')}
              />
            </div>
          )}
          {supportsAgent && <div className={styles.filterField}>
            <Label htmlFor="cc-report-operator">{t('callcenter.reports.filters.agent')}</Label>
            {operators.length > 0 ? (
              <OperatorPicker
                id="cc-report-operator"
                operators={operators}
                value={selectedOperator ? String(selectedOperator.userId) : ''}
                onChange={pickOperator}
                placeholder={t('callcenter.reports.filters.agentAll')}
              />
            ) : (
              <Input
                id="cc-report-operator"
                value={agentInterface}
                onChange={(e) => {
                  setAgentInterface(e.target.value);
                  setOperatorUserId('');
                }}
                placeholder={t('callcenter.reports.filters.agentPlaceholder')}
              />
            )}
          </div>}
        </div>
        {((!supportsAgent && (agentInterface || operatorUserId)) || (!supportsQueue && queueName)) && <Text variant="muted" role="status">{t('callcenter.reports.unsupportedFilters', 'This report uses only the filters shown above. Other selected filters are not applied.')}</Text>}
        <ReportFilterChips chips={chips} onResetAll={resetAll} />
        {reportId === 'operator-stats' && (
          <HStack gap="8" wrap="wrap">
            <Button type="button" variant={compare === 'previous' ? 'default' : 'outline'} size="sm" onClick={() => setCompare((value) => value === 'previous' ? '' : 'previous')} data-testid="cc-report-compare">
              {t('callcenter.reports.compare.previous', 'Compare with the previous period')}
            </Button>
            {(['' , 'day', 'queue'] as const).map((value) => (
              <Button key={value || 'person'} type="button" variant={groupBy === value ? 'default' : 'outline'} size="sm" onClick={() => setGroupBy(value)} data-testid={`cc-report-group-${value || 'person'}`}>
                {t(`callcenter.reports.group.${value || 'person'}`, value || 'person')}
              </Button>
            ))}
          </HStack>
        )}
        {activeData?.periodClamped ? <Text role="status">{t('callcenter.reports.periodClamped', 'The period was shortened to the maximum of 366 days.')}</Text> : null}
      </VStack>

      <div className={styles.layout}>
        <ReportCatalog value={reportId} onChange={setReportId} compact={isMobile} />

        <div className={styles.contentCard}>
          <HStack justify="between" align="center" wrap="wrap" gap="8">
            <HStack gap="8" align="center" wrap="wrap">
              <BarChart3 size={18} className="text-muted-foreground" aria-hidden="true" />
              <Text className={styles.contentTitle}>
                {t(reportQuestionKey(reportId), t(`callcenter.reports.ids.${reportId}`))}
              </Text>
              {sourceLabel ? (
                <Badge
                  variant="outline"
                  title={t(`callcenter.reports.sourceHint.${activeData?.source}`, '')}
                  data-testid="cc-report-source"
                >
                  {sourceLabel}
                </Badge>
              ) : null}
              {activeData?.total != null && !isTimeline ? (
                <Text className={styles.metaLine}>
                  {t('callcenter.reports.rowsTotal', { count: activeData.total, defaultValue: 'Rows: {{count}}' })}
                </Text>
              ) : null}
            </HStack>
            <ReportExportMenu
              disabled={exportDisabled}
              busy={isExporting || pdfBusy}
              onExport={handleExport}
              onSchedule={() => navigate(buildCcSettingsPath('reportSchedules'))}
            />
          </HStack>
          {exportError && <Text role="alert" className="text-destructive">{t('callcenter.reports.export.failed', 'Could not export the report. Try again.')}</Text>}
          {preparedDownload && (
            <HStack gap="8" wrap="wrap" role="status" className="text-sm" data-testid="cc-report-download-ready">
              <Text variant="muted">{t('callcenter.reports.export.ready', 'File ready. If the download did not start, use the link:')}</Text>
              <a href={preparedDownload.url} download={preparedDownload.filename} className="underline break-all">
                {preparedDownload.filename}
              </a>
            </HStack>
          )}
          {renderContent()}
        </div>
      </div>

      <CallDetailSheet
        open={callRow !== null}
        onOpenChange={(open) => { if (!open) setCallRow(null); }}
        row={callRow}
        columns={columns}
        ctx={ctx}
      />
    </VStack>
  );
}
