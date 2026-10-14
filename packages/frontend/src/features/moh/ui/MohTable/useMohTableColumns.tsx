import type { IMohClass } from '@/entities/moh';
import { useDeleteMohClassMutation } from '@/shared/api/endpoints/mohApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { Text } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import { createColumnHelper } from '@tanstack/react-table';
import { Music } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import cls from './MohTable.module.scss';

const columnHelper = createColumnHelper<IMohClass>();

export const useMohTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteMoh] = useDeleteMohClassMutation();

  return useMemo(
    () => [
      columnHelper.display({
        id: 'index',
        header: () => t('moh.table.index'),
        size: 50,
        cell: (info) => (
          <Text as="span" className={cls.cell}>{info.row.index + 1}</Text>
        ),
      }),

      columnHelper.accessor('displayName', {
        header: () => t('moh.table.name'),
        cell: (info) => (
          <HStack gap="8" align="center">
            <Music size={16} className={cls.musicIcon} />
            <Text as="span" className={cls.name}>{info.getValue()}</Text>
          </HStack>
        ),
      }),

      columnHelper.accessor((row) => row.entries?.length || 0, {
        id: 'tracks',
        header: () => t('moh.table.tracks'),
        size: 100,
        cell: (info) => (
          <Text as="span" className={cls.tracksBadge}>{info.getValue()}</Text>
        ),
      }),

      columnHelper.accessor('sort', {
        header: () => t('moh.table.sort'),
        size: 140,
        cell: (info) => {
          const val = info.getValue();
          const sortClass = val === 'random' ? cls.sortRandom : val === 'alpha' ? cls.sortAlpha : '';
          const label = val === 'random'
            ? t('moh.sort.random')
            : val === 'alpha'
              ? t('moh.sort.alpha')
              : val;
          return (
            <Text as="span" className={`${cls.sortBadge} ${sortClass}`}>{label}</Text>
          );
        },
      }),


    ],
    [t, dispatch, deleteMoh],
  );
};
