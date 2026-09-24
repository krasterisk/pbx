import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Table } from '@tanstack/react-table';
import { Loader2, Pencil, Plug, Search, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  Input,
  TableRowAction,
  TableRowActions,
  TableSelectionBanner,
  BulkDeleteDialog,
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useDeleteAiProviderMutation,
  useDeleteGlobalAiProviderMutation,
  useGetAiProvidersQuery,
  useGetGlobalAiProvidersQuery,
  type AiCapability,
  type IAiProvider,
} from '@/shared/api/endpoints/aiAgentsApi';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useCrossPageRowSelection } from '@/shared/hooks/useCrossPageRowSelection';
import { useAiProvidersTableColumns } from './useAiProvidersTableColumns';
import cls from './AiProvidersTable.module.scss';

interface Props {
  onEdit: (provider: IAiProvider) => void;
  scope?: 'tenant' | 'global';
  capability?: AiCapability;
}

const PAGE_SIZE = 50;

export const AiProvidersTable = memo(({ onEdit, scope = 'tenant', capability }: Props) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const tenantQuery = useGetAiProvidersQuery(
    capability ? { capability } : undefined,
    { skip: scope === 'global' },
  );
  const globalQuery = useGetGlobalAiProvidersQuery(undefined, { skip: scope !== 'global' });
  const query = scope === 'global' ? globalQuery : tenantQuery;
  const providers = (query.data ?? []).filter((provider) => (
    !capability || provider.capabilities?.includes(capability)
  ));
  const isLoading = query.isLoading;
  const [deleteTenant] = useDeleteAiProviderMutation();
  const [deleteGlobal] = useDeleteGlobalAiProviderMutation();
  const deleteProvider = scope === 'global' ? deleteGlobal : deleteTenant;
  const [globalFilter, setGlobalFilter] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const selection = useCrossPageRowSelection({ globalFilter });
  const columns = useAiProvidersTableColumns({ onEdit });

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = providers.find((provider) => String(provider.uid) === id);
        return row?.name || id;
      }),
    [selection.selectedIds, providers],
  );

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((provider) => {
      const name = (provider.name || '').toLowerCase();
      const vendor = (provider.vendor || '').toLowerCase();
      return name.includes(q) || vendor.includes(q);
    });
  }, [providers, globalFilter]);

  const renderRowActions = (provider: IAiProvider) => (
    <TableRowActions>
      <TableRowAction
        title={t('common.edit')}
        aria-label={t('common.edit')}
        onClick={() => onEdit(provider)}
      >
        <Pencil />
      </TableRowAction>
      <TableRowAction
        danger
        title={t('common.delete')}
        aria-label={t('common.delete')}
        onClick={() => {
          if (window.confirm(t('aiProviders.confirmDelete', { name: provider.name }))) {
            void deleteProvider(provider.uid);
          }
        }}
      >
        <Trash2 />
      </TableRowAction>
    </TableRowActions>
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = selection.selectedIds.map(Number);
    if (!ids.length) return;
    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => deleteProvider(id).unwrap()));
      selection.afterBulkDelete();
    } finally {
      setIsDeleting(false);
    }
  }, [selection, deleteProvider]);

  const renderSelectionBanner = useCallback(
    (table: Table<(typeof providers)[number]>) => (
      <TableSelectionBanner
        table={table}
        pageSize={PAGE_SIZE}
        allMatchingSelected={selection.allMatchingSelected}
        selectedIds={selection.selectedIds}
        selectedCount={selection.selectedCount}
        onSelectAllMatching={selection.selectAllMatching}
        onClear={selection.clearSelection}
      />
    ),
    [selection],
  );

  const bulkDeleteDialog = (
    <BulkDeleteDialog
      open={selection.bulkDeleteOpen}
      onOpenChange={selection.setBulkDeleteOpen}
      labels={selectedLabels}
      allMatching={selection.allMatchingSelected}
      hasFilter={globalFilter.trim().length > 0}
      isDeleting={isDeleting}
      onConfirm={handleConfirmBulkDelete}
      i18nNs="aiProviders"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Plug size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('aiProviders.count', { count: providers.length })}</Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        {!isMobile && (
          <Button
            variant="destructive"
            className={selection.selectedCount === 0 ? cls.bulkBtnHidden : undefined}
            disabled={isDeleting || selection.selectedCount === 0}
            aria-hidden={selection.selectedCount === 0}
            tabIndex={selection.selectedCount === 0 ? -1 : undefined}
            onClick={selection.openBulkDelete}
          >
            {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : <Trash2 size={16} />}
            {t('aiProviders.deleteSelected', { count: selection.selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="ai-providers-search"
            placeholder={t('common.search')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className={cls.searchInput}
          />
        </Flex>
      </HStack>
    </Flex>
  );

  if (isLoading) {
    return (
      <Card className={cls.card}>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <Flex align="center" justify="center" className={cls.loading}>
            <Loader2 size={24} className={cls.spinner} />
          </Flex>
        </CardContent>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <Card className={cls.card} data-testid="hybrid-table" data-hybrid="mobile-card">
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <VStack gap="8" max className={cls.mobileList}>
            {filtered.length === 0 ? (
              <Text variant="muted" className={cls.mobileEmpty}>
                {t('aiProviders.empty')}
              </Text>
            ) : (
              filtered.map((provider) => (
                <Flex
                  key={provider.uid}
                  direction="column"
                  className={cls.mobileCard}
                  data-testid="ai-providers-mobile-card"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>{provider.name}</Text>
                      <Text as="span" className={cls.cell}>{provider.vendor}</Text>
                      <Text as="span" className={provider.enabled ? cls.statusOn : cls.statusOff}>
                        {provider.enabled ? t('aiProviders.statusOn') : t('aiProviders.statusOff')}
                      </Text>
                    </VStack>
                    {renderRowActions(provider)}
                  </HStack>
                </Flex>
              ))
            )}
          </VStack>
        </CardContent>
        {bulkDeleteDialog}
      </Card>
    );
  }

  return (
    <Card className={cls.card} data-testid="hybrid-table" data-hybrid="overflow-x-auto">
      <CardHeader>{toolbar}</CardHeader>
      <CardContent className={cls.cardContent}>
        <Flex
          direction="column"
          align="stretch"
          className={cls.tableScroll}
          data-testid="ai-providers-table-scroll"
        >
          <DataTable
            ref={selection.tableRef}
            className={cls.table}
            columns={columns}
            data={providers}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t('aiProviders.empty')}
            exportFilename="ai_providers"
            selectAllAriaLabel={t('common.selectPageAria')}
            renderBanner={renderSelectionBanner}
          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

AiProvidersTable.displayName = 'AiProvidersTable';
