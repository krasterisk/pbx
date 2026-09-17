import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useDeleteAiProviderMutation,
  useGetAiProvidersQuery,
  type IAiProvider,
} from '@/shared/api/endpoints/aiAgentsApi';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useAiProvidersTableColumns } from './useAiProvidersTableColumns';
import cls from './AiProvidersTable.module.scss';

interface Props {
  onEdit: (provider: IAiProvider) => void;
}

export const AiProvidersTable = memo(({ onEdit }: Props) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const { data: providers = [], isLoading } = useGetAiProvidersQuery();
  const [deleteProvider] = useDeleteAiProviderMutation();
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const columns = useAiProvidersTableColumns({ onEdit });
  const selectedCount = Object.keys(rowSelection).length;

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

  const handleBulkDelete = useCallback(async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;
    if (!window.confirm(t('aiProviders.confirmBulkDelete'))) return;
    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => deleteProvider(id).unwrap()));
      setRowSelection({});
    } finally {
      setIsDeleting(false);
    }
  }, [rowSelection, deleteProvider, t]);

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
            className={selectedCount === 0 ? cls.bulkBtnHidden : undefined}
            disabled={isDeleting || selectedCount === 0}
            aria-hidden={selectedCount === 0}
            tabIndex={selectedCount === 0 ? -1 : undefined}
            onClick={handleBulkDelete}
          >
            {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : <Trash2 size={16} />}
            {t('aiProviders.deleteSelected', { count: selectedCount })}
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
            className={cls.table}
            columns={columns}
            data={providers}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            globalFilter={globalFilter}
            pageSize={50}
            emptyText={t('aiProviders.empty')}
            exportFilename="ai_providers"
          />
        </Flex>
      </CardContent>
    </Card>
  );
});

AiProvidersTable.displayName = 'AiProvidersTable';
