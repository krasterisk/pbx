import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardOverview, UserLevel } from '@krasterisk/shared';
import {
  useLazyGetDashboardRowsQuery,
  type DashboardRowsQuery,
} from '@/shared/api/endpoints/dashboardApi';
import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { filterPagesByLevel } from '@/features/modules/lib/moduleRegistry';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import {
  Button,
  HStack,
  VStack,
  Text,
  Input,
  Select,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  Badge,
  Skeleton,
  NavItem,
  QueryErrorState,
} from '@/shared/ui';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  PhoneCall,
  Users,
  Waypoints,
  Server,
  Wallet,
} from 'lucide-react';
import { DashboardSource } from './DashboardSource';
import { DashboardSystem } from './DashboardSystem';
import { DashboardCloud } from './DashboardCloud';
import {
  hasDashboardValue,
  isDashboardCall,
  sectionLink,
  type DashboardDetail,
} from '../model/dashboardView';
import cls from './Dashboard.module.scss';
const CdrLegsModal = lazy(() =>
  import('@/features/cdr/ui/CdrLegsModal/CdrLegsModal').then((module) => ({
    default: module.CdrLegsModal,
  })),
);

export function DashboardDetailSheet({
  entry,
  overview,
  onClose,
}: {
  entry: DashboardDetail | null;
  overview: DashboardOverview;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const DetailIcon =
    entry?.kind === 'system'
      ? Server
      : entry?.kind === 'cloud'
        ? Wallet
        : entry?.kind === 'endpoints'
          ? Users
          : entry?.kind === 'trunks'
            ? Waypoints
            : PhoneCall;
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    if (entry && !wasOpen.current)
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    wasOpen.current = Boolean(entry);
  }, [entry]);
  return (
    <Sheet
      open={Boolean(entry)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className={cls.sheet}
        onCloseAutoFocus={(event) => {
          if (opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus({ preventScroll: true });
          }
        }}
      >
        <SheetHeader className={cls.sheetHeader}>
          <HStack gap="12" align="start">
            <HStack justify="center" className={cls.sheetIcon}>
              <DetailIcon size={24} aria-hidden="true" />
            </HStack>
            <VStack gap="8" align="start">
              <SheetTitle className={cls.sheetTitle}>{entry?.title}</SheetTitle>
              <SheetDescription>
                {t(
                  entry?.kind === 'system'
                    ? 'dashboard.moreResources'
                    : entry?.kind === 'cloud'
                      ? 'dashboard.moreLimits'
                      : 'dashboard.detailHint',
                )}
              </SheetDescription>
            </VStack>
          </HStack>
        </SheetHeader>
        <VStack className={cls.sheetBody} gap="16" align="stretch">
          {entry?.kind === 'system' && (
            <DashboardSystem
              key={entry.nodeId}
              nodeId={entry.nodeId}
              timezone={overview.period.timezone}
            />
          )}
          {entry?.kind === 'cloud' && overview.cloud && (
            <DashboardCloud
              cloud={overview.cloud}
              live={overview.live}
              timezone={overview.period.timezone}
            />
          )}
          {entry && ['calls', 'endpoints', 'trunks'].includes(entry.kind) && (
            <DashboardRows key={JSON.stringify(entry)} entry={entry} overview={overview} />
          )}
        </VStack>
      </SheetContent>
    </Sheet>
  );
}

