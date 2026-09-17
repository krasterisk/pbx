import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList } from 'lucide-react';
import { Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useGetServiceRequestStatsQuery } from '@/shared/api/endpoints/serviceRequestApi';
import {
  ServiceRequestsTable,
  ServiceRequestsFilter,
  ServiceRequestsStats,
} from '@/features/serviceRequests';
import type { ServiceRequestFilters } from '@/features/serviceRequests';
import cls from './ServiceRequestsPage.module.scss';

export function ServiceRequestsPage() {
  const { t } = useTranslation();
  const { data: statsData, isLoading: isLoadingStats } = useGetServiceRequestStatsQuery();
  const [filters, setFilters] = useState<ServiceRequestFilters>({});

  const handleFilterChange = useCallback((newFilters: Partial<ServiceRequestFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  return (
    <VStack gap="24" max className={cls.page} data-testid="service-requests-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <ClipboardList size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('serviceRequests.title')}
            </Text>
            <Text variant="muted">{t('serviceRequests.subtitle')}</Text>
          </VStack>
        </HStack>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.statsScroll}>
        <ServiceRequestsStats stats={statsData} isLoading={isLoadingStats} />
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.filterBar}>
        <ServiceRequestsFilter filters={filters} onChange={handleFilterChange} />
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <ServiceRequestsTable filters={filters} />
      </Flex>
    </VStack>
  );
}
