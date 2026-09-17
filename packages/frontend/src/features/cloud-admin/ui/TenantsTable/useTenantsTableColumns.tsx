import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowRightLeft, ExternalLink, Pause, Pencil, Play } from 'lucide-react';
import { TableRowAction, TableRowActions, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  useActivateTenantMutation,
  useImpersonateTenantMutation,
  useSuspendTenantMutation,
} from '@/shared/api/endpoints/cloudAdminApi';
import type { ITenant } from '@/entities/tenant';
import { tenantsPageActions } from '../../model/slice/tenantsPageSlice';
import { TenantStatusBadge } from '../TenantStatusBadge';
import cls from './TenantsTable.module.scss';

export const useTenantsTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [suspend] = useSuspendTenantMutation();
  const [activate] = useActivateTenantMutation();
  const [impersonate] = useImpersonateTenantMutation();

  return useMemo<ColumnDef<ITenant>[]>(() => [
    {
      accessorKey: 'name',
      header: t('cloudAdmin.tenants.name'),
      cell: ({ row }) => (
        <VStack gap="2">
          <Text as="span" className={cls.name}>{row.original.name}</Text>
          {row.original.slug && (
            <Text as="span" className={cls.muted}>{row.original.slug}</Text>
          )}
        </VStack>
      ),
    },
    {
      accessorKey: 'email',
      header: t('cloudAdmin.tenants.email'),
      cell: ({ getValue }) => (
        <Text as="span" className={cls.muted}>{String(getValue() ?? '-')}</Text>
      ),
    },
    {
      accessorKey: 'status',
      header: t('cloudAdmin.tenants.status'),
      cell: ({ getValue }) => (
        <TenantStatusBadge status={getValue() as ITenant['status']} />
      ),
    },
    {
      accessorKey: 'max_extensions',
      header: t('cloudAdmin.tenants.limits'),
      cell: ({ row }) => (
        <Text as="span" className={cls.muted}>
          {t('cloudAdmin.tenants.limitsValue', {
            extensions: row.original.max_extensions,
            trunks: row.original.max_trunks,
          })}
        </Text>
      ),
    },
    {
      accessorKey: 'created_at',
      header: t('cloudAdmin.tenants.createdAt'),
      cell: ({ getValue }) => (
        <Text as="span" className={cls.muted}>
          {new Date(String(getValue())).toLocaleDateString('ru-RU')}
        </Text>
      ),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => {
        const tenant = row.original;
        return (
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
              onClick={async () => {
                try {
                  const { accessToken } = await impersonate(tenant.id).unwrap();
                  localStorage.setItem('accessToken', accessToken);
                  localStorage.setItem('impersonation_token', accessToken);
                  window.location.href = '/';
                } catch (e) {
                  console.error('Impersonate failed:', e);
                }
              }}
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
      },
    },
  ], [t, dispatch, suspend, activate, impersonate]);
};
