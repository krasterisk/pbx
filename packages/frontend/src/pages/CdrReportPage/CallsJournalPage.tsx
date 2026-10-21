import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import type { CallRecord, CallsQuery } from '@krasterisk/shared';
import { ChartNoAxesCombined, ChevronDown, ChevronUp, Download, PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed, RefreshCw, SlidersHorizontal, Timer } from 'lucide-react';
import {
  Badge,
  Button,
  Flex,
  Input,
  Label,
  MultiSelect,
  QueryErrorState,
  Select,
  Table,
  TableCard,
  Text,
  VStack,
  Tooltip, InfoTooltip, Sheet, FormSheetContent, SheetHeader, SheetTitle, ModalBody,
} from '@/shared/ui';
import {
  useGetCompanyCallsQuery,
  useLazyExportCompanyCallsQuery,
} from '@/shared/api/endpoints/callsApi';
import { CallDetailSheet } from '@/features/calls/ui/CallDetailSheet';
import {
  callDuration,
  callTime,
  callOutcomeKey,
  patchCallsQuery,
  readCallsQuery,
} from '@/features/calls/model/callsUrl';
import cls from '@/features/calls/ui/Calls.module.scss';
import { VoicemailDetailsModal } from '@/features/cdr';
import { CallAttention } from '@/features/calls/ui/CallAttention';
import { CallsOverview } from '@/features/calls/ui/CallsOverview';
import { AskAboutCalls } from './ui/AskAboutCalls';
import { CallDirectoryFilters } from '@/features/calls/ui/CallDirectoryFilters';
import { CallTextSearch } from '@/features/calls/ui/CallTextSearch';
import { SavedCallFilters } from '@/features/calls/ui/SavedCallFilters';
import { callFilterStorageKey, callPeriodParams } from '@/features/calls/model/savedCallFilters';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { PhoneNumber } from '@/entities/phone';
function dayInZone(timezone: string, value?: string): string {
  const date = value ? new Date(value) : new Date();
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date)
    : '';
}
const outcomeOptions: NonNullable<CallsQuery['outcome']>[] = [
  'human',
  'robot',
  'voicemail',
  'menu',
  'missed',
  'error',
  'unknown',
  'active',
];
export function CallsJournalPage() {
  const { t, i18n } = useTranslation();
  const workspaceTitleRef = useRef<HTMLHeadingElement>(null);
  const [params, setParams] = useSearchParams();
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const query = useMemo(() => readCallsQuery(params), [params]);
  const user = useAppSelector(state => state.auth?.user);
  const storageKey = user ? callFilterStorageKey(user.vpbx_user_uid ?? 0, user.uniqueid) : null;
  const legacyUnsupported =
    ['bucket', 'trunk', 'state'].some((key) => params.has(key)) ||
    ['BUSY', 'NO ANSWER'].includes(params.get('disposition') || '');
  const {
    currentData: data,
    data: previous,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetCompanyCallsQuery(query);
  const timezone = data?.timezone || previous?.timezone || 'UTC';
  const [search, setSearch] = useState(query.search || '');
  const [cursors, setCursors] = useState<string[]>([]);
  const [voicemailId, setVoicemailId] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(
    Boolean(
      query.handling ||
      query.employees?.length || query.departments?.length || query.companyNumbers?.length ||
      query.extension || query.department || query.companyNumber ||
      query.queues?.length ||
      query.robots?.length ||
      query.recording ||
      query.analytics ||
      query.voicemail,
    ),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const overviewOpen = params.get('view') === 'overview';
  const attentionOpen = params.get('view') === 'attention';
  const attentionParams = new URLSearchParams(params);
  if (attentionOpen) attentionParams.delete('view');
  else attentionParams.set('view', 'attention');
  const overviewParams = new URLSearchParams(params);
  if (overviewOpen) overviewParams.delete('view');
  else overviewParams.set('view', 'overview');
  const [exportCalls, { isFetching: exporting }] =
    useLazyExportCompanyCallsQuery();
  const [exportError, setExportError] = useState(false);
  const handleExport = async () => {
    setExportError(false);
    try {
      const blob = await exportCalls(query).unwrap();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'company-calls.csv';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError(true);
    }
  };
  useEffect(() => {
    setSearch(query.search || '');
  }, [query.search]);
  useEffect(() => {
    if (search === (query.search || '')) return;
    const timer = setTimeout(() => {
      setCursors([]);
      setParams(patchCallsQuery(params, { search: search || undefined }));
    }, 400);
    return () => clearTimeout(timer);
  }, [search, query.search, params, setParams]);
  const patch = (value: Record<string, string | string[] | undefined>) => {
    setCursors([]);
    setParams(patchCallsQuery(params, value));
  };
  const selected = callId || params.get('call');
  const open = (call: CallRecord) => {
    const next = new URLSearchParams(params);
    next.set('call', call.id);
    next.delete('transcriptSegment');
    setParams(next);
  };
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete('call');
    next.delete('transcriptSegment');
    if (callId)
      navigate(
        { pathname: '/reports/calls', search: next.toString() },
        { replace: true },
      );
    else setParams(next, { replace: true });
  };
  const unknown = t('calls.unknown');
  const columns = useMemo<ColumnDef<CallRecord>[]>(
    () => [
      {
        accessorKey: 'startedAt',
        header: t('calls.time'),
        cell: ({ row }) => (
          <Text as="span">
            {callTime(row.original.startedAt, timezone, i18n.language)}
          </Text>
        ),
      },
      {
        id: 'parties',
        header: t('calls.participants'),
        cell: ({ row }) => (
          <VStack gap="4" align="stretch" className={cls.party}>
            <Text>
              <PhoneNumber number={row.original.caller.number} name={row.original.caller.name} fallback={unknown}/> →{' '}
              <PhoneNumber number={row.original.recipient.number} name={row.original.recipient.name} fallback={unknown}/>
            </Text>
            <Text variant="muted">
              {t(`calls.direction.${row.original.direction}`)}
            </Text>
          </VStack>
        ),
      },
      {
        accessorKey: 'companyNumber',
        header: t('calls.companyNumber'),
        cell: ({ row }) => (
          <PhoneNumber number={row.original.companyNumber}/>
        ),
      },
      {
        id: 'handling',
        header: t('calls.handling'),
        cell: ({ row }) => (
          <Text as="span">
            {[
              ...(row.original.origin === 'autodial'
                ? [t('calls.autodial')]
                : []),
              ...row.original.handling.map((kind) => t(`calls.actor.${kind}`)),
            ].join(', ') || '-'}
          </Text>
        ),
      },
      {
        accessorKey: 'outcome',
        header: t('calls.result'),
        cell: ({ row }) => (
          <Badge variant="secondary" className={cls.statusBadge} data-outcome={row.original.outcome}>{t(callOutcomeKey(row.original))}</Badge>
        ),
      },
      {
        accessorKey: 'connectedSec',
        header: t('calls.connected'),
        cell: ({ row }) => (
          <Text as="span">
            {callDuration(
              row.original.connectedSec,
              row.original.timingSource === 'cdr',
            )}
          </Text>
        ),
      },
      {
        id: 'materials',
        header: t('calls.materials'),
        cell: ({ row }) => (
          <Text as="span">
            {[
              row.original.recordings.length ? t('calls.recording') : '',
              row.original.hasVoicemail ? t('calls.voicemail') : '',
              row.original.analytics
                ? t(`calls.analysis.${row.original.analytics.state}`)
                : '',
            ]
              .filter(Boolean)
              .join(' · ') || '-'}
          </Text>
        ),
      },
    ],
    [t, i18n.language, timezone, unknown],
  );
  const summary = data?.summary;
  const metrics = [
    { label: t('calls.found'), value: summary?.total, icon: PhoneCall, tone: 'neutral' },
    { label: t('calls.incomingTotal'), value: summary?.incoming, icon: PhoneIncoming, tone: 'incoming' },
    { label: t('calls.outgoingTotal'), value: summary?.outgoing, icon: PhoneOutgoing, tone: 'outgoing' },
    { label: t('calls.humanAccepted'), value: summary?.incomingHuman, icon: PhoneIncoming, tone: 'incoming' },
    { label: t('calls.incomingMissed'), value: summary?.incomingMissed, icon: PhoneIncoming, tone: 'missed' },
    {
      label: t('calls.avgConnected'),
      icon: Timer, tone: 'neutral',
      value: summary
        ? callDuration(
            summary.avgConnectedSec,
            summary.estimatedConnectedSample > 0,
          )
        : undefined,
    },
  ];
  const preset = (period: 'today' | 'yesterday' | 'week' | 'all') => patch(callPeriodParams(period, timezone));
  const activeFilterCount = Object.entries(query).filter(([key, value]) =>
    !['from','to','dateFrom','dateTo','search','cursor','limit','directorySearch'].includes(key)
      && (Array.isArray(value) ? value.length > 0 : Boolean(value)),
  ).length;
  const chips: Array<[string, string]> = [];
  if (query.callerEmployee) chips.push(['callerEmployee', `${t('calls.initiator')}: ${query.callerEmployee}`]);
  for (const [field,label] of [['focusEmployee','employee'],['focusDepartment','department'],['focusCompanyNumber','companyNumber']] as const) if(query[field])chips.push([field,`${t(`calls.${label}`)}: ${query[field]}`]);
  if (query.focusOutcome)
    chips.push(['focusOutcome', t(`calls.outcome.${query.focusOutcome}`)]);
  for (const dimension of query.unassignedDimensions || [])
    chips.push(['unassignedDimensions', t(`calls.unassigned.${dimension}`)]);
  if (query.direction)
    chips.push(['direction', t(`calls.direction.${query.direction}`)]);
  if (query.outcome)
    chips.push(['outcome', t(`calls.outcome.${query.outcome}`)]);
  if (query.handling)
    chips.push([
      'handling',
      query.handling === 'autodial'
        ? t('calls.autodial')
        : t(`calls.actor.${query.handling}`),
    ]);
  if (query.extension)
    chips.push(['extension', `${t('calls.employee')}: ${query.extension}`]);
  for (const value of query.outcomes || [])
    chips.push(['outcomes', t(`calls.outcome.${value}`)]);
  if (query.recording)
    chips.push([
      'recording',
      t(
        query.recording === 'yes'
          ? 'calls.withRecording'
          : 'calls.withoutRecording',
      ),
    ]);
  if (query.analytics)
    chips.push(['analytics', t(`calls.analysis.${query.analytics}`)]);
  if (query.voicemail) chips.push(['voicemail', t('calls.voicemail')]);
  if (query.department) chips.push(['department', query.department]);
  if (query.companyNumber) chips.push(['companyNumber', query.companyNumber]);
  if (query.dashboardOutcome)
    chips.push([
      'dashboardOutcome',
      t(`calls.overviewOutcome.${query.dashboardOutcome}`),
    ]);
  if (query.origin) chips.push(['origin', t(`calls.origin.${query.origin}`)]);
  for (const [field, label] of [['employees','employee'],['departments','department'],['companyNumbers','companyNumber'],['queues','queue'],['robots','robot']] as const) {
    if (query[field]?.length) chips.push([field, `${t(`calls.${label}`)}: ${query[field]!.length}`]);
  }
  return (
    <VStack
      gap="24"
      align="stretch"
      max
      className={cls.page}
      data-testid="calls-journal"
    >
      <Flex justify="between" align="center" className={cls.header}>
        <Flex gap="12" align="center">
          <PhoneCall size={24} />
          <VStack gap="4" align="stretch">
            <Text variant="h1">{t('calls.title')}</Text>
            <Text variant="muted">{t('calls.subtitle')}</Text>
          </VStack>
        </Flex>
        <Flex gap="8" wrap="wrap">
          <AskAboutCalls query={query} page={data} busy={isFetching || isError} view={attentionOpen ? 'attention' : overviewOpen ? 'overview' : 'journal'} />
          <Tooltip content={t('calls.attentionTitle')}><Button variant={attentionOpen ? 'secondary' : 'outline'} size="icon" asChild>
            <Link
              to={{ search: attentionParams.toString() }}
              aria-expanded={attentionOpen}
              aria-label={t('calls.attentionTitle')}
            >
              <PhoneMissed size={18} />
            </Link>
          </Button></Tooltip>
          <Tooltip content={t('calls.overviewTitle')}><Button variant={overviewOpen ? 'secondary' : 'outline'} size="icon" asChild>
            <Link
              to={{ search: overviewParams.toString() }}
              aria-expanded={overviewOpen}
              aria-label={t('calls.overviewTitle')}
            >
              <ChartNoAxesCombined size={18} />
            </Link>
          </Button></Tooltip>
          <Tooltip content={t('calls.export')}><Button
            variant="outline"
            size="icon" aria-label={t('calls.export')}
            onClick={() => void handleExport()}
            disabled={exporting || !data}
          >
            <Download size={16} />
          </Button></Tooltip>
          <Tooltip content={t('calls.refresh')}><Button
            variant="outline"
            size="icon" aria-label={t('calls.refresh')}
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={16} />
          </Button></Tooltip>
        </Flex>
      </Flex>
      <VStack
        gap="12"
        align="stretch"
        className={cls.filters}
      >
        <div className={cls.filterToolbar}>
        <VStack gap="4" align="stretch" className={cls.searchField}>
        <Label htmlFor="calls-search">{t('calls.searchLabel')}</Label>
        <Input
          id="calls-search"
          className={cls.search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('calls.searchHint')}
        />
        </VStack>
        <Flex gap="8" wrap="wrap">
          <Button size="sm" variant="outline" onClick={() => preset('today')}>
            {t('calls.today')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => preset('yesterday')}>
            {t('calls.yesterday')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => preset('week')}>
            {t('calls.week')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => preset('all')}
          >
            {t('calls.allHistory')}
          </Button>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={filtersOpen}
          aria-controls="calls-filter-panel"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal size={16}/>
          {t(filtersOpen ? 'calls.hideFilters' : 'calls.showFilters')}
          {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
          {filtersOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </Button>
        </Flex>
        </div>
        {storageKey && <SavedCallFilters key={storageKey} storageKey={storageKey} query={{ ...query, search: search || undefined }} timezone={timezone} onApply={next => {
          setCursors([]);
          if (params.has('view')) next.set('view', params.get('view')!);
          setParams(next);
        }}/>}
        {filtersOpen && <VStack id="calls-filter-panel" gap="12" align="stretch" className={cls.filterPanel}>
        <Flex className={cls.filterRow}>
          <VStack gap="4" align="stretch" className={cls.field}>
            <Label htmlFor="calls-from">{t('calls.from')}</Label>
            <Input
              id="calls-from"
              type="date"
              className={cls.dateInput}
              value={
                query.dateFrom === undefined
                  ? dayInZone(timezone, query.from)
                  : query.dateFrom
              }
              onChange={(e) =>
                patch({
                  dateFrom: e.target.value,
                  dateTo:
                    query.dateTo === undefined
                      ? dayInZone(
                          timezone,
                          query.to && Number.isFinite(Date.parse(query.to))
                            ? new Date(Date.parse(query.to) - 1).toISOString()
                            : undefined,
                        )
                      : query.dateTo,
                })
              }
            />
          </VStack>
          <VStack gap="4" align="stretch" className={cls.field}>
            <Label htmlFor="calls-to">{t('calls.to')}</Label>
            <Input
              id="calls-to"
              type="date"
              className={cls.dateInput}
              value={
                query.dateTo === undefined
                  ? dayInZone(
                      timezone,
                      query.to && Number.isFinite(Date.parse(query.to))
                        ? new Date(Date.parse(query.to) - 1).toISOString()
                        : undefined,
                    )
                  : query.dateTo
              }
              onChange={(e) =>
                patch({
                  dateTo: e.target.value,
                  dateFrom:
                    query.dateFrom === undefined
                      ? dayInZone(timezone, query.from)
                      : query.dateFrom,
                })
              }
            />
          </VStack>
          <VStack gap="4" align="stretch" className={cls.field}>
            <Label htmlFor="calls-direction">{t('calls.directionLabel')}</Label>
            <Select
              id="calls-direction"
              value={query.direction || ''}
              onChange={(e) =>
                patch({ direction: e.target.value || undefined })
              }
            >
              <option value="">{t('calls.all')}</option>
              {(['in', 'out', 'internal', 'external'] as const).map((value) => (
                <option key={value} value={value}>
                  {t(`calls.direction.${value}`)}
                </option>
              ))}
            </Select>
          </VStack>
          <VStack gap="4" align="stretch" className={cls.field}>
            <Label htmlFor="calls-outcome">{t('calls.result')}</Label>
            <MultiSelect
              ariaLabel={t('calls.result')}
              value={query.outcomes || (query.outcome ? [query.outcome] : [])}
              onChange={(values) =>
                patch({ outcomes: values.length ? values : undefined })
              }
              options={outcomeOptions.map((value) => ({
                value,
                label: t(`calls.outcome.${value}`),
              }))}
              placeholder={t('calls.all')}
            />
          </VStack>
        </Flex>
        <Button
          className={cls.advancedButton}
          variant="ghost"
          size="sm"
          aria-expanded={advanced}
          aria-controls="calls-more-filters"
          onClick={() => setAdvanced(!advanced)}
        >
          {t(advanced ? 'calls.lessFilters' : 'calls.moreFilters')}
          {advanced ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </Button>
        {advanced && (
          <VStack id="calls-more-filters" gap="12" align="stretch">
          <CallDirectoryFilters query={query} patch={patch} advanced />
          <Flex className={cls.filterRow}>
            <VStack gap="4" align="stretch" className={cls.field}>
              <Label htmlFor="calls-handling">{t('calls.handling')}</Label>
              <Select
                id="calls-handling"
                value={query.handling || ''}
                onChange={(e) =>
                  patch({ handling: e.target.value || undefined })
                }
              >
                <option value="">{t('calls.all')}</option>
                {[
                  'employee',
                  'queue',
                  'menu',
                  'voiceRobot',
                  'aiRobot',
                  'autodial',
                ].map((value) => (
                  <option key={value} value={value}>
                    {t(
                      value === 'autodial'
                        ? 'calls.autodial'
                        : `calls.actor.${value}`,
                    )}
                  </option>
                ))}
              </Select>
            </VStack>
          </Flex>
          </VStack>
        )}
        </VStack>}
        <Flex gap="8" align="center" className={cls.chips}>
          {chips.map(([key, value]) => (
            <Button
              key={`${key}:${value}`}
              size="sm"
              variant="outline"
              onClick={() =>
                patch(
                  key === 'outcomes'
                    ? {
                        outcomes: query.outcomes?.filter(
                          (outcome) => t(`calls.outcome.${outcome}`) !== value,
                        ),
                      }
                    : key === 'unassignedDimensions'
                      ? {
                          unassignedDimensions:
                            query.unassignedDimensions?.filter(
                              (d) => t(`calls.unassigned.${d}`) !== value,
                            ),
                        }
                      : { [key]: undefined },
                )
              }
              aria-label={`${t('calls.removeFilter')}: ${value}`}
            >
              {value} ×
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCursors([]);
              setParams(new URLSearchParams());
            }}
          >
            {t('calls.reset')}
          </Button>
          <Text variant="muted">
            {query.dateFrom === '' && query.dateTo === '' ? t('calls.allHistory') : `${query.dateFrom ?? dayInZone(timezone, query.from)} — ${query.dateTo ?? dayInZone(timezone, query.to && Number.isFinite(Date.parse(query.to)) ? new Date(Date.parse(query.to) - 1).toISOString() : undefined)}`} · {timezone}
          </Text>
        </Flex>
      </VStack>
      <Sheet open={(attentionOpen || overviewOpen) && !selected} onOpenChange={(isOpen) => { if (!isOpen) { const next = new URLSearchParams(params); next.delete('view'); setParams(next, { replace: true }); } }}>
        <FormSheetContent className={cls.workspaceSheet} aria-describedby={undefined} onOpenAutoFocus={(event) => { event.preventDefault(); workspaceTitleRef.current?.focus(); }}>
          <SheetHeader><SheetTitle ref={workspaceTitleRef} tabIndex={-1} className={cls.sheetTitle}>{t(attentionOpen ? 'calls.attentionTitle' : 'calls.overviewTitle')}</SheetTitle></SheetHeader>
          <ModalBody>
            {attentionOpen && <CallAttention query={query} />}
            {overviewOpen && <CallsOverview query={query} periodHref={(from, to) => `/reports/calls?${patchCallsQuery(params, { from, to, dateFrom: undefined, dateTo: undefined, view: undefined })}`} />}
          </ModalBody>
        </FormSheetContent>
      </Sheet>
      {data?.transcriptSearchAllowed && <CallTextSearch key={JSON.stringify({...query,cursor:undefined})+':'+Boolean(data.transcriptSemanticAllowed)} query={query} allowSemantic={data.transcriptSemanticAllowed===true} onOpen={(id,segment)=>{const next=new URLSearchParams(params);next.set('call',id);next.set('transcriptSegment',segment);setParams(next);}} />}
      {legacyUnsupported && (
        <Text role="status" className={cls.notice}>
          {t('calls.legacyFilterNotice')}
        </Text>
      )}
      {exportError && <Text role="alert">{t('calls.exportError')}</Text>}
      {query.from && query.to && (
        <Text variant="muted">
          {callTime(query.from, timezone, i18n.language)} -{' '}
          {callTime(query.to, timezone, i18n.language)}
        </Text>
      )}
      {data?.dataAsOf && (
        <Text variant="muted">
          {t('calls.updatedAt')}:{' '}
          {callTime(data.dataAsOf, timezone, i18n.language)}
        </Text>
      )}
      {data?.source.state !== 'ok' && data && (
        <Text role="status" className={cls.notice}>
          {t(
            data.source.state === 'unavailable'
              ? 'calls.sourceUnavailable'
              : 'calls.sourcePartial',
          )}
        </Text>
      )}
      <Flex className={cls.summary}>
        {metrics.map((metric) => (
          <VStack
            key={metric.label}
            gap="8"
            align="stretch"
            className={cls.metric}
            data-tone={metric.tone}
          >
            <metric.icon size={18} aria-hidden="true" className={cls.metricIcon}/>
            <Flex gap="4" align="center"><Text variant="muted">{metric.label}</Text>
              {metric.icon === Timer && summary && <InfoTooltip text={t('calls.durationExplanation', { count: summary.connectedSample })} />}
            </Flex>
            <Text variant="h2" className={cls.metricValue}>
              {isError || data?.source.state === 'unavailable'
                ? '-'
                : (metric.value ?? '-')}
            </Text>
          </VStack>
        ))}
      </Flex>
      {isError ? (
        <QueryErrorState
          message={t('calls.loadError')}
          onRetry={() => void refetch()}
        />
      ) : isLoading || !data ? (
        <Text>{t('common.loading')}</Text>
      ) : (
        <>
          <Flex className={cls.desktop}>
            <Table
              columns={columns}
              data={data.rows}
              getRowId={(call) => call.id}
              getRowClassName={(call) => `${cls.callRow} ${cls['outcome_' + call.outcome] || ''}`}
              showSearch={false}
              showExport={false}
              paginationMode="server"
              totalRows={data.rows.length}
              pageSize={50}
              onRowClick={open}
              emptyText={t('calls.empty')}
            />
          </Flex>
          <VStack gap="12" align="stretch" className={cls.mobile}>
            {data.rows.map((call) => (
              <TableCard key={call.id} className={`${cls.mobileCall} ${cls['outcome_' + call.outcome] || ''}`} onActivate={() => open(call)}>
                <Text>
                  <PhoneNumber number={call.caller.number} name={call.caller.name} fallback={unknown}/> →{' '}
                  <PhoneNumber number={call.recipient.number} name={call.recipient.name} fallback={unknown}/>
                </Text>
                <Text variant="muted">
                  {callTime(call.startedAt, timezone, i18n.language)} ·{' '}
                  {t(`calls.direction.${call.direction}`)}
                </Text>
                <Text>
                  {t(callOutcomeKey(call))} ·{' '}
                  {callDuration(call.connectedSec, call.timingSource === 'cdr')}
                </Text>
                <Text variant="muted">
                  {[
                    call.origin === 'autodial' ? t('calls.autodial') : '',
                    ...call.handling.map((kind) => t(`calls.actor.${kind}`)),
                    call.hasVoicemail ? t('calls.voicemail') : '',
                    call.analytics
                      ? t(`calls.analysis.${call.analytics.state}`)
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </TableCard>
            ))}
            {!data.rows.length && <Text>{t('calls.empty')}</Text>}
          </VStack>
          <Flex
            gap="12"
            justify="between"
            align="center"
            className={cls.pagination}
          >
            <Button
              variant="outline"
              disabled={!cursors.length || isFetching}
              onClick={() => {
                const previousCursor = cursors[cursors.length - 1];
                setCursors(cursors.slice(0, -1));
                const next = new URLSearchParams(params);
                if (previousCursor) next.set('cursor', previousCursor);
                else next.delete('cursor');
                setParams(next);
              }}
            >
              {t('calls.previous')}
            </Button>
            <Text variant="muted">
              {t('calls.total', { count: data.total })}
            </Text>
            <Button
              variant="outline"
              disabled={!data.nextCursor || isFetching}
              onClick={() => {
                if (!data.nextCursor) return;
                setCursors([...cursors, query.cursor || '']);
                const next = new URLSearchParams(params);
                next.set('cursor', data.nextCursor);
                setParams(next);
              }}
            >
              {t('calls.next')}
            </Button>
          </Flex>
        </>
      )}
      <CallDetailSheet
        key={(selected || 'closed')+':'+(params.get('transcriptSegment')||'')}
        id={selected}
        transcriptSegment={params.get('transcriptSegment')||undefined}
        onClose={close}
        onVoicemailClick={setVoicemailId}
      />
      <VoicemailDetailsModal
        uniqueid={voicemailId}
        isOpen={Boolean(voicemailId)}
        onClose={() => setVoicemailId(null)}
      />
    </VStack>
  );
}
