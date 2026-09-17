import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Download, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  RecordingButton,
  Skeleton,
  TableRowAction,
  TableRowActions,
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useDeleteServiceRequestMutation,
  useGetServiceRequestsQuery,
  useLazyGetServiceRequestsQuery,
} from '@/shared/api/endpoints/serviceRequestApi';
import type { ServiceRequestQueryParams } from '@/shared/api/endpoints/serviceRequestApi';
import type { IServiceRequest } from '@/entities/serviceRequest';
import { REQUEST_STATUS_OPTIONS, SMS_STATUS_OPTIONS } from '@/entities/serviceRequest';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { ServiceRequestModal } from '../ServiceRequestModal';
import type { ServiceRequestFilters } from '../ServiceRequestsFilter';
import {
  SMS_BADGE_VARIANT,
  STATUS_BADGE_VARIANT,
  useServiceRequestsTableColumns,
} from './useServiceRequestsTableColumns';
import cls from './ServiceRequestsTable.module.scss';

interface ServiceRequestsTableProps {
  filters: ServiceRequestFilters;
}

const PAGE_SIZE = 30;
const CSV_DELIMITER = ';';

const STATUS_ROW_CLASS: Record<string, string> = {
  new: cls.rowNew,
  in_progress: cls.rowProgress,
  completed: cls.rowCompleted,
  postponed: cls.rowPostponed,
  impossible: cls.rowImpossible,
};

const STATUS_CARD_CLASS: Record<string, string> = {
  new: cls.cardNew,
  in_progress: cls.cardProgress,
  completed: cls.cardCompleted,
  postponed: cls.cardPostponed,
  impossible: cls.cardImpossible,
};

function buildQueryParams(
  filters: ServiceRequestFilters,
  pagination?: { limit: number; offset: number },
): ServiceRequestQueryParams {
  return {
    ...pagination,
    status: filters.statuses?.length ? filters.statuses : undefined,
    district: filters.districts?.length ? filters.districts : undefined,
    topic: filters.topics?.length ? filters.topics : undefined,
    search: filters.search,
    territorial_zone: filters.territorialZones?.length ? filters.territorialZones : undefined,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };
}

function exportServiceRequestsToCsv(
  rows: IServiceRequest[],
  t: (key: string, defaultValue?: string) => string,
) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const statusLabel = (val: string) => {
    const opt = REQUEST_STATUS_OPTIONS.find((o) => o.value === val);
    return opt ? t(opt.labelKey, opt.fallback) : val;
  };
  const smsLabel = (val: string) => {
    const opt = SMS_STATUS_OPTIONS.find((o) => o.value === val);
    return opt ? t(opt.labelKey, opt.fallback) : val;
  };

  const headers = [
    t('serviceRequests.table.index'),
    t('serviceRequests.table.date'),
    t('serviceRequests.table.operator'),
    t('serviceRequests.table.client'),
    t('serviceRequests.table.account'),
    t('serviceRequests.table.phone'),
    t('serviceRequests.table.topic'),
    t('serviceRequests.table.zone'),
    t('serviceRequests.table.locality'),
    t('serviceRequests.table.district'),
    t('serviceRequests.table.address'),
    t('serviceRequests.table.request'),
    t('serviceRequests.table.schedule'),
    t('serviceRequests.table.status'),
    t('serviceRequests.table.sms'),
  ].map(esc).join(CSV_DELIMITER);

  const csvRows = rows.map((row) =>
    [
      row.request_number || `#${row.uid}`,
      new Date(row.call_received_at).toLocaleDateString('ru-RU'),
      row.operator_name,
      row.counterparty_name,
      row.account_or_inn,
      row.phone,
      row.topic,
      row.territorial_zone,
      row.locality,
      row.district,
      row.address,
      row.comment,
      row.schedule_comment,
      statusLabel(row.request_status),
      smsLabel(row.sms_status),
    ].map(esc).join(CSV_DELIMITER),
  );

  const csvContent = [headers, ...csvRows].join('\n');
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `service-requests_${new Date().toISOString().slice(0, 10)}.csv`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function MobileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Flex className={cls.mobileField} max>
      <Text as="span" className={cls.mobileLabel}>{label}</Text>
      <Flex className={cls.mobileValue}>{children}</Flex>
    </Flex>
  );
}

