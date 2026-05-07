import { memo, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Building2, Search, Loader2, Plus, MoreHorizontal, Pause, Play, Pencil, ExternalLink } from 'lucide-react';
import {
  Card, CardHeader, CardContent,
  Input, Button, DataTable, Text,
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/shared/ui';
import { HStack, VStack, Flex } from '@/shared/ui/Stack';
import {
  useGetTenantsQuery,
  useGetTenantStatsQuery,
  useSuspendTenantMutation,
  useActivateTenantMutation,
} from '@/shared/api/endpoints/cloudAdminApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import type { ITenant } from '@/entities/tenant';
import { tenantsPageActions } from '../../model/slice/tenantsPageSlice';
import { TenantStatusBadge } from '../TenantStatusBadge';
import { TenantDrawer } from '../TenantDrawer/TenantDrawer';
import cls from './TenantsTable.module.scss';

export const TenantsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [drawerTenant, setDrawerTenant] = useState<ITenant | null>(null);

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout((handleSearchChange as any)._timer);
    (handleSearchChange as any)._timer = setTimeout(() => setDebouncedSearch(value), 350);
  };

  const { data, isLoading } = useGetTenantsQuery({
    search: debouncedSearch || undefined,
    limit: 50,
    offset: 0,
  });
  const { data: stats } = useGetTenantStatsQuery();
  const [suspend] = useSuspendTenantMutation();
  const [activate] = useActivateTenantMutation();

  const allTenants = data?.rows ?? [];
  const tenants = useMemo(() =>
    statusFilter ? allTenants.filter((t) => t.status === statusFilter) : allTenants,
  [allTenants, statusFilter]);

  const columns: ColumnDef<ITenant>[] = useMemo(() => [
    {
      accessorKey: 'name',
      header: t('cloudAdmin.tenants.name', 'Название'),
      cell: ({ row }) => (
        <VStack gap="2">
          <Text weight="semibold">{row.original.name}</Text>
          {row.original.slug && (
            <Text size="xs" color="muted">{row.original.slug}</Text>
          )}
        </VStack>
      ),
    },
    {
      accessorKey: 'email',
      header: t('cloudAdmin.tenants.email', 'Email'),
      cell: ({ getValue }) => (
        <Text size="sm" color="muted">{String(getValue() ?? '-')}</Text>
      ),
    },
    {
      accessorKey: 'status',
      header: t('cloudAdmin.tenants.status', 'Статус'),
      cell: ({ getValue }) => (
        <TenantStatusBadge status={getValue() as any} />
      ),
    },
    {
      accessorKey: 'max_extensions',
      header: t('cloudAdmin.tenants.limits', 'Лимиты'),
      cell: ({ row }) => (
        <Text size="sm" color="muted">
          {`${row.original.max_extensions} номеров / ${row.original.max_trunks} транков`}
        </Text>
      ),
    },
    {
      accessorKey: 'created_at',
      header: t('common.createdAt', 'Создан'),
      cell: ({ getValue }) => (
        <Text size="sm" color="muted">
          {new Date(String(getValue())).toLocaleDateString('ru-RU')}
        </Text>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const tenant = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDrawerTenant(tenant)}>
                <ExternalLink className="w-4 h-4 mr-2" />
                {t('common.details', 'Детали')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => dispatch(tenantsPageActions.openEditModal(tenant))}
              >
                <Pencil className="w-4 h-4 mr-2" />
                {t('common.edit', 'Редактировать')}
              </DropdownMenuItem>
              {tenant.status !== 'suspended' ? (
                <DropdownMenuItem onClick={() => suspend(tenant.id)}>
                  <Pause className="w-4 h-4 mr-2" />
                  {t('cloudAdmin.tenants.suspend', 'Заблокировать')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => activate(tenant.id)}>
                  <Play className="w-4 h-4 mr-2" />
                  {t('cloudAdmin.tenants.activate', 'Активировать')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], [t, dispatch, suspend, activate]);

  return (
    <VStack gap="16" className={cls.wrapper}>
      {/* TenantDrawer */}
      <TenantDrawer tenant={drawerTenant} onClose={() => setDrawerTenant(null)} />
      {/* Stats */}
      {stats && (
        <div className={cls.statsGrid}>
          {([
            { key: null,         label: t('cloudAdmin.stats.all', 'Все кабинеты'), value: stats.total, mod: '' },
            { key: 'active',     label: t('cloudAdmin.stats.active', 'Активных'),      value: stats.active,    mod: cls.statActive },
            { key: 'trial',      label: t('cloudAdmin.stats.trial', 'На пробном'),     value: stats.trial,     mod: cls.statTrial },
            { key: 'suspended',  label: t('cloudAdmin.stats.suspended', 'Заблокированных'), value: stats.suspended, mod: cls.statSuspended },
          ] as const).map(({ key, label, value, mod }) => (
            <button
              key={String(key)}
              className={`${cls.statCard} ${mod} ${statusFilter === key ? cls.statCardActive : ''}`}
              onClick={() => setStatusFilter(statusFilter === key ? null : key)}
            >
              <div className={cls.statValue}>{value}</div>
              <div className={cls.statLabel}>{label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
            <HStack gap="8" align="center">
              <Building2 className="w-5 h-5 text-primary" />
              <Text weight="semibold" size="lg">
                {t('cloudAdmin.tenants.title', 'Кабинеты')} ({data?.count ?? 0})
              </Text>
            </HStack>
            <HStack gap="12" align="center" className="w-full sm:w-auto">
              <div className={cls.searchWrapper}>
                <Search className={`${cls.searchIcon} w-4 h-4`} />
                <Input
                  id="tenants-search"
                  placeholder={t('common.search', 'Поиск...')}
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
              <Button
                id="tenants-create-btn"
                onClick={() => dispatch(tenantsPageActions.openCreateModal())}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('cloudAdmin.tenants.create', 'Новый кабинет')}
              </Button>
            </HStack>
          </HStack>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <Flex align="center" justify="center" className="h-48">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </Flex>
          ) : (
            <DataTable
              data={tenants}
              columns={columns}
              getRowId={(row) => String(row.id)}
              pageSize={50}
              emptyText={t('common.noData', 'Нет данных')}
              exportFilename="tenants_export"
            />
          )}
        </CardContent>
      </Card>
    </VStack>
  );
});

TenantsTable.displayName = 'TenantsTable';
