import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DashboardQuery } from '@krasterisk/shared';
import { ArrowLeft } from 'lucide-react';
import { Card, HStack, VStack, NavItem, Text, Skeleton, QueryErrorState } from '@/shared/ui';
import { useGetDashboardOverviewQuery, type DashboardRowsQuery } from '@/shared/api/endpoints/dashboardApi';
import { DashboardRows } from './DashboardDetailSheet';
import cls from './Dashboard.module.scss';
export function parseDashboardJournalParams(search: URLSearchParams): DashboardRowsQuery {
  const filters: DashboardRowsQuery = {};
  if (search.get('from') && search.get('to')) { filters.period = 'custom'; filters.from = search.get('from')!; filters.to = search.get('to')!; }
  else filters.period = 'today';
  const direction = search.get('direction'); const outcome = search.get('outcome'); const origin = search.get('origin'); const state = search.get('state');
  if (direction && ['in', 'out', 'internal', 'external'].includes(direction)) filters.direction = direction as DashboardQuery['direction'];
  if (outcome && ['accepted', 'missed', 'unknown', 'active'].includes(outcome)) filters.outcome = outcome as DashboardQuery['outcome'];
  if (origin && ['telephony', 'autodial', 'ai'].includes(origin)) filters.origin = origin as DashboardQuery['origin'];
  if (state && ['ringing', 'talking', 'waiting'].includes(state)) filters.state = state as DashboardRowsQuery['state'];
  const status = search.get('status');
  if (status && ['online', 'offline', 'unknown'].includes(status)) filters.status = status as DashboardRowsQuery['status'];
  if (search.get('search')) filters.search = search.get('search')!;
  return filters;
}
/** Logical-call journal shares exactly the classifier and filters of the overview. */
export function DashboardJournalView({ kind = 'calls' }: { kind?: 'calls' | 'endpoints' | 'trunks' }) {
  const { t } = useTranslation(); const [search] = useSearchParams();
  const filters = useMemo(() => parseDashboardJournalParams(search), [search]);
  const title = t(kind === 'calls' ? 'dashboard.logicalJournal' : 'dashboard.' + kind + 'Journal');
  const query = useGetDashboardOverviewQuery({ period: filters.period, from: filters.from, to: filters.to });
  return <VStack className={cls.page} gap="24" data-testid="dashboard-journal">
    <HStack justify="between" wrap="wrap" gap="12"><Text variant="h1">{title}</Text><NavItem to="/" variant="outline"><ArrowLeft size={16} />{t('dashboard.backToOverview')}</NavItem></HStack>
    <Text variant="muted">{t(kind === 'calls' ? 'dashboard.logicalJournalHint' : 'dashboard.inventoryJournalHint')}</Text>
    {!query.data && (query.isError ? <QueryErrorState onRetry={query.refetch} /> : <Skeleton className={cls.empty} />)}
    {query.data && <Card className={cls.section}><VStack className={cls.sectionBody}><DashboardRows key={search.toString()} entry={{ kind, title, filters }} overview={query.data} showSectionLink={false} /></VStack></Card>}
  </VStack>;
}
