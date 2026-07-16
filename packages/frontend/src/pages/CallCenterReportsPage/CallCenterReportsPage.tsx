import { Fragment, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { BarChart3, Inbox } from 'lucide-react';
import {
  VStack, Flex, Text, Button, Input, Select, DataTable, Skeleton,
} from '@/shared/ui';
import {
  CC_REPORT_IDS,
  useGetReportQuery,
  useGetAgentTimelineQuery,
  useLazyExportReportQuery,
  type CcReportId,
  type HourlyHeatmapRow,
  type ReportColumn,
} from '@/shared/api/endpoints/callCenterReportsApi';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import { AgentTimeline } from '@/features/callcenter/ui/AgentTimeline/AgentTimeline';
import { generateReportPdf } from '@/features/callcenter/lib/reportPdf';
import styles from './CallCenterReportsPage.module.scss';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function flattenRowsForPdf(
  columns: ReportColumn[],
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const col of columns) {
      const v = row[col.key];
      if (col.key === 'segments' && Array.isArray(v)) {
        out[col.key] = `${v.length} segments`;
      } else if (v != null && typeof v === 'object') {
        out[col.key] = JSON.stringify(v);
      } else {
        out[col.key] = v;
      }
    }
    return out;
  });
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
  const { t } = useTranslation();
  const [reportId, setReportId] = useState<CcReportId>('queue-summary');
  const [dateFrom, setDateFrom] = useState(() => daysAgoIso(7));
  const [dateTo, setDateTo] = useState(() => todayIso());
  const [queueName, setQueueName] = useState('');
  const [agentInterface, setAgentInterface] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  const { data: queues = [] } = useGetQueuesQuery();

  const isTimeline = reportId === 'agent-timeline';
  const isHeatmap = reportId === 'hourly-heatmap';

  const queryParams = useMemo(() => ({
    reportId,
    dateFrom,
    dateTo,
    ...(queueName ? { queueName } : {}),
    ...(agentInterface ? { agentInterface } : {}),
  }), [reportId, dateFrom, dateTo, queueName, agentInterface]);

  const timelineSkip = !isTimeline || !agentInterface;
  const reportSkip = isTimeline;

  const {
    data: reportData,
    isLoading: reportLoading,
    isFetching: reportFetching,
    isError: reportError,
    refetch: refetchReport,
  } = useGetReportQuery(queryParams, { skip: reportSkip });

  const {
    data: timelineData,
    isLoading: timelineLoading,
    isFetching: timelineFetching,
    isError: timelineError,
    refetch: refetchTimeline,
  } = useGetAgentTimelineQuery(
    { agentInterface, date: dateFrom },
    { skip: timelineSkip },
  );

  const [triggerExport, { isFetching: isExporting }] = useLazyExportReportQuery();

  const activeData = isTimeline ? timelineData : reportData;
  const isLoading = isTimeline ? timelineLoading : reportLoading;
  const isFetching = isTimeline ? timelineFetching : reportFetching;
  const isError = isTimeline ? timelineError : reportError;
  const refetch = isTimeline ? refetchTimeline : refetchReport;

  const rows = (activeData?.rows ?? []) as Record<string, unknown>[];
  const columns = activeData?.columns ?? [];
  const hasRows = rows.length > 0;
  const exportDisabled = isLoading || isFetching || !hasRows || isExporting || pdfBusy
    || (isTimeline && !agentInterface);

  const tableColumns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () => columns.map((col) => ({
      id: col.key,
      accessorFn: (row) => {
        const v = row[col.key];
        if (v != null && typeof v === 'object') return JSON.stringify(v);
        return v ?? '';
      },
      header: col.header,
      cell: (info) => String(info.getValue() ?? ''),
    })),
    [columns],
  );

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

  const handleExport = useCallback(async (format: 'csv' | 'xlsx') => {
    if (isLoading || isFetching || !hasRows || (isTimeline && !agentInterface)) return;
    try {
      const blob = await triggerExport({
        reportId,
        format,
        dateFrom,
        dateTo: isTimeline ? dateFrom : dateTo,
        ...(queueName ? { queueName } : {}),
        ...(agentInterface ? { agentInterface } : {}),
      }).unwrap();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `cc_${reportId}_${stamp}.${format}`);
    } catch (e) {
      console.error('CC report export failed', e);
    }
  }, [
    isLoading, isFetching, hasRows, triggerExport, reportId, dateFrom, dateTo,
    queueName, agentInterface, isTimeline,
  ]);

  const handleExportPdf = useCallback(async () => {
    if (!activeData || !hasRows) return;
    setPdfBusy(true);
    try {
      const title = t(`callcenter.reports.ids.${reportId}`);
      const blob = await generateReportPdf({
        title,
        columns: activeData.columns,
        rows: flattenRowsForPdf(
          activeData.columns,
          rows,
        ),
        meta: {
          dateFrom,
          dateTo: isTimeline ? dateFrom : dateTo,
          queueName: queueName || undefined,
          agentInterface: agentInterface || undefined,
        },
      });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `cc_${reportId}_${stamp}.pdf`);
    } catch (e) {
      console.error('CC report PDF failed', e);
    } finally {
      setPdfBusy(false);
    }
  }, [
    activeData, hasRows, t, reportId, rows, dateFrom, dateTo,
    queueName, agentInterface, isTimeline,
  ]);

  const renderContent = () => {
    if (isTimeline && !agentInterface) {
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
        <div className={styles.errorState}>
          <Text className={styles.emptyTitle}>
            {t('callcenter.reports.loadError')}
          </Text>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t('callcenter.reports.retry')}
          </Button>
        </div>
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
                      title={`${dayLabels[dow]} ${hour}:00 - ${count}`}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      );
    }

    if (isTimeline) {
      return (
        <div className={styles.timelineWrap}>
          <Text className={styles.metaLine}>
            {agentInterface} · {dateFrom}
          </Text>
          <AgentTimeline
            segments={timelineSegments}
            date={dateFrom}
            live={false}
          />
        </div>
      );
    }

    return (
      <DataTable<Record<string, unknown>>
        data={rows}
        columns={tableColumns}
        getRowId={(row) => String(
          row.uid
          ?? row.callUniqueid
          ?? row.agentInterface
          ?? row.queueName
          ?? JSON.stringify(row),
        )}
        emptyText={t('callcenter.reports.emptyTitle')}
        pageSize={50}
      />
    );
  };

  return (
    <VStack gap="16" max className={styles.wrapper}>
      <VStack gap="4">
        <Flex align="center" gap="12">
          <Flex
            align="center"
            justify="center"
            className="p-2.5 rounded-xl"
            style={{
              background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
            }}
          >
            <BarChart3 size={24} style={{ color: 'var(--color-primary)' }} />
          </Flex>
          <VStack gap="4">
            <Text
              variant="h1"
              className="text-lg sm:text-2xl bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent"
            >
              {t('callcenter.reports.title')}
            </Text>
            <Text className={styles.subtitle}>
              {t('callcenter.reports.subtitle')}
            </Text>
          </VStack>
        </Flex>
      </VStack>

      <div className={styles.filterBar}>
        <div className={styles.filterField}>
          <span className={styles.filterLabel}>
            {t('callcenter.reports.filters.dateFrom')}
          </span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        {!isTimeline && (
          <div className={styles.filterField}>
            <span className={styles.filterLabel}>
              {t('callcenter.reports.filters.dateTo')}
            </span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        )}
        <div className={styles.filterField}>
          <span className={styles.filterLabel}>
            {t('callcenter.reports.filters.queue')}
          </span>
          <Select
            value={queueName}
            onChange={(e) => setQueueName(e.target.value)}
          >
            <option value="">{t('callcenter.reports.filters.queueAll')}</option>
            {queues.map((q) => (
              <option key={q.name} value={q.name}>{q.name}</option>
            ))}
          </Select>
        </div>
        <div className={styles.filterField}>
          <span className={styles.filterLabel}>
            {t('callcenter.reports.filters.agent')}
          </span>
          <Input
            value={agentInterface}
            onChange={(e) => setAgentInterface(e.target.value)}
            placeholder={t('callcenter.reports.filters.agentPlaceholder')}
          />
        </div>
      </div>

      <div className={styles.layout}>
        <nav className={styles.reportNav} aria-label={t('callcenter.reports.navLabel')}>
          {CC_REPORT_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`${styles.reportTab} ${reportId === id ? styles.reportTabActive : ''}`}
              onClick={() => setReportId(id)}
            >
              {t(`callcenter.reports.ids.${id}`)}
            </button>
          ))}
        </nav>

        <div className={styles.contentCard}>
          <div className={styles.exportBar}>
            <Button
              variant="outline"
              size="sm"
              disabled={exportDisabled}
              onClick={() => handleExport('csv')}
            >
              {t('callcenter.reports.exportCsv')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exportDisabled}
              onClick={() => handleExport('xlsx')}
            >
              {t('callcenter.reports.exportXlsx')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exportDisabled}
              onClick={() => handleExportPdf()}
            >
              {t('callcenter.reports.exportPdf')}
            </Button>
          </div>
          {activeData?.source && (
            <Text className={styles.metaLine}>
              {t('callcenter.reports.source')}: {activeData.source}
              {activeData.total != null ? ` · ${activeData.total}` : ''}
            </Text>
          )}
          {renderContent()}
        </div>
      </div>
    </VStack>
  );
}
