import { Link } from 'react-router-dom';
import type { CallsQuery } from '@krasterisk/shared';
import { useTranslation } from 'react-i18next';
import { useGetCompanyCallsOverviewQuery } from '@/shared/api/endpoints/callsApi';
import { Button, Flex, QueryErrorState, Text, VStack, InfoTooltip, Tooltip } from '@/shared/ui';
import { RefreshCw } from 'lucide-react';
import { callTime } from '../model/callsUrl';
import { CallBreakdowns, CallMetricLink } from './CallBreakdowns';
import { CallHeatmap } from './CallHeatmap';
import cls from './Calls.module.scss';

export function CallsOverview({
  query,
  periodHref,
}: {
  query: CallsQuery;
  periodHref: (from: string, to: string) => string;
}) {
  const { t, i18n } = useTranslation();
  const {
    currentData: data,
    isFetching,
    isError,
    refetch,
  } = useGetCompanyCallsOverviewQuery(query);
  if (isError)
    return (
      <VStack gap="8" align="stretch">
        <Text>{t('calls.overviewRange')}</Text>
        <QueryErrorState onRetry={() => void refetch()} />
      </VStack>
    );
  if (data?.source.state === 'unavailable')
    return (
      <QueryErrorState
        message={t('calls.sourceUnavailable')}
        onRetry={() => void refetch()}
      />
    );
  if (!data || isFetching)
    return <Text role="status">{t('calls.overviewLoading')}</Text>;
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
  const zone = new Intl.DateTimeFormat('en', { timeZone: data.timezone, timeZoneName: 'longOffset' });
  const offset = (value: string) => zone.formatToParts(new Date(value)).find(part => part.type === 'timeZoneName')!.value.replace('GMT', 'UTC');
  const range = (from: string, to: string) => {
    const startOffset = offset(from), endOffset = offset(to);
    const start = callTime(from, data.timezone, i18n.language), end = callTime(to, data.timezone, i18n.language);
    return startOffset === endOffset ? `${start} — ${end} (${startOffset})` : `${start} (${startOffset}) — ${end} (${endOffset})`;
  };
  return (
    <VStack gap="16" align="stretch" data-testid="calls-overview">
      <Flex justify="between" wrap="wrap" gap="8">
        <Text>{range(data.period.from, data.period.to)}<InfoTooltip text={t('calls.overviewCohort')}/></Text>
        <Tooltip content={t('calls.overviewRefresh')}><Button variant="ghost" size="icon" aria-label={t('calls.overviewRefresh')} onClick={() => void refetch()}><RefreshCw size={16}/></Button></Tooltip>
      </Flex>
      {data.source.state !== 'ok' && (
        <Text className={cls.notice}>{t('calls.sourcePartial')}</Text>
      )}
      <Flex className={cls.summary}>
        {metrics.map((key) => (
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
      <Text variant="h3">{t('calls.overviewTimeline')}</Text>
      <Text variant="muted">{t(data.calendar ? 'calls.overviewCalendarIntervals' : 'calls.overviewIntervals')}</Text>
      <VStack gap="8" align="stretch" className={cls.overviewBuckets}>
        {data.buckets.map((bucket) => {
          const contents = (
            <>
              <Text as="span">{range(bucket.from, bucket.to)}</Text>
              <meter
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
          : '—'}
      </Text>
    </VStack>
  );
}
