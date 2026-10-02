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
  pageSize: pageSizeProp,
  allMatchingSelected,
  selectedCount,
  onSelectAllMatching,
  onClear,
}: TableSelectionBannerProps<TData>) {
  const { t } = useTranslation();
  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageRows = table.getRowModel().rows;
  const pageCount = pageRows.length;
  const pageSize = table.getState().pagination.pageSize || pageSizeProp || 50;
  const allPageSelected = pageCount > 0 && pageRows.every((row) => row.getIsSelected());
  // Gmail (§4.2.1): the bar exists only after the whole page is selected
  // and more rows sit on other pages. A single checkbox must not insert a row.
  const show = allPageSelected && filteredCount > pageSize && selectedCount > 0;

  if (!show) return null;

  return (
    <Flex className={cls.slot} max data-testid="table-selection-banner">
      <Flex align="center" justify="center" className={cls.banner} max>
        <HStack gap="12" align="center" wrap="wrap" justify="center">
          <Text variant="muted">
            {allMatchingSelected
              ? t('common.selectionBannerAll', { total: filteredCount })
              : t('common.selectionBannerPage', { pageCount })}
          </Text>
          {allMatchingSelected ? (
            <Button type="button" variant="link" className={cls.link} onClick={onClear}>
              {t('common.selectionBannerClear')}
            </Button>
          ) : (
            <Button type="button" variant="link" className={cls.link} onClick={onSelectAllMatching}>
              {t('common.selectionBannerSelectAll', { total: filteredCount })}
            </Button>
          )}
        </HStack>
      </Flex>
    </Flex>
  );
}

export const TableSelectionBanner = memo(TableSelectionBannerInner) as <TData>(
  props: TableSelectionBannerProps<TData>,
) => ReturnType<typeof TableSelectionBannerInner>;

(TableSelectionBanner as any).displayName = 'TableSelectionBanner';
