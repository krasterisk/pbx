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
  selectedCount,
  onSelectAllMatching,
}: TableSelectionBannerProps<TData>) {
  const { t } = useTranslation();
  const filteredCount = table.getFilteredRowModel().rows.length;

  if (selectedCount <= 0) return null;

  return (
    <Flex
      align="center"
      justify="center"
      className={cls.banner}
      max
      data-testid="table-selection-banner"
    >
      <HStack gap="12" align="center" wrap="wrap" justify="center">
        <Text variant="muted">
          {t('common.selectionBannerCount', { count: selectedCount })}
        </Text>
        {filteredCount > selectedCount ? (
          <Button variant="link" className={cls.link} onClick={onSelectAllMatching}>
            {t('common.selectionBannerSelectAll', { total: filteredCount })}
          </Button>
        ) : null}
      </HStack>
    </Flex>
  );
}

export const TableSelectionBanner = memo(TableSelectionBannerInner) as <TData>(
  props: TableSelectionBannerProps<TData>,
) => ReturnType<typeof TableSelectionBannerInner>;

(TableSelectionBanner as any).displayName = 'TableSelectionBanner';
