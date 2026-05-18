import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ScrollArea,
  Text,
  Pagination,
} from '@/shared/ui';
import { useGetCdrListQuery } from '@/shared/api/endpoints/cdrApi';
import type { CdrUiFilters } from '@/features/cdr/model/lib/cdrFiltersToParams';
import { filtersToQueryParams } from '@/features/cdr/model/lib/cdrFiltersToParams';
import { CdrTable } from '../CdrTable/CdrTable';
import { useState } from 'react';

const PAGE_SIZE = 30;

interface CdrDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  baseFilters: CdrUiFilters;
  drillFilters: Partial<CdrUiFilters>;
}

export const CdrDrilldownModal = memo(({
  isOpen,
  onClose,
  title,
  baseFilters,
  drillFilters,
}: CdrDrilldownModalProps) => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const merged = { ...baseFilters, ...drillFilters };
  const query = filtersToQueryParams(merged, page, PAGE_SIZE);
  const { data, isLoading } = useGetCdrListQuery(query, { skip: !isOpen });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="3xl" className="max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0">
          <CdrTable
            data={data?.rows || []}
            isLoading={isLoading}
            totalRows={data?.count || 0}
            currentPage={page - 1}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => setPage(p + 1)}
          />
        </ScrollArea>
        {data && data.count > PAGE_SIZE && (
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(data.count / PAGE_SIZE)}
            onPageChange={setPage}
          />
        )}
        {!isLoading && !data?.rows?.length && (
          <Text variant="muted">{t('common.noData', 'Нет данных')}</Text>
        )}
      </DialogContent>
    </Dialog>
  );
});

CdrDrilldownModal.displayName = 'CdrDrilldownModal';
