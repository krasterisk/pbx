import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { Card, CardContent, Pagination, Text } from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
import {
  AuditLogStats,
  AuditLogFilter,
  AuditLogTable,
  WebhookFailuresTable,
  useGetAuditLogsQuery,
  useGetAuditLogStatsQuery,
  useGetWebhookFailuresQuery,
} from '@/features/audit-log';
import type { ActionLogFilters } from '@/features/audit-log';
import cls from './AuditLogPage.module.scss';

const PAGE_SIZE = 50;
type Tab = 'system' | 'webhooks';

const AuditLogPage = memo(() => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('system');

  const page = Number(searchParams.get('page') || '1');
  const filters: ActionLogFilters = {
    page,
    limit: PAGE_SIZE,
    action:      (searchParams.get('action') || '') as any,
    entity_type: (searchParams.get('entity_type') || '') as any,
    status:      (searchParams.get('status') || '') as any,
    dateFrom:    searchParams.get('dateFrom') || '',
    dateTo:      searchParams.get('dateTo') || '',
  };
  const whPage = Number(searchParams.get('whPage') || '1');

  const { data: logs, isLoading: logsLoading, isFetching } = useGetAuditLogsQuery(filters);
  const { data: stats, isLoading: statsLoading } = useGetAuditLogStatsQuery();
  const { data: failures, isLoading: failuresLoading } = useGetWebhookFailuresQuery({
    page: whPage, limit: PAGE_SIZE, resolved: false,
  });

  const handleFilterChange = useCallback((partial: Partial<ActionLogFilters>) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(partial.page ?? 1));
    Object.entries(partial).forEach(([k, v]) => {
      if (k === 'page') return;
      if (v) next.set(k, String(v)); else next.delete(k);
    });
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const totalPages   = logs     ? Math.ceil(logs.total     / PAGE_SIZE) : 0;
  const whTotalPages = failures ? Math.ceil(failures.total / PAGE_SIZE) : 0;
  const failureCount = failures?.total ?? 0;

  return (
    <VStack gap="24" max>
      {/* ── Page header ─────────────────────────────────── */}
      <Flex align="center" gap="12">
        <Flex align="center" justify="center" className={cls.iconWrap}>
          <ClipboardList className={cls.pageIcon} />
        </Flex>
        <VStack gap="2">
          <Text variant="h1">{t('auditLog.pageTitle')}</Text>
          <Text variant="muted">{t('auditLog.pageSubtitle')}</Text>
        </VStack>
      </Flex>

      {/* ── KPI cards ───────────────────────────────────── */}
      <AuditLogStats stats={stats} isLoading={statsLoading} />

      {/* ── Main card ───────────────────────────────────── */}
      <div className={cls.card}>

        {/* Tabs row */}
        <div className={cls.tabsRow}>
          {(['system', 'webhooks'] as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`${cls.tab} ${tab === key ? cls.tabActive : ''}`}
              onClick={() => setTab(key)}
            >
              {key === 'system' ? t('auditLog.tabSystem') : t('auditLog.tabWebhooks')}
              {key === 'webhooks' && failureCount > 0 && (
                <span className={cls.failureBadge}>{failureCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        {tab === 'system' && (
          <div className={cls.filterBar}>
            <AuditLogFilter filters={filters} onChange={handleFilterChange} />
          </div>
        )}

        {/* Table */}
        <div className={cls.tableWrap}>
          {tab === 'system' && (
            <AuditLogTable data={logs?.items ?? []} isLoading={logsLoading || isFetching} />
          )}
          {tab === 'webhooks' && (
            <WebhookFailuresTable
              data={failures?.items ?? []}
              isLoading={failuresLoading}
              total={failureCount}
            />
          )}
        </div>

        {/* Pagination */}
        {tab === 'system' && totalPages > 1 && (
          <div className={cls.pagination}>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => handleFilterChange({ page: p })}
            />
          </div>
        )}
        {tab === 'webhooks' && whTotalPages > 1 && (
          <div className={cls.pagination}>
            <Pagination
              currentPage={whPage}
              totalPages={whTotalPages}
              onPageChange={(p) => {
                const next = new URLSearchParams(searchParams);
                next.set('whPage', String(p));
                setSearchParams(next);
              }}
            />
          </div>
        )}
      </div>
    </VStack>
  );
});

AuditLogPage.displayName = 'AuditLogPage';
export default AuditLogPage;
