import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { type Table } from '@tanstack/react-table';
import { Button } from '@/shared/ui/Button';
import { Text } from '@/shared/ui/Text/Text';
import { Flex, HStack } from '@/shared/ui/Stack';
import cls from './TableSelectionBanner.module.scss';

export interface TableSelectionBannerProps<TData> {
  table: Table<TData>;
  pageSize?: number;
  allMatchingSelected: boolean;
  selectedIds: string[];
  selectedCount: number;
  onSelectAllMatching: () => void;
  onClear: () => void;
}

function TableSelectionBannerInner<TData>({
  table,
  pageSize = 50,
  allMatchingSelected,
  selectedIds,
  selectedCount,
  onSelectAllMatching,
  onClear,
}: TableSelectionBannerProps<TData>) {
  const { t } = useTranslation();
  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageRowIds = new Set(table.getRowModel().rows.map((r) => r.id));
  const selectedOnPage = selectedIds.filter((id) => pageRowIds.has(id)).length;
  const isAllPageSelected = table.getIsAllPageRowsSelected();

  const showOfferAll =
    isAllPageSelected &&
    !allMatchingSelected &&
    filteredCount > pageSize &&
    selectedCount > 0 &&
    selectedCount < filteredCount;
  const showAllSelected = allMatchingSelected && selectedCount > 0;

  if (!showOfferAll && !showAllSelected) return null;

  return (
    <Flex
      align="center"
      justify="center"
      className={cls.banner}
      max
      data-testid="table-selection-banner"
    >
      {showOfferAll ? (
        <HStack gap="8" align="center" wrap="wrap" justify="center">
          <Text variant="muted">
            {t('common.selectionBannerPage', { pageCount: selectedOnPage })}
          </Text>
          <Button variant="link" className={cls.link} onClick={onSelectAllMatching}>
            {t('common.selectionBannerSelectAll', { total: filteredCount })}
          </Button>
        </HStack>
      ) : (
        <HStack gap="8" align="center" wrap="wrap" justify="center">
          <Text variant="muted">
            {t('common.selectionBannerAll', { total: selectedCount })}
          </Text>
          <Button variant="link" className={cls.link} onClick={onClear}>
            {t('common.selectionBannerClear')}
          </Button>
        </HStack>
      )}
    </Flex>
  );
}

export const TableSelectionBanner = memo(TableSelectionBannerInner) as <TData>(
  props: TableSelectionBannerProps<TData>,
) => ReturnType<typeof TableSelectionBannerInner>;

(TableSelectionBanner as any).displayName = 'TableSelectionBanner';
