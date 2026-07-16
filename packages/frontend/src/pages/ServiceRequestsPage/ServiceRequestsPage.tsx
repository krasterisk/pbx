import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Flex, VStack, Text } from '@/shared/ui';
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
    <VStack gap="24" max className={`${cls.page} flex-1`} data-testid="service-requests-page-responsive">
      {/* Page header */}
      <Flex justify="between" align="center" className="px-2 sm:px-2 min-w-0">
        <Flex align="center" gap="12" className="min-w-0">
          <Flex align="center" justify="center" className="p-2 sm:p-2.5 bg-indigo-500/10 rounded-xl shrink-0">
            <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
          </Flex>
          <VStack className="min-w-0">
            <Text variant="h1" className="text-lg sm:text-2xl bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t('serviceRequests.title', 'Заявки клиентов')}
            </Text>
            <Text variant="muted" className="mt-0.5 sm:mt-1 text-xs sm:text-sm">
              {t('serviceRequests.subtitle', 'Работа с обращениями клиентов')}
            </Text>
          </VStack>
        </Flex>
      </Flex>

      {/* KPI Stats */}
      <div className={cls.statsScroll}>
        <ServiceRequestsStats stats={statsData} isLoading={isLoadingStats} />
      </div>

      {/* Main card with filters + table — D-29 page-level overflow hybrid */}
      <Card className={`${cls.card} border-muted/50 shadow-sm backdrop-blur-xl bg-background/50 flex flex-col min-h-[400px] sm:min-h-[500px]`}>
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4 px-3 sm:px-6">
          <div className={cls.filterBar}>
            <ServiceRequestsFilter filters={filters} onChange={handleFilterChange} />
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 relative min-w-0">
          <div
            className={`${cls.tableScroll} overflow-x-auto`}
            data-testid="hybrid-table"
            data-hybrid="overflow-x-auto"
          >
            <ServiceRequestsTable filters={filters} />
          </div>
        </CardContent>
      </Card>
    </VStack>
  );
}