function MobileOptionalField({ label, text }: { label: string; text: string | null | undefined }) {
  if (!text) return null;
  return (
    <MobileField label={label}>
      <Text as="span" className={cls.cell}>{text}</Text>
    </MobileField>
  );
}

export function ServiceRequestsTable({ filters }: ServiceRequestsTableProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const [currentPage, setCurrentPage] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<IServiceRequest | undefined>(undefined);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const selectedCount = Object.keys(rowSelection).length;

  useEffect(() => { setCurrentPage(0); }, [filters]);

  const queryParams = useMemo(
    () => buildQueryParams(filters, { limit: PAGE_SIZE, offset: currentPage * PAGE_SIZE }),
    [filters, currentPage],
  );

  const { data, isLoading } = useGetServiceRequestsQuery(queryParams);
  const [triggerExport] = useLazyGetServiceRequestsQuery();
  const [deleteReq] = useDeleteServiceRequestMutation();

  const rows = data?.rows ?? [];
  const totalCount = data?.count ?? 0;

  const handleEdit = useCallback((record: IServiceRequest) => {
    setSelectedRecord(record);
    setModalOpen(true);
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm(t('common.confirmDelete', 'Удалить эту запись?'))) return;
    try {
      await deleteReq(id).unwrap();
      toast.success(t('common.deleted', 'Удалено'));
    } catch (err: unknown) {
      const message = (err as { data?: { message?: string } })?.data?.message;
      toast.error(message || t('common.error'));
    }
  }, [deleteReq, t]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;
    if (!window.confirm(t('serviceRequests.confirmBulkDelete'))) return;
    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => deleteReq(id).unwrap()));
      setRowSelection({});
      toast.success(t('common.deleted', 'Удалено'));
    } catch (err: unknown) {
      const message = (err as { data?: { message?: string } })?.data?.message;
      toast.error(message || t('common.error'));
    } finally {
      setIsDeleting(false);
    }
  }, [rowSelection, deleteReq, t]);

  const handleExport = useCallback(async () => {
    if (totalCount === 0) {
      toast.info(t('common.noData'));
      return;
    }
    setIsExporting(true);
    try {
      const result = await triggerExport(buildQueryParams(filters, { limit: totalCount, offset: 0 })).unwrap();
      exportServiceRequestsToCsv(result.rows, t);
    } catch (err: unknown) {
      const message = (err as { data?: { message?: string } })?.data?.message;
      toast.error(message || t('common.error'));
    } finally {
      setIsExporting(false);
    }
  }, [triggerExport, filters, totalCount, t]);

  const columns = useServiceRequestsTableColumns({
    onEdit: handleEdit,
    onDelete: handleDelete,
  });

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <ClipboardList size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t('serviceRequests.table.count', { count: totalCount })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        {!isMobile && (
          <Button
            variant="destructive"
            className={selectedCount === 0 ? cls.bulkBtnHidden : undefined}
            disabled={isDeleting || selectedCount === 0}
            aria-hidden={selectedCount === 0}
            tabIndex={selectedCount === 0 ? -1 : undefined}
            onClick={() => void handleBulkDelete()}
          >
            {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : <Trash2 size={16} />}
            {t('serviceRequests.deleteSelected', { count: selectedCount })}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={handleExport} disabled={isExporting}>
          {isExporting ? <Loader2 size={16} className={cls.spinner} /> : <Download size={16} />}
          <Text as="span">{t('serviceRequests.table.export')}</Text>
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setSelectedRecord(undefined);
            setModalOpen(true);
          }}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">
            {isMobile ? t('serviceRequests.table.createShort') : t('serviceRequests.table.create')}
          </Text>
        </Button>
      </HStack>
    </Flex>
  );

  const modal = (
    <ServiceRequestModal
      isOpen={modalOpen}
      onClose={() => setModalOpen(false)}
      record={selectedRecord}
    />
  );

  if (isLoading && isMobile) {
    return (
      <Card className={cls.card} data-testid="hybrid-table" data-hybrid="mobile-card">
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <VStack gap="8" max>
            {[1, 2, 3].map((i) => <Skeleton key={i} className={cls.skeletonRow} />)}
          </VStack>
        </CardContent>
        {modal}
      </Card>
    );
  }

  if (isMobile) {
    return (
      <Card className={cls.card} data-testid="hybrid-table" data-hybrid="mobile-card">
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <VStack gap="8" max className={cls.mobileList}>
            {rows.length === 0 ? (
              <Text variant="muted" className={cls.mobileEmpty}>{t('common.noData')}</Text>
            ) : (
              rows.map((record) => {
                const statusOpt = REQUEST_STATUS_OPTIONS.find((o) => o.value === record.request_status);
                const smsOpt = SMS_STATUS_OPTIONS.find((o) => o.value === record.sms_status);
                const borderClass = STATUS_CARD_CLASS[record.request_status] || '';
                return (
                  <Flex
                    key={record.uid}
                    direction="column"
                    className={`${cls.mobileCard} ${borderClass}`}
                    data-testid="service-requests-mobile-card"
                  >
                    <HStack justify="between" align="start" max>
                      <VStack gap="4">
                        <Text as="span" className={cls.number}>
                          {record.request_number || `#${record.uid}`}
                        </Text>
                        <Badge variant={STATUS_BADGE_VARIANT[record.request_status] || 'outline'}>
                          {statusOpt ? t(statusOpt.labelKey, statusOpt.fallback) : record.request_status}
                        </Badge>
                        <MobileField label={t('serviceRequests.table.date')}>
                          <Text as="span" className={cls.cell}>
                            {new Date(record.call_received_at).toLocaleDateString('ru-RU')}
                          </Text>
                        </MobileField>
                        <MobileOptionalField label={t('serviceRequests.table.operator')} text={record.operator_name} />
                        <MobileOptionalField label={t('serviceRequests.table.client')} text={record.counterparty_name} />
                        <MobileOptionalField label={t('serviceRequests.table.phone')} text={record.phone} />
                        <MobileOptionalField label={t('serviceRequests.table.topic')} text={record.topic} />
                        <MobileField label={t('serviceRequests.table.sms')}>
                          <Badge variant={SMS_BADGE_VARIANT[record.sms_status] || 'secondary'}>
                            {smsOpt ? t(smsOpt.labelKey, smsOpt.fallback) : record.sms_status}
                          </Badge>
                        </MobileField>
                      </VStack>
                      <TableRowActions>
                        {record.call_uniqueid && (
                          <RecordingButton uniqueid={record.call_uniqueid} />
                        )}
                        <TableRowAction
                          title={t('common.edit')}
                          aria-label={t('common.edit')}
                          onClick={() => handleEdit(record)}
                        >
                          <Pencil />
                        </TableRowAction>
                        <TableRowAction
                          danger
                          title={t('common.delete')}
                          aria-label={t('common.delete')}
                          onClick={() => void handleDelete(record.uid)}
                        >
                          <Trash2 />
                        </TableRowAction>
                      </TableRowActions>
                    </HStack>
                  </Flex>
                );
              })
            )}
          </VStack>
        </CardContent>
        {modal}
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
          data-testid="service-requests-table-scroll"
        >
          <DataTable
            className={cls.table}
            columns={columns}
            data={rows}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            pageSize={PAGE_SIZE}
            getRowClassName={(row) => STATUS_ROW_CLASS[row.request_status] || ''}
            paginationMode="server"
            totalRows={totalCount}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            emptyText={t('common.noData')}
          />
        </Flex>
      </CardContent>
      {modal}
    </Card>
  );
}
