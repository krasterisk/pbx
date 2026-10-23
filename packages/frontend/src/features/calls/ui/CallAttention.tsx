import { CallReportSkeleton } from './CallReportSkeleton';
import { boundedCallPeriod } from '../model/callPeriod';
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCheck, PhoneMissed, RefreshCw } from 'lucide-react';
import type { CallsQuery } from '@krasterisk/shared';
import { useGetCompanyCallsAttentionQuery } from '@/shared/api/endpoints/callsApi';
import { callsParams } from '@/shared/lib/callsQueryParams';
import {
  Badge,
  Button,
  Flex,
  QueryErrorState,
  Text,
  VStack,
  InfoTooltip, Tooltip,
} from '@/shared/ui';
import { callTime } from '../model/callsUrl';
import { CallContactPolicy } from './CallContactPolicy';
import { CallAttentionExport } from './CallAttentionExport';
import cls from './Calls.module.scss';
import { PhoneNumber } from '@/entities/phone';

export function CallAttention({ query: originalQuery, timezone='UTC' }: { query: CallsQuery; timezone?:string }) {
  const bounded=useMemo(()=>boundedCallPeriod(originalQuery,timezone,31),[originalQuery,timezone]);
  const query=bounded.query;
  const { t, i18n } = useTranslation();
  const {
    currentData: data,
    isFetching,
    isError,
    refetch,
  } = useGetCompanyCallsAttentionQuery({ ...query, limit: 20 },{skip:bounded.invalid,refetchOnMountOrArgChange:true});
  useEffect(() => {
    if (!data || data.source.state === 'ok' || isFetching || isError || bounded.invalid) return;
    const timer = setTimeout(() => void refetch(), 15000);
    return () => clearTimeout(timer);
  }, [data, isFetching, isError, bounded.invalid, refetch]);
  const href = (patch: Record<string, string>) => {
    const params = callsParams(query);
    params.set('view', 'attention');
    params.delete('cursor');
    for (const [key, value] of Object.entries(patch)) params.set(key, value);
    return `/reports/calls?${params}`;
  };
  if (isError)
    return (
      <QueryErrorState
        message={t('calls.attentionRange')}
        onRetry={() => void refetch()}
      />
    );
  if (!data || isFetching || data.source.message==='historyBackfillInProgress')return <CallReportSkeleton/>;
  if (data.source.state !== 'ok')
    return (
      <QueryErrorState
        message={t('calls.historyUnavailable')}
        onRetry={() => void refetch()}
      />
    );
  return (
    <VStack gap="16" align="stretch" data-testid="calls-attention">
      {bounded.limited && <Text role="status" className={cls.notice}>{t('calls.periodLimited',{days:31})}</Text>}
      <Flex justify="between" wrap="wrap" gap="8">
        <Flex gap="8" align="center"><PhoneMissed size={18} /><Text>{t('calls.attentionPurpose')}</Text>
          <InfoTooltip text={`${t('calls.attentionPolicy', { hours: data.policy.windowHours })}\n${t('calls.attentionMeaning')}`} />
        </Flex>
        <Tooltip content={t('calls.refresh')}><Button variant="ghost" size="icon" aria-label={t('calls.refresh')} onClick={() => void refetch()}><RefreshCw size={16}/></Button></Tooltip>
      </Flex>
      <Flex justify="between" align="center" gap="8" wrap="wrap" className={cls.sectionToolbar}>
        <Text variant="muted">{t('calls.callbackDeadline', { hours: data.policy.windowHours })}</Text>
        <CallContactPolicy />
        <CallAttentionExport query={query}/>
      </Flex>
      {(data.coverage === 'partial' || data.scopeLimited) && (
        <Text className={cls.notice}>
          {t(
            data.scopeLimited
              ? 'calls.attentionScope'
              : 'calls.attentionIncomplete',
          )}
        </Text>
      )}
      <Flex className={cls.attentionMetrics}>
        {(
          [
            'waiting',
            'overdue',
            'outboundConnected',
            'customerReturned',
            'unknown',
          ] as const
        ).map((state) => (
          <VStack className={cls.metric} data-contact={state} key={state} gap="8" align="stretch">
            <Text>{t(`calls.contactState.${state}`)}</Text>
            <Text variant="h2">{data.totals[state]}</Text>
          </VStack>
        ))}
      </Flex>
      <Flex gap="8" wrap="wrap">
        <Button
          variant={query.attentionView === 'all' ? 'outline' : 'secondary'}
          asChild
        >
          <Link to={href({ attentionView: 'open' })}>
            {t('calls.attentionOpen')}
          </Link>
        </Button>
        <InfoTooltip text={t('calls.attentionCounts', {calls: data.totals.sourceCalls, groups: data.totals.groups, attempts: data.totals.attempted})} />
        <Button
          variant={query.attentionView === 'all' ? 'secondary' : 'outline'}
          asChild
        >
          <Link to={href({ attentionView: 'all' })}>
            {t('calls.attentionAll')}
          </Link>
        </Button>
      </Flex>
      {data.rows.map((row) => (
        <VStack
          key={row.id}
          gap="8"
          align="stretch"
          className={cls.attentionCase}
          data-contact={row.state}
        >
          <Flex justify="between" gap="8" wrap="wrap">
            <Text>
              <PhoneNumber number={row.number} fallback={t('calls.contactReason.missingNumber')}/> ·{' '}
              <PhoneNumber number={row.companyNumber} fallback={t('calls.unassigned.companyNumber')}/>
            </Text>
            <Badge variant="outline">
              {t(`calls.contactState.${row.state}`)}
            </Badge>
          </Flex>
          <Text variant="muted">
            {t('calls.attentionGroup', { count: row.sourceCalls })} ·{' '}
            {callTime(row.firstAt, data.timezone, i18n.language)} ·{' '}
            {t('calls.attentionDeadline')}:{' '}
            {callTime(row.deadline, data.timezone, i18n.language)}
          </Text>
          {row.reason !== 'sameNumberAndCompany' && (
            <Text variant="muted">
              {t(`calls.contactReason.${row.reason}`)}
            </Text>
          )}
          <Flex gap="8" wrap="wrap">
            <Button variant="link" size="none" asChild>
              <Link to={href({ call: row.firstCallId })}>
                {t('calls.attentionSource')}
              </Link>
            </Button>
            {row.attempt && (
              <Button variant="link" size="none" asChild>
                <Link to={href({ call: row.attempt.callId })}>
                  {t('calls.attentionAttempt')}
                </Link>
              </Button>
            )}
            {row.contact && (
              <Button variant="link" size="none" asChild>
                <Link to={href({ call: row.contact.callId })}>
                  {t('calls.attentionContact')}
                </Link>
              </Button>
            )}
          </Flex>
        </VStack>
      ))}
      {!data.rows.length && <VStack gap="12" align="center" className={cls.attentionEmpty}><CheckCheck size={32} aria-hidden="true"/><Text>{t('calls.attentionEmpty')}</Text></VStack>}
      {data.truncated && (
        <Text className={cls.notice}>{t('calls.attentionLimited')}</Text>
      )}
      <Text variant="muted">
        {t('calls.updatedAt')}:{' '}
        {callTime(data.snapshotAt, data.timezone, i18n.language)}
      </Text>
    </VStack>
  );
}
