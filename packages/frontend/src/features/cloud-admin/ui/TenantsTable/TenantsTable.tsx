import { memo, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Loader2, Plus, Search, ArrowRightLeft, ExternalLink, Pause, Pencil, Play } from 'lucide-react';
import {
  Card, CardHeader, CardContent,
  Input, Button, DataTable, Text,
  TableRowActions, TableRowAction,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useGetTenantsQuery,
  useGetTenantStatsQuery,
  useActivateTenantMutation,
  useImpersonateTenantMutation,
  useSuspendTenantMutation,
} from '@/shared/api/endpoints/cloudAdminApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import type { ITenant } from '@/entities/tenant';
import { tenantsPageActions } from '../../model/slice/tenantsPageSlice';
import { TenantStatusBadge } from '../TenantStatusBadge';
import { TenantDrawer } from '../TenantDrawer/TenantDrawer';
import { useTenantsTableColumns } from './useTenantsTableColumns';
import { rememberImpersonation, persistImpersonatedUser } from '@/features/auth/lib/impersonationSession';
import cls from './TenantsTable.module.scss';

export const TenantsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [suspend] = useSuspendTenantMutation();
  const [activate] = useActivateTenantMutation();
  const [impersonate] = useImpersonateTenantMutation();

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

  const handleImpersonate = async (tenant: ITenant) => {
    try {
      const { accessToken, user } = await impersonate(tenant.id).unwrap();
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('impersonation_token', accessToken);
      rememberImpersonation(tenant);
      if (user?.uniqueid) persistImpersonatedUser(user);
      window.location.href = '/';
    } catch (e) {
      console.error('Impersonate failed:', e);
    }
  };

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Building2 size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t('cloudAdmin.tenants.title')} ({data?.count ?? 0})
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <Flex align="center" className={cls.searchWrapper}>
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

  const renderTenantActions = (tenant: ITenant) => (
    <TableRowActions>
      <TableRowAction
        title={t('common.edit')}
        aria-label={t('common.edit')}
        onClick={() => dispatch(tenantsPageActions.openEditModal(tenant))}
      >
        <Pencil />
      </TableRowAction>
      <TableRowAction
        title={t('cloudAdmin.tenants.details')}
        aria-label={t('cloudAdmin.tenants.details')}
        onClick={() => dispatch(tenantsPageActions.openTenantDrawer(tenant))}
      >
        <ExternalLink />
      </TableRowAction>
      <TableRowAction
        title={t('cloudAdmin.drawer.impersonate')}
        aria-label={t('cloudAdmin.drawer.impersonate')}
        onClick={() => void handleImpersonate(tenant)}
      >
        <ArrowRightLeft />
      </TableRowAction>
      {tenant.status !== 'suspended' ? (
        <TableRowAction
          title={t('cloudAdmin.tenants.suspend')}
          aria-label={t('cloudAdmin.tenants.suspend')}
          onClick={() => suspend(tenant.id)}
        >
          <Pause />
        </TableRowAction>
      ) : (
        <TableRowAction
          title={t('cloudAdmin.tenants.activate')}
          aria-label={t('cloudAdmin.tenants.activate')}
          onClick={() => activate(tenant.id)}
        >
          <Play />
        </TableRowAction>
      )}
    </TableRowActions>
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
            <Button
              key={String(key)}
              type="button"
              variant="ghost"
              className={[
                cls.statCard,
                mod,
                statusFilter === key ? cls.statCardActive : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setStatusFilter(statusFilter === key ? null : key)}
            >
              <Text as="span" className={cls.statValue}>{value}</Text>
              <Text as="span" className={cls.statLabel}>{label}</Text>
            </Button>
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
                  gap="8"
                  className={cls.mobileCard}
                  data-testid="tenants-mobile-card"
                  max
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>{tenant.name}</Text>
                      {tenant.seller?.name && (
                        <Text as="span" className={cls.muted}>{tenant.seller.name}</Text>
                      )}
                      <TenantStatusBadge status={tenant.status} />
                    </VStack>
                    {renderTenantActions(tenant)}
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
