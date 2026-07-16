import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, Cable, Trash2, Pencil, Copy } from 'lucide-react';
import { Card, CardHeader, CardContent, Input, Button, DataTable, Text } from '@/shared/ui';
import { HStack, Flex, VStack } from '@/shared/ui/Stack';
import {
  useGetTrunksQuery,
  useBulkDeleteTrunksMutation,
  useDeleteTrunkMutation,
} from '@/shared/api/endpoints/trunkApi';
import type { ITrunkListItem } from '@/shared/api/endpoints/trunkApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { trunksPageActions } from '../../model/slice/trunksPageSlice';
import { useTrunksTableColumns } from './useTrunksTableColumns';

export const TrunksTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: trunks = [], isLoading } = useGetTrunksQuery();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteTrunksMutation();
  const [deleteTrunk] = useDeleteTrunkMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const columns = useTrunksTableColumns();

  const registeredCount = trunks.filter(
    (tr) => tr.registrationStatus === 'Registered',
  ).length;

  const selectedCount = Object.keys(rowSelection).length;

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return trunks;
    return trunks.filter((tr) => {
      const name = (tr.name || '').toLowerCase();
      const host = (tr.host || '').toLowerCase();
      const username = (tr.username || '').toLowerCase();
      const context = (tr.context || '').toLowerCase();
      return name.includes(q) || host.includes(q) || username.includes(q) || context.includes(q);
    });
  }, [trunks, globalFilter]);

  const handleBulkDelete = async () => {
    const ids = Object.keys(rowSelection);
    if (!ids.length) return;

    if (window.confirm(t('common.confirmDelete', 'Вы уверены, что хотите удалить?'))) {
      await bulkDelete(ids).unwrap();
      setRowSelection({});
    }
  };

  const toolbar = (
    <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
      <HStack gap="8" align="center">
        <Cable className="w-5 h-5 text-primary" />
        <span className="font-semibold text-lg">
          {t('trunks.count', { count: trunks.length })}
        </span>
        {trunks.length > 0 && (
          <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            {registeredCount} {t('trunks.statusRegistered', 'Registered').toLowerCase()}
          </span>
        )}
      </HStack>
      <HStack gap="12" align="center" className="w-full sm:w-auto min-w-0">
        {selectedCount > 0 && !isMobile && (
          <Button
            variant="destructive"
            disabled={isDeleting}
            onClick={handleBulkDelete}
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            {t('common.deleteSelected', 'Удалить выбранные')} ({selectedCount})
          </Button>
        )}
        <div className="relative w-full sm:w-64 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="trunks-search"
            placeholder={t('common.search')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
      </HStack>
    </HStack>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <Flex align="center" justify="center" className="h-48">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </Flex>
        </CardContent>
      </Card>
    );
  }

  // D-29 hybrid: critical columns as cards on phone
  if (isMobile) {
    return (
      <Card data-testid="hybrid-table" data-hybrid="mobile-card">
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <VStack gap="8" max>
            {filtered.length === 0 ? (
              <Text variant="muted" className="py-8 text-center w-full">
                {t('common.noData')}
              </Text>
            ) : (
              filtered.map((trunk) => {
                const isRegistered = trunk.registrationStatus === 'Registered';
                const isRejected = trunk.registrationStatus === 'Rejected';
                return (
                  <div
                    key={trunk.id}
                    className="rounded-lg border border-border/60 bg-muted/10 p-3 mobile-card"
                    data-testid="trunks-mobile-card"
                  >
                    <HStack justify="between" align="start" max>
                      <VStack gap="4" className="min-w-0">
                        <HStack gap="8" align="center">
                          <Text className="font-semibold text-primary truncate">{trunk.name}</Text>
                          {trunk.trunkType === 'auth' ? (
                            <>
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isRegistered
                                    ? 'bg-emerald-400'
                                    : isRejected
                                      ? 'bg-red-400'
                                      : 'bg-zinc-600'
                                }`}
                              />
                              <Text variant="muted" className="text-xs shrink-0">
                                {trunk.registrationStatus || 'unknown'}
                              </Text>
                            </>
                          ) : (
                            <Text variant="muted" className="text-xs shrink-0">IP</Text>
                          )}
                        </HStack>
                        <Text className="text-sm font-mono truncate">{trunk.host || '—'}</Text>
                        {trunk.context ? (
                          <Text variant="muted" className="text-xs font-mono">{trunk.context}</Text>
                        ) : null}
                      </VStack>
                      <HStack gap="4" className="shrink-0">
                        <button
                          className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground"
                          title={t('common.edit')}
                          onClick={() => dispatch(trunksPageActions.openEditModal(trunk))}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground"
                          title={t('trunks.copy', 'Копировать')}
                          onClick={() => dispatch(trunksPageActions.openCopyModal(trunk))}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                          title={t('common.delete')}
                          onClick={() => {
                            if (window.confirm(t('trunks.confirmDelete', { name: trunk.name }))) {
                              deleteTrunk(trunk.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </HStack>
                    </HStack>
                  </div>
                );
              })
            )}
          </VStack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="hybrid-table" data-hybrid="overflow-x-auto">
      <CardHeader>{toolbar}</CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto min-w-0" data-testid="trunks-table-scroll">
          <DataTable
            data={trunks as ITrunkListItem[]}
            columns={columns}
            getRowId={(row) => row.id}
            globalFilter={globalFilter}
            selectable={true}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            pageSize={50}
            emptyText={t('common.noData')}
            exportFilename="trunks_export"
          />
        </div>
      </CardContent>
    </Card>
  );
});

TrunksTable.displayName = 'TrunksTable';
