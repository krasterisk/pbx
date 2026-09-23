import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Table } from '@tanstack/react-table';
import { FileCode, Search, Loader2, Trash2, Pencil } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Input,
  Button,
  DataTable,
  Text,
  TableRowActions,
  TableRowAction,
  TableSelectionBanner,
  BulkDeleteDialog,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useGetProvisionTemplatesQuery,
  useBulkDeleteProvisionTemplatesMutation,
  useDeleteProvisionTemplateMutation,
} from '@/shared/api/api';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useCrossPageRowSelection } from '@/shared/hooks/useCrossPageRowSelection';
import { provisionTemplatesActions } from '../../model/slice/provisionTemplatesSlice';
import { useProvisionTemplatesTableColumns } from './useProvisionTemplatesTableColumns';
import cls from './ProvisionTemplatesTable.module.scss';

const PAGE_SIZE = 50;

export const ProvisionTemplatesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: templates = [], isLoading } = useGetProvisionTemplatesQuery();
  const [deleteTemplate] = useDeleteProvisionTemplateMutation();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteProvisionTemplatesMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const selection = useCrossPageRowSelection({ globalFilter });

  const columns = useProvisionTemplatesTableColumns();

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((tpl) => {
      const name = (tpl.name || '').toLowerCase();
      const vendor = (tpl.vendor || '').toLowerCase();
      const model = (tpl.model || '').toLowerCase();
      return name.includes(q) || vendor.includes(q) || model.includes(q);
    });
  }, [templates, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = templates.find((tpl) => String(tpl.uid) === id);
        return row?.name || id;
      }),
    [selection.selectedIds, templates],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = selection.selectedIds.map(Number);
    if (!ids.length) return;
    await bulkDelete(ids).unwrap();
    selection.afterBulkDelete();
  }, [selection, bulkDelete]);

  const renderSelectionBanner = useCallback(
    (table: Table<(typeof templates)[number]>) => (
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
      i18nNs="provisionTemplates"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <FileCode size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('provisionTemplates.count', { count: templates.length })}</Text>
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
            {t('provisionTemplates.deleteSelected', { count: selection.selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="templates-search"
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
                {t('provisionTemplates.empty')}
              </Text>
            ) : (
              filtered.map((tpl) => (
                <Flex
                  key={tpl.uid}
                  direction="column"
                  className={cls.mobileCard}
                  data-testid="provision-templates-mobile-card"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>{tpl.name}</Text>
                      <Text as="span" className={cls.muted}>
                        {[tpl.vendor, tpl.model].filter(Boolean).join(' · ') || '-'}
                      </Text>
                    </VStack>
                    <TableRowActions>
                      <TableRowAction
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                        onClick={() => dispatch(provisionTemplatesActions.openEditModal(tpl))}
                      >
                        <Pencil />
                      </TableRowAction>
                      <TableRowAction
                        danger
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                        onClick={() => {
                          if (window.confirm(t('provisionTemplates.confirmDelete', { name: tpl.name }))) {
                            deleteTemplate(tpl.uid);
                          }
                        }}
                      >
                        <Trash2 />
                      </TableRowAction>
                    </TableRowActions>
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
          data-testid="provision-templates-table-scroll"
        >
          <DataTable
            ref={selection.tableRef}
            className={cls.table}
            data={templates}
            columns={columns}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t('provisionTemplates.empty')}
            exportFilename="provision_templates_export"
            selectAllAriaLabel={t('common.selectPageAria')}
            renderBanner={renderSelectionBanner}
          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

ProvisionTemplatesTable.displayName = 'ProvisionTemplatesTable';
