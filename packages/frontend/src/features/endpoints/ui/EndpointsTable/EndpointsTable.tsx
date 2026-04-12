import React, { memo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { type RowSelectionState } from '@tanstack/react-table';
import { Phone, Search, Loader2, Trash2, Download } from 'lucide-react';
import { type DataTableRef } from '@/shared/ui/DataTable/DataTable';
import { Card, CardHeader, CardContent, Input, Button, DataTable } from '@/shared/ui';
import { HStack, Flex } from '@/shared/ui/Stack';
import {
  useGetEndpointsQuery,
  useBulkDeleteEndpointsMutation,
  useGetActiveBulkJobQuery,
  useGetBulkJobStatusQuery,
} from '@/shared/api/endpoints/endpointApi';
import type { IEndpointListItem } from '@/shared/api/endpoints/endpointApi';
import { useEndpointsTableColumns } from './useEndpointsTableColumns';

export const EndpointsTable = memo(() => {
  const { t } = useTranslation();
  const { data: endpoints = [], isLoading } = useGetEndpointsQuery();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteEndpointsMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const tableRef = React.useRef<DataTableRef>(null);

  const columns = useEndpointsTableColumns();

  const selectedCount = Object.keys(rowSelection).length;

  const handleBulkDelete = useCallback(async () => {
    const sipIds = Object.keys(rowSelection);
    if (sipIds.length === 0) return;

    const extensions = sipIds
      .map((id) => {
        const ep = endpoints.find((e) => e.id === id);
        return ep?.extension || id;
      })
      .join(', ');

    if (!window.confirm(`Удалить ${sipIds.length} абонентов (${extensions})?`)) return;

    try {
      await bulkDelete(sipIds).unwrap();
      setRowSelection({});
    } catch (e) {
      console.error('Bulk delete failed:', e);
    }
  }, [rowSelection, endpoints, bulkDelete]);

  // Background bulk create progress
  const { data: activeJobData } = useGetActiveBulkJobQuery(undefined, { pollingInterval: 3000 });
  const activeJobId = activeJobData?.jobId || null;
  const { data: jobStatus } = useGetBulkJobStatusQuery(activeJobId || '', {
    skip: !activeJobId,
    pollingInterval: 1000,
  });
  const isJobActive = jobStatus && (jobStatus.status === 'pending' || jobStatus.status === 'processing');

  const onlineCount = endpoints.filter((e) => e.status === 'online').length;

  return (
    <Card>
      <CardHeader>
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
          <HStack gap="8" align="center">
            {selectedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 text-destructive hover:text-destructive border-destructive/30 bg-destructive/10 hover:bg-destructive/20"
                onClick={handleBulkDelete}
                disabled={isDeleting}
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? '...' : `Удалить (${selectedCount})`}
              </Button>
            )}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="endpoints-search"
                placeholder={t('common.search')}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => tableRef.current?.exportCsv()}
              className="h-9 gap-2 text-xs font-medium border-dashed border-2 hover:border-primary/50 text-muted-foreground hover:text-primary transition-colors"
            >
              <Download className="w-4 h-4" />
              CSV
            </Button>
          </HStack>
        </HStack>
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
        {isLoading ? (
          <Flex align="center" justify="center" className="h-48">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </Flex>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
});

EndpointsTable.displayName = 'EndpointsTable';
