import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCode, Search, Loader2, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardContent, Input, Button, DataTable } from '@/shared/ui';
import { HStack, Flex } from '@/shared/ui/Stack';
import { useGetProvisionTemplatesQuery, useBulkDeleteProvisionTemplatesMutation } from '@/shared/api/api';
import { useProvisionTemplatesTableColumns } from './useProvisionTemplatesTableColumns';

export const ProvisionTemplatesTable = memo(() => {
  const { t } = useTranslation();
  const { data: templates = [], isLoading } = useGetProvisionTemplatesQuery();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteProvisionTemplatesMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const columns = useProvisionTemplatesTableColumns();

  const selectedCount = Object.keys(rowSelection).length;

  const handleBulkDelete = async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;
    
    if (window.confirm(t('common.confirmDelete', 'Вы уверены, что хотите удалить?'))) {
      await bulkDelete(ids).unwrap();
      setRowSelection({});
    }
  };

  return (
    <Card>
      <CardHeader>
        <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
          <HStack gap="8" align="center">
            <FileCode className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg">
              {t('provisionTemplates.count', { count: templates.length, defaultValue: `Всего: ${templates.length}` })}
            </span>
          </HStack>
          <HStack gap="12" align="center" className="w-full sm:w-auto">
            {selectedCount > 0 && (
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
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="templates-search"
                placeholder={t('common.search', 'Поиск...')}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
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
            data={templates}
            columns={columns}
            getRowId={(row) => String(row.uid)}
            globalFilter={globalFilter}
            selectable={true}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            pageSize={50}
            emptyText={t('common.noData', 'Нет данных')}
            exportFilename="provision_templates_export"
          />
        )}
      </CardContent>
    </Card>
  );
});

ProvisionTemplatesTable.displayName = 'ProvisionTemplatesTable';

