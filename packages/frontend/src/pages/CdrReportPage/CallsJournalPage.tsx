import { CallReportSkeleton } from '@/features/calls/ui/CallReportSkeleton';
import { useGetOrganizationCalendarQuery } from '@/shared/api/endpoints/organizationSettingsApi';
import { CallFilterSummary } from '@/features/calls/ui/CallFilterSummary';
import { CallDateTimeFilters } from '@/features/calls/ui/CallDateTimeFilters';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import type { CallRecord } from '@krasterisk/shared';
import {
  ChartNoAxesCombined,
  Download,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  RefreshCw,
  Search,
  X,
  LoaderCircle,
  SlidersHorizontal,
  ChevronDown,
  Timer,
  Bot,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Badge,
  Button,
  Flex,
  Input,
  QueryErrorState,
  Table,
  TableCard,
  Text,
  VStack,
  Tooltip,
  InfoTooltip,
  Sheet,
  FormSheetContent,
  SheetHeader,
  SheetTitle,
  ModalBody,
  Skeleton,
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
import { CallMaterials } from '@/features/calls/ui/CallMaterials';
import { CallAdvancedFilters } from '@/features/calls/ui/CallAdvancedFilters';
import { invalidCallPeriod } from '@/features/calls/model/callPeriod';
import { CallTextSearch } from '@/features/calls/ui/CallTextSearch';
import { SavedCallFilters } from '@/features/calls/ui/SavedCallFilters';
import {
  callFilterStorageKey,
  callPeriodParams,
  parseCallPeriod,
} from '@/features/calls/model/savedCallFilters';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { PhoneNumber } from '@/entities/phone';
export function CallsJournalPage() {
  const { t, i18n } = useTranslation();
  const workspaceTitleRef = useRef<HTMLHeadingElement>(null);
  const [params, setParams] = useSearchParams();
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const query = useMemo(() => readCallsQuery(params), [params]);
  const periodPreset = parseCallPeriod(params.get('periodPreset'));
  const user = useAppSelector((state) => state.auth?.user);
  const storageKey = user
    ? callFilterStorageKey(user.vpbx_user_uid ?? 0, user.uniqueid)
    : null;
  const periodError = invalidCallPeriod(query);
  const shortSearch = Boolean(query.search && query.search.trim().length < 3);
  const legacyUnsupported =
    ['bucket', 'state'].some((key) => params.has(key)) ||
    ['BUSY', 'NO ANSWER'].includes(params.get('disposition') || '');
  const {
    currentData: data,
    data: previous,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetCompanyCallsQuery(query, { skip: periodError || shortSearch });
  const timezone = data?.timezone || previous?.timezone || 'UTC';
  const { data: calendar, isError: calendarError, refetch: refetchCalendar } = useGetOrganizationCalendarQuery();
  const calendarFailure = <Flex gap="8" align="center"><Text role="alert">{t('calls.weekStartError')}</Text><Button variant="ghost" onClick={() => void refetchCalendar()}>{t('calls.refresh')}</Button></Flex>;
  useEffect(() => {
    if (
      !data ||
      data.source.state === 'ok' ||
      isFetching ||
      isError ||
      periodError ||
      shortSearch
    )
      return;
    const timer = setTimeout(() => void refetch(), 15000);
    return () => clearTimeout(timer);
  }, [data, isFetching, isError, periodError, shortSearch, refetch]);

  const [materialCall, setMaterialCall] = useState<string | null>(null);
  const [search, setSearch] = useState(query.search || '');
  const [cursors, setCursors] = useState<string[]>([]);
  const [voicemailId, setVoicemailId] = useState<string | null>(null);
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
  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExportError(false);
    try {
      const blob = await exportCalls({ ...query, format }).unwrap();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `company-calls.${format}`;
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
    const normalized = search.trim();
    if (
      isFetching ||
      normalized === (query.search || '') ||
      (normalized.length > 0 && normalized.length < 3)
    )
      return;
    const timer = setTimeout(() => {
      setCursors([]);
      setParams(patchCallsQuery(params, { search: normalized || undefined }));
    }, 650);
    return () => clearTimeout(timer);
  }, [search, query.search, params, setParams, isFetching]);
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
    setMaterialCall(null);
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
              <PhoneNumber
                number={row.original.caller.number}
                name={row.original.caller.name}
                fallback={unknown}
              />{' '}
              →{' '}
              <PhoneNumber
                number={row.original.recipient.number}
                name={row.original.recipient.name}
                fallback={unknown}
              />
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
          <PhoneNumber number={row.original.companyNumber} fallback="-" />
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
          <Badge
            variant="secondary"
            className={cls.statusBadge}
            data-outcome={row.original.outcome}
          >
            {t(callOutcomeKey(row.original))}
          </Badge>
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
          <CallMaterials
            call={row.original}
            onVoicemail={setVoicemailId}
            onTranscript={() => {
              setMaterialCall(row.original.id);
              setParams((current) => {
                const next = new URLSearchParams(current);
                next.set('call', row.original.id);
                next.delete('transcriptSegment');
                return next;
              });
            }}
          />
        ),
      },
    ],
    [t, i18n.language, timezone, unknown, setParams],
  );
  const ready = data?.source.state === 'ok';
  const historyPreparing = Boolean(
    data && !ready && data.source.message === 'historyBackfillInProgress',
  );
  const reportLoading =
    !periodError &&
    !shortSearch &&
    !isError &&
    (isLoading || isFetching || !data || historyPreparing);
  const summary = ready ? data?.summary : undefined;
  const metrics = [
    {
      label: t('calls.found'),
      value: summary?.total,
      icon: PhoneCall,
      tone: 'neutral',
    },
    {
      label: t('calls.incomingTotal'),
      value: summary?.incoming,
      icon: PhoneIncoming,
      tone: 'incoming',
    },
    {
      label: t('calls.outgoingTotal'),
      value: summary?.outgoing,
      icon: PhoneOutgoing,
      tone: 'outgoing',
    },
    {
      label: t('calls.humanAccepted'),
      value: summary?.incomingHuman,
      icon: PhoneIncoming,
      tone: 'incoming',
    },
    {
      label: t('calls.incomingRobot'),
      value: summary?.incomingRobot,
      icon: Bot,
      tone: 'robot',
    },
    {
      label: t('calls.automation'),
      value:
        summary && summary.human + summary.robot
          ? `${Math.round((summary.robot / (summary.human + summary.robot)) * 100)}%`
          : '-',
      icon: Bot,
      tone: 'robot',
    },
    {
      label: t('calls.incomingMissed'),
      value: summary?.incomingMissed,
      icon: PhoneIncoming,
      tone: 'missed',
    },
    {
      label: t('calls.avgConnected'),
      icon: Timer,
      tone: 'neutral',
      value: summary
        ? callDuration(
            summary.avgConnectedSec,
            summary.estimatedConnectedSample > 0,
          )
        : undefined,
    },
  ];
  const preset = (period: 'today' | 'yesterday' | 'week' | 'all') =>
    patch(callPeriodParams(period, timezone, new Date(), calendar?.weekStart));
  const activeFilterCount = new Set(
    Object.entries(query)
      .filter(
        ([key, value]) =>
          !['search', 'cursor', 'limit', 'directorySearch'].includes(key) &&
          (Array.isArray(value) ? value.length > 0 : value !== undefined),
      )
      .map(([key]) =>
        ['from', 'to', 'dateFrom', 'dateTo'].includes(key)
          ? 'period'
          : ['outcome', 'outcomes', 'results'].includes(key)
            ? 'outcomes'
            : key,
      ),
  ).size;
  const hasFilters = Boolean(activeFilterCount || query.search);
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
          <AskAboutCalls
            query={query}
            page={data}
            busy={isFetching || isError || !ready}
            view={
              attentionOpen
                ? 'attention'
                : overviewOpen
                  ? 'overview'
                  : 'journal'
            }
          />
          <Tooltip content={t('calls.attentionTitle')}>
            <Button
              variant={attentionOpen ? 'secondary' : 'outline'}
              size="icon"
              asChild
            >
              <Link
                to={{ search: attentionParams.toString() }}
                aria-expanded={attentionOpen}
                aria-label={t('calls.attentionTitle')}
              >
                <PhoneMissed size={18} />
              </Link>
            </Button>
          </Tooltip>
          <Tooltip content={t('calls.overviewTitle')}>
            <Button
              variant={overviewOpen ? 'secondary' : 'outline'}
              size="icon"
              asChild
            >
              <Link
                to={{ search: overviewParams.toString() }}
                aria-expanded={overviewOpen}
                aria-label={t('calls.overviewTitle')}
              >
                <ChartNoAxesCombined size={18} />
              </Link>
            </Button>
          </Tooltip>
          <DropdownMenu>
            <Tooltip
              content={t(exporting ? 'calls.exporting' : 'calls.export')}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t('calls.export')}
                  disabled={exporting || !ready || periodError || isFetching}
                >
                  {exporting ? (
                    <LoaderCircle size={16} className={cls.spin} />
                  ) : (
                    <Download size={16} />
                  )}
                </Button>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => void handleExport('xlsx')}>
                {t('calls.exportXlsx')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleExport('csv')}>
                {t('calls.exportCsv')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip content={t('calls.refresh')}>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('calls.refresh')}
              onClick={() => void refetch()}
              disabled={isFetching || periodError || shortSearch}
            >
              <RefreshCw size={16} />
            </Button>
          </Tooltip>
        </Flex>
      </Flex>
      <VStack gap="0" align="stretch" className={cls.filters}>
        <VStack gap="4" align="stretch" className={cls.searchField}>
          <Flex align="center" gap="8" className={cls.searchBox}>
            <Search size={18} aria-hidden="true" />
            <Input
              id="calls-search"
              aria-label={t('calls.searchLabel')}
              className={cls.search}
              value={search}
              maxLength={200}
              aria-describedby="calls-search-status"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('calls.searchHint')}
            />
            {isFetching ? (
              <LoaderCircle size={18} className={cls.spin} aria-hidden="true" />
            ) : (
              search && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('calls.clearSearch')}
                  onClick={() => setSearch('')}
                >
                  <X size={16} />
                </Button>
              )
            )}
            <Tooltip
              content={t(
                filtersOpen ? 'calls.hideFilters' : 'calls.showFilters',
              )}
            >
              <Button
                size="icon"
                variant={filtersOpen ? 'secondary' : 'ghost'}
                aria-label={t(
                  filtersOpen ? 'calls.hideFilters' : 'calls.showFilters',
                )}
                aria-expanded={filtersOpen}
                data-expanded={filtersOpen}
                aria-controls="calls-filter-panel"
                onClick={() => setFiltersOpen(!filtersOpen)}
                className={cls.filterTrigger}
              >
                <SlidersHorizontal key="filters-icon" size={18} />
                <ChevronDown
                  key="filters-chevron"
                  size={12}
                  className={cls.filterChevron}
                  aria-hidden="true"
                />
                {activeFilterCount > 0 && (
                  <Badge
                    key="filters-count"
                    className={cls.filterCount}
                    variant="secondary"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </Tooltip>
          </Flex>
          {search.trim().length > 0 && search.trim().length < 3 && (
            <Text id="calls-search-status" variant="muted" role="status">
              {t('calls.searchMinimum')}
            </Text>
          )}
        </VStack>
        {filtersOpen && (
          <VStack
            id="calls-filter-panel"
            gap="8"
            align="stretch"
            className={cls.filterPanel}
          >
            {calendar ? <CallAdvancedFilters
              query={query}
              patch={patch}
              timezone={timezone}
              periodPreset={periodPreset}
              weekStart={calendar.weekStart}
              analyticsAllowed={data?.transcriptSearchAllowed === true}
            /> : calendarError ? calendarFailure : <Skeleton className="h-10 w-full" />}
            <Flex
              gap="8"
              align="center"
              justify="between"
              wrap="wrap"
              className={cls.composerFooter}
            >
              {storageKey && calendar && (
                <SavedCallFilters
                  key={storageKey}
                  storageKey={storageKey}
                  query={{
                    ...query,
                    search:
                      search.trim().length >= 3 ? search.trim() : query.search,
                  }}
                  timezone={timezone}
                  periodPreset={periodPreset}
                  weekStart={calendar.weekStart}
                  onApply={(next) => {
                    setCursors([]);
                    if (params.has('view'))
                      next.set('view', params.get('view')!);
                    setParams(next);
                  }}
                />
              )}
              {hasFilters && (
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
              )}
            </Flex>
          </VStack>
        )}
      </VStack>
      {!filtersOpen && (calendar ? <CallFilterSummary query={query} timezone={timezone} periodPreset={periodPreset} weekStart={calendar.weekStart} /> : calendarError ? calendarFailure : <Skeleton className="h-5 w-48" />)}
      <Sheet
        open={(attentionOpen || overviewOpen) && !selected}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            const next = new URLSearchParams(params);
            next.delete('view');
            setParams(next, { replace: true });
          }
        }}
      >
        <FormSheetContent
          className={cls.workspaceSheet}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            workspaceTitleRef.current?.focus();
          }}
        >
          <SheetHeader>
            <SheetTitle
              ref={workspaceTitleRef}
              tabIndex={-1}
              className={cls.sheetTitle}
            >
              {t(
                attentionOpen ? 'calls.attentionTitle' : 'calls.overviewTitle',
              )}
            </SheetTitle>
          </SheetHeader>
          <ModalBody>
            {periodError && (
              <VStack gap="12" align="stretch">
                <Text role="alert" className={cls.validationError}>
                  {t('calls.timeRangeError')}
                </Text>
                <CallDateTimeFilters
                  query={query}
                  timezone={timezone}
                  patch={patch}
                />
              </VStack>
            )}
            {attentionOpen && !periodError && !shortSearch && (
              <CallAttention query={query} timezone={timezone} />
            )}
            {overviewOpen && !periodError && !shortSearch && (
              <CallsOverview
                query={query}
                timezone={timezone}
                periodHref={(from, to) =>
                  `/reports/calls?${patchCallsQuery(params, { from, to, dateFrom: undefined, dateTo: undefined, view: undefined })}`
                }
              />
            )}
          </ModalBody>
        </FormSheetContent>
      </Sheet>
      {filtersOpen &&
        ready &&
        !periodError &&
        !shortSearch &&
        data?.transcriptSearchAllowed && (
          <CallTextSearch
            key={
              JSON.stringify({ ...query, cursor: undefined }) +
              ':' +
              Boolean(data.transcriptSemanticAllowed)
            }
            query={query}
            allowSemantic={data.transcriptSemanticAllowed === true}
            onOpen={(id, segment) => {
              const next = new URLSearchParams(params);
              next.set('call', id);
              next.set('transcriptSegment', segment);
              setParams(next);
            }}
          />
        )}
      {legacyUnsupported && (
        <Text role="status" className={cls.notice}>
          {t('calls.legacyFilterNotice')}
        </Text>
      )}
      {exporting && (
        <Flex role="status" gap="8" className={cls.loadingNotice}>
          <LoaderCircle size={18} className={cls.spin} />
          <Text>{t('calls.exporting')}</Text>
        </Flex>
      )}
      {exportError && (
        <Text role="alert" className={cls.validationError}>
          {t('calls.exportError')}
        </Text>
      )}
      {periodError && (
        <Flex role="alert" className={cls.validationError} gap="8">
          <Text>{t('calls.timeRangeError')}</Text>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFiltersOpen(true);
              preset('today');
            }}
          >
            {t('calls.today')}
          </Button>
        </Flex>
      )}
      {data &&
        !ready &&
        !historyPreparing &&
        !periodError &&
        !isFetching &&
        !isError && (
          <VStack
            role="status"
            gap="12"
            align="stretch"
            className={cls.sourceState}
          >
            <Text variant="h3">{t('calls.historyUnavailable')}</Text>
            <Text variant="muted">{t('calls.historyUnavailableHint')}</Text>
            <Button
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {isFetching && (
                <LoaderCircle
                  key="source-loading"
                  size={16}
                  className={cls.spin}
                />
              )}
              {t('calls.refresh')}
            </Button>
          </VStack>
        )}
      {reportLoading && <CallReportSkeleton />}
      {ready && !periodError && !shortSearch && !isFetching && (
        <Flex className={cls.summary}>
          {metrics.map((metric) => (
            <VStack
              key={metric.label}
              gap="8"
              align="stretch"
              className={cls.metric}
              data-tone={metric.tone}
            >
              <metric.icon
                size={18}
                aria-hidden="true"
                className={cls.metricIcon}
              />
              <Flex gap="4" align="center">
                <Text variant="muted">{metric.label}</Text>
                {metric.label === t('calls.automation') && (
                  <InfoTooltip text={t('calls.automationHint')} />
                )}
                {metric.icon === Timer && summary && (
                  <InfoTooltip
                    text={t('calls.durationExplanation', {
                      count: summary.connectedSample,
                    })}
                  />
                )}
              </Flex>
              <Text variant="h2" className={cls.metricValue}>
                {isError || data?.source.state === 'unavailable'
                  ? '-'
                  : (metric.value ?? '-')}
              </Text>
            </VStack>
          ))}
        </Flex>
      )}
      {periodError || shortSearch ? null : isError ? (
        <QueryErrorState
          message={t('calls.loadError')}
          onRetry={() => void refetch()}
        />
      ) : reportLoading || !data || !ready ? null : (
        <>
          <Flex className={cls.desktop}>
            <Table
              columns={columns}
              data={data.rows}
              getRowId={(call) => call.id}
              getRowClassName={(call) =>
                `${cls.callRow} ${cls['outcome_' + call.outcome] || ''}`
              }
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
              <TableCard
                key={call.id}
                className={`${cls.mobileCall} ${cls['outcome_' + call.outcome] || ''}`}
                onActivate={() => open(call)}
              >
                <Text>
                  <PhoneNumber
                    number={call.caller.number}
                    name={call.caller.name}
                    fallback={unknown}
                  />{' '}
                  →{' '}
                  <PhoneNumber
                    number={call.recipient.number}
                    name={call.recipient.name}
                    fallback={unknown}
                  />
                </Text>
                <Text variant="muted">
                  {callTime(call.startedAt, timezone, i18n.language)} ·{' '}
                  {t(`calls.direction.${call.direction}`)}
                </Text>
                <Text>
                  {t(callOutcomeKey(call))} ·{' '}
                  {callDuration(call.connectedSec, call.timingSource === 'cdr')}
                </Text>
                <CallMaterials
                  call={call}
                  onVoicemail={setVoicemailId}
                  onTranscript={() => {
                    setMaterialCall(call.id);
                    open(call);
                  }}
                />
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
        key={
          (selected || 'closed') +
          ':' +
          (params.get('transcriptSegment') || '') +
          ':' +
          materialCall
        }
        initialTab={materialCall === selected ? 'recordings' : undefined}
        id={selected}
        transcriptSegment={params.get('transcriptSegment') || undefined}
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
