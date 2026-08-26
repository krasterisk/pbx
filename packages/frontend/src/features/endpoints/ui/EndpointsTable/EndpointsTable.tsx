import React, { memo, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type RowSelectionState } from '@tanstack/react-table';
import { Phone, Search, Loader2, Trash2, Download, Pencil, Key } from 'lucide-react';
import { type DataTableRef } from '@/shared/ui/DataTable/DataTable';
import { Card, CardHeader, CardContent, Input, Button, DataTable, Text, TableRowActions, TableRowAction } from '@/shared/ui';
import { HStack, Flex, VStack } from '@/shared/ui/Stack';
import {
  useGetEndpointsQuery,
  useBulkDeleteEndpointsMutation,
  useGetActiveBulkJobQuery,
  useGetBulkJobStatusQuery,
  useDeleteEndpointMutation,
} from '@/shared/api/endpoints/endpointApi';
import type { IEndpointListItem } from '@/shared/api/endpoints/endpointApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { endpointsPageActions } from '../../model/slice/endpointsPageSlice';
import { useEndpointsTableColumns } from './useEndpointsTableColumns';

function parseCallerName(raw: string): string {
  const match = (raw || '').match(/^"(.+?)"/);
  return match ? match[1] : raw || '-';
}

export const EndpointsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: endpoints = [], isLoading } = useGetEndpointsQuery();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteEndpointsMutation();
  const [deleteEndpoint] = useDeleteEndpointMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const tableRef = React.useRef<DataTableRef>(null);

  const columns = useEndpointsTableColumns();

  const selectedCount = Object.keys(rowSelection).length;

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return endpoints;
    return endpoints.filter((ep) => {
      const ext = (ep.extension || '').toLowerCase();
      const caller = (ep.callerid || '').toLowerCase();
      const dept = (ep.department || '').toLowerCase();
      const ctx = (ep.context || '').toLowerCase();
      return ext.includes(q) || caller.includes(q) || dept.includes(q) || ctx.includes(q);
    });
  }, [endpoints, globalFilter]);

  const handleBulkDelete = useCallback(async () => {
    const sipIds = Object.keys(rowSelection);
    if (sipIds.length === 0) return;

    const extensions = sipIds
      .map((id) => {
        const ep = endpoints.find((e) => e.id === id);
        return ep?.extension || id;
      })
      .join(', ');

    if (!window.confirm(t('endpoints.confirmBulkDelete', { count: sipIds.length, extensions }))) return;

    try {
      await bulkDelete(sipIds).unwrap();
      setRowSelection({});
    } catch (e) {
      console.error('Bulk delete failed:', e);
    }
  }, [rowSelection, endpoints, bulkDelete, t]);

  // Background bulk create progress
  const { data: activeJobData } = useGetActiveBulkJobQuery(undefined, { pollingInterval: 3000 });
  const activeJobId = activeJobData?.jobId || null;
  const { data: jobStatus } = useGetBulkJobStatusQuery(activeJobId || '', {
    skip: !activeJobId,
    pollingInterval: 1000,
  });
  const isJobActive = jobStatus && (jobStatus.status === 'pending' || jobStatus.status === 'processing');

  const onlineCount = endpoints.filter((e) => e.status === 'online').length;

  const toolbar = (
    <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
      <HStack gap="8" align="center">
        <Phone className="w-5 h-5 text-primary" />
        <span className="font-semibold text-lg">
          {t('endpoints.count', { count: endpoints.length })}
        </span>
        {endpoints.length > 0 && (
          <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            {onlineCount} {t('endpoints.statusOnline').toLowerCase()}
          </span>
        )}
      </HStack>
      <HStack gap="8" align="center" className="w-full sm:w-auto">
        {selectedCount > 0 && !isMobile && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 text-destructive hover:text-destructive border-destructive/30 bg-destructive/10 hover:bg-destructive/20"
            onClick={handleBulkDelete}
            disabled={isDeleting}
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? '...' : t('endpoints.deleteSelected', { count: selectedCount })}
          </Button>
        )}
        <div className="relative w-full sm:w-64 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="endpoints-search"
            placeholder={t('common.search')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
        {!isMobile && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => tableRef.current?.exportCsv()}
            className="h-9 gap-2 text-xs font-medium border-dashed border-2 hover:border-primary/50 text-muted-foreground hover:text-primary transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </Button>
        )}
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
          {isJobActive && jobStatus && (
            <div className="mb-3 w-full">
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                <div className="flex-1 bg-accent rounded-full h-3 overflow-hidden relative border border-border">
                  <div
                    className="bg-primary h-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.max(3, Math.round((jobStatus.processed / jobStatus.total) * 100))}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {jobStatus.processed}/{jobStatus.total}
                </span>
              </div>
            </div>
          )}
          <VStack gap="8" max>
            {filtered.length === 0 ? (
              <Text variant="muted" className="py-8 text-center w-full">
                {t('common.noData')}
              </Text>
            ) : (
              filtered.map((ep) => {
                const isOnline = ep.status === 'online';
                return (
                  <div
                    key={ep.id}
                    className="rounded-lg border border-border/60 bg-muted/10 p-3 mobile-card"
                    data-testid="endpoints-mobile-card"
                  >
                    <HStack justify="between" align="start" max>
                      <VStack gap="4">
                        <HStack gap="8" align="center">
                          <Text className="font-mono font-semibold text-primary">{ep.extension}</Text>
                          <span
                            className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-zinc-600'}`}
                          />
                          <Text variant="muted" className="text-xs">
                            {isOnline ? t('endpoints.statusOnline') : t('endpoints.statusOffline')}
                          </Text>
                        </HStack>
                        <Text className="text-sm">{parseCallerName(ep.callerid)}</Text>
                        {ep.department ? (
                          <Text variant="muted" className="text-xs">{ep.department}</Text>
                        ) : null}
                      </VStack>
                      <TableRowActions>
                        <TableRowAction
                          title={t('endpoints.btnSip')}
                          aria-label={t('endpoints.btnSip')}
                          onClick={() => dispatch(endpointsPageActions.openCredentialsModal(ep.id))}
                        >
                          <Key />
                        </TableRowAction>
                        <TableRowAction
                          title={t('common.edit')}
                          aria-label={t('common.edit')}
                          onClick={() => dispatch(endpointsPageActions.openEditModal(ep))}
                        >
                          <Pencil />
                        </TableRowAction>
                        <TableRowAction
                          danger
                          title={t('common.delete')}
                          aria-label={t('common.delete')}
                          onClick={() => {
                            if (window.confirm(t('endpoints.confirmDelete', { ext: ep.extension }))) {
                              deleteEndpoint(ep.id);
                            }
                          }}
                        >
                          <Trash2 />
                        </TableRowAction>
                      </TableRowActions>
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
      <CardHeader>
        {toolbar}
        {isJobActive && jobStatus && (
          <div className="mt-3 w-full">
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
              <div className="flex-1 bg-accent rounded-full h-3 overflow-hidden relative border border-border">
                <div
                  className="bg-primary h-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(3, Math.round((jobStatus.processed / jobStatus.total) * 100))}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {jobStatus.processed}/{jobStatus.total}
              </span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto min-w-0" data-testid="endpoints-table-scroll">
          <DataTable
            ref={tableRef}
            data={endpoints as IEndpointListItem[]}
            columns={columns}
            getRowId={(row) => row.id}
            selectable
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            globalFilter={globalFilter}
            pageSize={50}
            emptyText={t('common.noData')}
            exportFilename="krasterisk_endpoints_export"
          />
        </div>
      </CardContent>
    </Card>
  );
});

EndpointsTable.displayName = 'EndpointsTable';
