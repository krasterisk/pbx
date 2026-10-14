import { useDeleteNumberMutation,type INumberList } from '@/shared/api/api';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { Text } from '@/shared/ui';
import { createColumnHelper } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import cls from './NumbersTable.module.scss';

const columnHelper = createColumnHelper<INumberList>();

export const useNumbersTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteNumber] = useDeleteNumberMutation();

  return useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('numbers.name'),
        cell: (info) => <Text as="span" className={cls.name}>{info.getValue()}</Text>,
      }),

      columnHelper.accessor('comment', {
        header: () => t('numbers.comment'),
        cell: (info) => (
          <Text as="span" className={cls.comment}>{info.getValue() || '-'}</Text>
        ),
      }),


    ],
    [t, dispatch, deleteNumber],
  );
};
