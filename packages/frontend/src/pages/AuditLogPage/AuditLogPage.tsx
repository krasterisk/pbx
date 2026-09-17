import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { Pagination, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
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
    action: (searchParams.get('action') || '') as ActionLogFilters['action'],
    entity_type: (searchParams.get('entity_type') || '') as ActionLogFilters['entity_type'],
    status: (searchParams.get('status') || '') as ActionLogFilters['status'],
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
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

  const totalPages = logs ? Math.ceil(logs.total / PAGE_SIZE) : 0;
  const whTotalPages = failures ? Math.ceil(failures.total / PAGE_SIZE) : 0;
  const failureCount = failures?.total ?? 0;

  return (
    <VStack gap="24" max className={cls.page} data-testid="audit-log-page-responsive">
      <Flex align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <ClipboardList size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>{t('auditLog.pageTitle')}</Text>
            <Text variant="muted">{t('auditLog.pageSubtitle')}</Text>
          </VStack>
        </HStack>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.statsScroll}>
        <AuditLogStats stats={stats} isLoading={statsLoading} />
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.card}>
        <Flex className={cls.tabsRow} align="stretch">
          {(['system', 'webhooks'] as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`${cls.tab} ${tab === key ? cls.tabActive : ''}`}
              onClick={() => setTab(key)}
            >
              {key === 'system' ? t('auditLog.tabSystem') : t('auditLog.tabWebhooks')}
              {key === 'webhooks' && failureCount > 0 && (
                <Text as="span" className={cls.failureBadge}>{failureCount}</Text>
              )}
            </button>
          ))}
        </Flex>

        {tab === 'system' && (
          <Flex direction="column" align="stretch" className={cls.filterBar} max>
            <AuditLogFilter filters={filters} onChange={handleFilterChange} />
          </Flex>
        )}

        <Flex
          direction="column"
          align="stretch"
          className={cls.tableWrap}
          data-testid="hybrid-table"
          data-hybrid="overflow-x-auto"
        >
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
        </Flex>

        {tab === 'system' && totalPages > 1 && (
          <Flex justify="center" className={cls.pagination} max>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => handleFilterChange({ page: p })}
            />
          </Flex>
        )}
        {tab === 'webhooks' && whTotalPages > 1 && (
          <Flex justify="center" className={cls.pagination} max>
            <Pagination
              currentPage={whPage}
              totalPages={whTotalPages}
              onPageChange={(p) => {
                const next = new URLSearchParams(searchParams);
                next.set('whPage', String(p));
                setSearchParams(next);
              }}
            />
          </Flex>
        )}
      </Flex>
    </VStack>
  );
});

AuditLogPage.displayName = 'AuditLogPage';
export default AuditLogPage;
