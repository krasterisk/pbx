import { memo, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Loader2, Plus, Search } from 'lucide-react';
import {
  Card, CardHeader, CardContent,
  Input, Button, DataTable, Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useGetTenantsQuery, useGetTenantStatsQuery } from '@/shared/api/endpoints/cloudAdminApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import type { ITenant } from '@/entities/tenant';
import { tenantsPageActions } from '../../model/slice/tenantsPageSlice';
import { TenantStatusBadge } from '../TenantStatusBadge';
import { TenantDrawer } from '../TenantDrawer/TenantDrawer';
import { useTenantsTableColumns } from './useTenantsTableColumns';
import cls from './TenantsTable.module.scss';

export const TenantsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 350);
  };

  const { data, isLoading } = useGetTenantsQuery({
    search: debouncedSearch || undefined,
    limit: 50,
    offset: 0,
  });
  const { data: stats } = useGetTenantStatsQuery();
  const columns = useTenantsTableColumns();

  const allTenants = data?.rows ?? [];
  const tenants = useMemo(
    () => (statusFilter ? allTenants.filter((item) => item.status === statusFilter) : allTenants),
    [allTenants, statusFilter],
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Building2 size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t('cloudAdmin.tenants.title')} ({data?.count ?? 0})
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="tenants-search"
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={cls.searchInput}
          />
        </Flex>
        <Button
          id="tenants-create-btn"
          onClick={() => dispatch(tenantsPageActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('cloudAdmin.tenants.create')}</Text>
        </Button>
      </HStack>
    </Flex>
  );

  return (
    <VStack gap="16" max className={cls.wrapper}>
      <TenantDrawer />
      {stats && (
        <Flex className={cls.statsGrid} max>
          {([
            { key: null, label: t('cloudAdmin.stats.all'), value: stats.total, mod: '' },
            { key: 'active', label: t('cloudAdmin.stats.active'), value: stats.active, mod: cls.statActive },
            { key: 'trial', label: t('cloudAdmin.stats.trial'), value: stats.trial, mod: cls.statTrial },
            { key: 'suspended', label: t('cloudAdmin.stats.suspended'), value: stats.suspended, mod: cls.statSuspended },
          ] as const).map(({ key, label, value, mod }) => (
            <button
              key={String(key)}
              type="button"
              className={`${cls.statCard} ${mod} ${statusFilter === key ? cls.statCardActive : ''}`}
              onClick={() => setStatusFilter(statusFilter === key ? null : key)}
            >
              <Text as="span" className={cls.statValue}>{value}</Text>
              <Text as="span" className={cls.statLabel}>{label}</Text>
            </button>
          ))}
        </Flex>
      )}

      {isLoading ? (
        <Card className={cls.card}>
          <CardHeader>{toolbar}</CardHeader>
          <CardContent>
            <Flex align="center" justify="center" className={cls.loading}>
              <Loader2 size={24} className={cls.spinner} />
            </Flex>
          </CardContent>
        </Card>
      ) : isMobile ? (
        <Card className={cls.card} data-testid="hybrid-table" data-hybrid="mobile-card">
          <CardHeader>{toolbar}</CardHeader>
          <CardContent>
            <VStack gap="8" max>
              {tenants.map((tenant: ITenant) => (
                <Flex
                  key={tenant.id}
                  direction="column"
                  className={cls.mobileCard}
                  data-testid="tenants-mobile-card"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>{tenant.name}</Text>
                      <TenantStatusBadge status={tenant.status} />
                    </VStack>
                  </HStack>
                </Flex>
              ))}
            </VStack>
          </CardContent>
        </Card>
      ) : (
        <Card className={cls.card} data-testid="hybrid-table" data-hybrid="overflow-x-auto">
          <CardHeader>{toolbar}</CardHeader>
          <CardContent className={cls.cardContent}>
            <Flex
              direction="column"
              align="stretch"
              className={cls.tableScroll}
              data-testid="tenants-table-scroll"
            >
              <DataTable
                className={cls.table}
                data={tenants}
                columns={columns}
                getRowId={(row) => String(row.id)}
                pageSize={50}
                emptyText={t('common.noData')}
                exportFilename="tenants_export"
              />
            </Flex>
          </CardContent>
        </Card>
      )}
    </VStack>
  );
});

TenantsTable.displayName = 'TenantsTable';
