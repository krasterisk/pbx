import { CallReportSkeleton } from './CallReportSkeleton';
import { boundedCallPeriod } from '../model/callPeriod';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardChart } from '@/shared/ui/DashboardChart/DashboardChart';
import { DistributionChart } from '@/shared/ui/DistributionChart/DistributionChart';
import { Meter } from '@/shared/ui/Meter/Meter';
import { downloadBlob } from '@/shared/lib/downloadBlob';
import { Link } from 'react-router-dom';
import type { CallsQuery } from '@krasterisk/shared';
import { useTranslation } from 'react-i18next';
import { useGetCompanyCallsOverviewQuery } from '@/shared/api/endpoints/callsApi';
import { Button, Flex, QueryErrorState, Text, VStack, InfoTooltip, Tooltip } from '@/shared/ui';
import { RefreshCw } from 'lucide-react';
import { callTime } from '../model/callsUrl';
import { CallBreakdowns, CallMetricLink, cohortHref } from './CallBreakdowns';
import { CallHeatmap } from './CallHeatmap';
import cls from './Calls.module.scss';

export function CallsOverview({
  query: originalQuery,
  timezone='UTC',
  periodHref,
}: {
  query: CallsQuery; timezone?:string;
  periodHref: (from: string, to: string) => string;
}) {
  const bounded=useMemo(()=>boundedCallPeriod(originalQuery,timezone,366),[originalQuery,timezone]);
  const query=bounded.query;
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'charts'|'tables'>('charts');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const {
    currentData: data,
    isFetching,
    isError,
    refetch,
  } = useGetCompanyCallsOverviewQuery(query,{skip:bounded.invalid,refetchOnMountOrArgChange:true});
  useEffect(() => {
    if (!data || data.source.state === 'ok' || isFetching || isError || bounded.invalid) return;
    const timer = setTimeout(() => void refetch(), 15000);
    return () => clearTimeout(timer);
  }, [data, isFetching, isError, bounded.invalid, refetch]);
  if (isError)
    return (
      <VStack gap="8" align="stretch">
        <Text>{t('calls.overviewRange')}</Text>
        <QueryErrorState onRetry={() => void refetch()} />
      </VStack>
    );
  if (!data || isFetching || data.source.message==='historyBackfillInProgress')return <CallReportSkeleton/>;
  if(data.source.state!=='ok')return <QueryErrorState message={t('calls.historyUnavailable')} onRetry={()=>void refetch()}/>;
  const metrics = [
    'total',
    'human',
    'robot',
    'voicemail',
    'menu',
    'missed',
    'error',
    'unknown',
    ...(data.summary.active > 0 ? (['active'] as const) : []),
  ] as const;
  const zonedTime = (at: string) => new Intl.DateTimeFormat(i18n.language,{timeZone:data.timezone,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(at));
  const range = (from: string, to: string) => `${zonedTime(from)} - ${zonedTime(to)}`;
  const colors = ['var(--color-primary)','var(--color-success)','var(--color-warning)','var(--color-muted-foreground)','var(--color-destructive)'];
  const accepted = (data.summary.human || 0) + (data.summary.robot || 0);
  const automation = accepted ? Math.round(data.summary.robot / accepted * 100) + '%' : '-';
  const exportPdf = async () => {
    setExporting(true); setExportError(false);
    try {
      const { generateReportSnapshotPdf } = await import('@/shared/lib/pdf/ReportSnapshotPdf');
      const blob = await generateReportSnapshotPdf({
        title:t('calls.overviewTitle'),period:range(data.period.from,data.period.to),timezone:data.timezone,
        updatedAt:data.dataAsOf ? callTime(data.dataAsOf,data.timezone,i18n.language) : '-',
        note: data.source.state !== 'ok' ? t('calls.sourcePartial') : undefined,
        metrics:[...metrics.map(key=>({label:t(key==='total'?'calls.overviewTotal':key==='human'?'calls.overviewHuman':`calls.outcome.${key}`),value:data.summary[key] ?? 0})),{label:t('calls.automation'),value:automation}],
        buckets:data.buckets.map(bucket=>({...bucket,robot:bucket.robot ?? 0,label:range(bucket.from,bucket.to)})),
        legend:{total:t('calls.overviewTotal'),human:t('calls.overviewHuman'),robot:t('calls.outcome.robot'),missed:t('calls.outcome.missed')},
      });
      downloadBlob(blob,'calls-overview.pdf');
    } catch { setExportError(true); } finally { setExporting(false); }
  };
  return (
    <VStack gap="16" align="stretch" data-testid="calls-overview">
      {bounded.limited && <Text role="status" className={cls.notice}>{t('calls.periodLimited',{days:366})}</Text>}
      <Flex justify="between" wrap="wrap" gap="8">
        <Text>{range(data.period.from, data.period.to)}<InfoTooltip text={t('calls.overviewCohort')}/></Text>
        <Tooltip content={t('calls.overviewRefresh')}><Button variant="ghost" size="icon" aria-label={t('calls.overviewRefresh')} onClick={() => void refetch()}><RefreshCw size={16}/></Button></Tooltip>
      </Flex>
      {data.source.state !== 'ok' && (
        <Text className={cls.notice}>{t('calls.sourcePartial')}</Text>
      )}
      <Flex gap="8" wrap="wrap" align="center">
        <Button size="sm" variant={mode==='charts'?'secondary':'outline'} aria-pressed={mode==='charts'} onClick={()=>setMode('charts')}>{t('calls.charts')}</Button>
        <Button size="sm" variant={mode==='tables'?'secondary':'outline'} aria-pressed={mode==='tables'} onClick={()=>setMode('tables')}>{t('calls.tables')}</Button>
        <Button size="sm" variant="outline" disabled={exporting} onClick={()=>void exportPdf()}>{t('calls.exportPdf')}</Button>
      </Flex>
      {exportError && <Text role="alert">{t('calls.exportError')}</Text>}
      {exporting && <Text role="status" className={cls.loadingNotice}>{t('calls.exporting')}</Text>}
      <Flex className={cls.summary}>
        {metrics.filter(key => mode === 'tables' || ['total','human','robot','missed'].includes(key)).map((key) => (
          <VStack key={key} gap="8" align="stretch" className={cls.metric}>
            <Text>
              {t(
                key === 'total'
                  ? 'calls.overviewTotal'
                  : key === 'human'
                    ? 'calls.overviewHuman'
                    : `calls.outcome.${key}`,
              )}
            </Text>
            <Text variant="h2">
              <CallMetricLink
                query={query}
                outcome={key === 'total' ? undefined : key}
                value={data.summary[key]}
              />
            </Text>
            <Text variant="muted">
              {t('calls.overviewPrevious', {
                count: data.previous[key],
                delta: `${data.summary[key] - data.previous[key] >= 0 ? '+' : ''}${data.summary[key] - data.previous[key]}`,
              })}
            </Text>
          </VStack>
        ))}
      </Flex>
      <Text variant="muted">
        {t('calls.overviewComparison')}:{' '}
        {range(data.previousPeriod.from, data.previousPeriod.to)}
      </Text>
      {mode === 'charts' && <VStack gap="16" align="stretch">
        <Flex gap="8" align="center"><Text>{t('calls.automation')}: {automation}</Text><InfoTooltip text={t('calls.automationHint')}/></Flex>
        <DistributionChart label={t('calls.result')} segments={['human','robot','missed','unknown','error'].map((key,index)=>({key,label:t(`calls.outcome.${key}`),value:data.summary[key as 'human'] ?? 0,color:colors[index]})).concat(['voicemail','menu'].map(key=>({key,label:t(`calls.outcome.${key}`),value:data.summary[key as 'menu'] ?? 0,color:'var(--color-muted-foreground)'})))} onSelect={key=>{
          navigate(cohortHref(query, {focusOutcome:key}));
        }}/>
        <DashboardChart label={t('calls.overviewTimeline')} points={data.buckets.map(bucket=>({at:bucket.from,total:bucket.total,human:bucket.human,robot:bucket.robot ?? 0,missed:bucket.missed}))}
          series={['total','human','robot','missed'].map((key,index)=>({key,label:t(key === 'total' ? 'calls.overviewTotal' : `calls.outcome.${key}`),color:colors[index]}))}
          showLegend formatTime={at=>callTime(at,data.timezone,i18n.language)} onPoint={at=>{const bucket=data.buckets.find(item=>item.from===at);if(bucket)navigate(periodHref(bucket.from,bucket.to));}} />
      </VStack>}
      <Flex gap="4" align="center"><Text variant="h3">{t('calls.overviewTimeline')}</Text><InfoTooltip text={t(data.calendar ? 'calls.overviewCalendarIntervals' : 'calls.overviewIntervals')}/></Flex>
      <VStack gap="8" align="stretch" className={mode === 'charts' ? cls.visuallyHidden : cls.overviewBuckets}>
        {data.buckets.map((bucket) => {
          const contents = (
            <>
              <Text as="span">{range(bucket.from, bucket.to)}</Text>
              <Meter
                className={cls.overviewMeter}
                min={0}
                max={Math.max(1, ...data.buckets.map((b) => b.total))}
                value={bucket.total}
                aria-label={t('calls.overviewTotal')}
              />
              <Text as="span">{t('calls.overviewBucketCounts', bucket)}</Text>
            </>
          );
          return bucket.total ? (
            <Button
              key={bucket.from}
              variant="outline"
              className={cls.overviewBucket}
              asChild
            >
              <Link to={periodHref(bucket.from, bucket.to)}>{contents}</Link>
            </Button>
          ) : (
            <Button
              key={bucket.from}
              variant="outline"
              className={cls.overviewBucket}
              disabled
            >
              {contents}
            </Button>
          );
        })}
      </VStack>
      {!!data.calendar?.days.length && <CallHeatmap key={`${data.period.from}:${data.period.to}:${data.timezone}`} days={data.calendar.days} periodHref={periodHref} />}
      {!!data.breakdowns?.length && (
        <CallBreakdowns data={data.breakdowns} query={query} />
      )}
      <Text variant="muted">
        {t('calls.updatedAt')}:{' '}
        {data.dataAsOf
          ? callTime(data.dataAsOf, data.timezone, i18n.language)
          : '-'}
      </Text>
    </VStack>
  );
}