export function DashboardRows({
  entry,
  overview,
  showSectionLink = true,
}: {
  entry: DashboardDetail;
  overview: DashboardOverview;
  showSectionLink?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [trigger, query] = useLazyGetDashboardRowsQuery();
  const [search, setSearch] = useState(entry.filters?.search || '');
  const [legs, setLegs] = useState<string | null>(null);
  const [debounced, setDebounced] = useState(entry.filters?.search || '');
  const [direction, setDirection] = useState(entry.filters?.direction || '');
  const [outcome, setOutcome] = useState(entry.filters?.outcome || '');
  const [origin, setOrigin] = useState(entry.filters?.origin || '');
  const [callState, setCallState] = useState(entry.filters?.state || '');
  const [status, setStatus] = useState(entry.filters?.status || '');
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [page, setPage] = useState(0);
  const { navigation = [], isLoading: catalogLoading, isError: catalogError } = useHubModules();
  const user = useAppSelector((state) => state.auth.user);
  const filters = useMemo(
    () =>
      ({
        ...entry.filters,
        search: debounced || undefined,
        direction: direction || undefined,
        outcome: outcome || undefined,
        origin: origin || undefined,
        status: status || undefined,
        state: outcome === 'active' ? callState || undefined : undefined,
      }) as DashboardRowsQuery,
    [entry.filters, debounced, direction, outcome, origin, status, callState],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setCursors([undefined]);
    setPage(0);
  }, [filters]);
  const cursor = cursors[page];
  useEffect(() => {
    if (entry.kind !== 'calls' && entry.kind !== 'endpoints' && entry.kind !== 'trunks') return;
    const request = trigger({ kind: entry.kind, params: { ...filters, cursor, limit: 50 } });
    return () => request.abort();
  }, [trigger, entry.kind, filters, cursor]);
  const fullLink = sectionLink(entry.kind, filters);
  const accessible =
    !catalogLoading &&
    !catalogError &&
    fullLink &&
    navigation.some(
      (module) =>
        module.licenseStatus === 'active' &&
        module.tenantVisible !== false &&
        filterPagesByLevel(module.pages, user?.level as UserLevel | undefined).some(
          (item) => item.path === fullLink.split('?')[0],
        ),
    );
  const formatTime = (at: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      timeZone: overview.period.timezone,
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(at));
  const rows = query.currentData?.rows ?? [];
  const historyChanged =
    entry.kind === 'calls' &&
    outcome !== 'active' &&
    overview.historyVersion !== undefined &&
    query.currentData !== undefined &&
    hasDashboardValue(query.currentData.source) &&
    query.currentData.version !== overview.historyVersion;
  return (
    <VStack gap="16" align="stretch" max>
      <VStack gap="12" align="stretch" className={cls.detailToolbar}>
        <Text variant="xs">
          {entry.kind === 'calls' && outcome !== 'active'
            ? t('dashboard.detailPeriod', {
                from: formatTime(entry.filters?.from ?? overview.period.from),
                to: formatTime(entry.filters?.to ?? overview.period.to),
              })
            : t('dashboard.currentStateHint')}
        </Text>
        <HStack wrap="wrap" gap="8" className={cls.detailFilters}>
          <Input
            className={cls.search}
            aria-label={t('dashboard.search')}
            placeholder={t('dashboard.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {entry.kind === 'calls' ? (
            <>
              <Select
                className={cls.filter}
                aria-label={t('dashboard.direction')}
                value={direction}
                onChange={(e) => setDirection(e.target.value as typeof direction)}
                options={['', 'in', 'out', 'internal', 'external'].map((value) => ({
                  value,
                  label: t(value ? 'dashboard.directionValue.' + value : 'dashboard.allDirections'),
                }))}
              />
              <Select
                className={cls.filter}
                aria-label={t('dashboard.outcome')}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as typeof outcome)}
                options={['', 'accepted', 'missed', 'unknown', 'active'].map((value) => ({
                  value,
                  label: t(value ? 'dashboard.outcomeValue.' + value : 'dashboard.allOutcomes'),
                }))}
              />
              {outcome === 'active' && (
                <Select
                  className={cls.filter}
                  aria-label={t('dashboard.callState')}
                  value={callState}
                  onChange={(e) => setCallState(e.target.value as typeof callState)}
                  options={['', 'ringing', 'talking', 'waiting'].map((value) => ({
                    value,
                    label: t(value ? 'dashboard.state.' + value : 'dashboard.allStates'),
                  }))}
                />
              )}
              <Select
                className={cls.filter}
                aria-label={t('dashboard.origin')}
                value={origin}
                onChange={(e) => setOrigin(e.target.value as typeof origin)}
                options={['', 'telephony', 'autodial', 'ai'].map((value) => ({
                  value,
                  label: t(value ? 'dashboard.originValue.' + value : 'dashboard.allOrigins'),
                }))}
              />
            </>
          ) : (
            <Select
              className={cls.filter}
              aria-label={t('dashboard.status')}
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              options={['', 'online', 'offline', 'unknown'].map((value) => ({
                value,
                label: t(value ? 'dashboard.statusValue.' + value : 'dashboard.allStatuses'),
              }))}
            />
          )}
        </HStack>
      </VStack>
      {query.currentData && (
        <HStack justify="between" wrap="wrap" gap="12" className={cls.detailSummary}>
          <DashboardSource source={query.currentData.source} timezone={overview.period.timezone} />
          {hasDashboardValue(query.currentData.source) && (
            <Text variant="small">
              {t('dashboard.results', { count: query.currentData.total })}
            </Text>
          )}
        </HStack>
      )}
      {historyChanged && (
        <Text variant="muted" role="status">
          {t('dashboard.dataUpdated')}
        </Text>
      )}
      {query.isFetching && <Skeleton className={cls.empty} />}
      {query.isError && (
        <QueryErrorState
          onRetry={() =>
            trigger({
              kind: entry.kind as 'calls' | 'endpoints' | 'trunks',
              params: { ...filters, cursor, limit: 50 },
            })
          }
        />
      )}
      {!query.isFetching && !query.isError && !rows.length && (
        <Text align="center" variant="muted" className={cls.empty}>
          {t(query.currentData?.source.state === 'ok' ? 'dashboard.noResults' : 'dashboard.noData')}
        </Text>
      )}
      {!query.isFetching && (
        <VStack className={cls.detailRows} data-testid="dashboard-detail-rows">
          {rows.slice(0, 100).map((row) => (
            <VStack
              key={row.id}
              gap="12"
              align="stretch"
              className={cls.detailRow}
              data-tone={
                isDashboardCall(row)
                  ? row.outcome === 'accepted'
                    ? 'success'
                    : row.outcome === 'missed'
                      ? 'danger'
                      : 'primary'
                  : row.enabled && row.status === 'online'
                    ? 'success'
                    : 'warning'
              }
            >
              {isDashboardCall(row) ? (
                <>
                  <HStack justify="between" wrap="wrap" gap="8">
                    <Text className={cls.detailTitle}>
                      {row.src} → {row.dst}
                    </Text>
                    <Badge className={cls.outcomeBadge} variant="secondary">
                      {t('dashboard.outcomeValue.' + row.outcome)}
                    </Badge>
                  </HStack>
                  <Text variant="xs">
                    {formatTime(row.startedAt)} ·{' '}
                    {t('dashboard.durationSeconds', { count: row.duration })}
                  </Text>
                  <HStack className={cls.detailMeta}>
                    <Text variant="xs">{t('dashboard.directionValue.' + row.direction)}</Text>
                    <Badge variant="secondary">{t('dashboard.originValue.' + row.origin)}</Badge>
                    {row.state && (
                      <Text variant="xs">
                        {t('dashboard.state.' + row.state, { defaultValue: row.state })}
                      </Text>
                    )}
                  </HStack>
                  {row.linkedid && (
                    <Button
                      variant="outline"
                      className={cls.callDetails}
                      onClick={() => setLegs(row.linkedid)}
                    >
                      {t('dashboard.callDetails')}
                      <ChevronRight size={16} />
                    </Button>
                  )}
                  {row.reason && (
                    <Text variant="muted">
                      {t('dashboard.reason.' + row.reason, { defaultValue: row.reason })}
                    </Text>
                  )}
                </>
              ) : (
                <HStack justify="between" wrap="wrap" gap="8">
                  <Text className={cls.detailTitle}>{row.name || row.id}</Text>
                  <Badge className={cls.outcomeBadge} variant="secondary">
                    {t(row.enabled ? 'dashboard.statusValue.' + row.status : 'dashboard.disabled')}
                  </Badge>
                </HStack>
              )}
            </VStack>
          ))}
        </VStack>
      )}
      {legs && (
        <Suspense fallback={<Skeleton className={cls.empty} />}>
          <CdrLegsModal linkedid={legs} isOpen onClose={() => setLegs(null)} />
        </Suspense>
      )}
      <SheetFooter className={cls.sheetFooter}>
        <HStack justify="between" wrap="wrap" gap="8" max>
          <HStack gap="8">
            <Button
              variant="outline"
              size="icon"
              aria-label={t('dashboard.previousPage')}
              disabled={page === 0 || query.isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft />
            </Button>
            <Text variant="muted">{t('dashboard.page', { count: page + 1 })}</Text>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('dashboard.nextPage')}
              disabled={!query.currentData?.nextCursor || query.isFetching}
              onClick={() => {
                setCursors((values) => [
                  ...values.slice(0, page + 1),
                  query.currentData?.nextCursor ?? undefined,
                ]);
                setPage((value) => value + 1);
              }}
            >
              <ChevronRight />
            </Button>
          </HStack>
          {showSectionLink && accessible && fullLink && (
            <NavItem to={fullLink} variant="outline">
              <ExternalLink size={16} />
              {t('dashboard.openSection')}
            </NavItem>
          )}
        </HStack>
      </SheetFooter>
    </VStack>
  );
}
