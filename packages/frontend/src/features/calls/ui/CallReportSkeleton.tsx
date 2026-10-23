import { useTranslation } from 'react-i18next';
import { Flex, Skeleton, VStack } from '@/shared/ui';
import cls from './Calls.module.scss';

export function CallReportSkeleton() {
  const { t } = useTranslation();
  return (
    <VStack
      gap="16"
      align="stretch"
      aria-busy="true"
      aria-label={t('calls.searchLoading')}
      data-testid="calls-report-skeleton"
    >
      <Flex className={cls.summary}>
        {Array.from({ length: 8 }, (_, card) => (
          <VStack key={card} gap="12" align="stretch" className={cls.metric}>
            <Skeleton className={cls.skeletonLabel} />
            <Skeleton className={cls.skeletonValue} />
          </VStack>
        ))}
      </Flex>
      <VStack gap="8" align="stretch">
        {Array.from({ length: 7 }, (_, row) => (
          <Flex key={row} className={cls.skeletonTableRow}>
            {Array.from({ length: 5 }, (_, cell) => (
              <Skeleton
                key={cell}
                className={row === 0 ? cls.skeletonLabel : cls.skeletonCell}
              />
            ))}
          </Flex>
        ))}
      </VStack>
    </VStack>
  );
}
