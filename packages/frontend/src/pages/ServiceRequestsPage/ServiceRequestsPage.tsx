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

export function ServiceRequestsPage() {
  const { t } = useTranslation();
  const { data: statsData, isLoading: isLoadingStats } = useGetServiceRequestStatsQuery();

  const [filters, setFilters] = useState<ServiceRequestFilters>({});

  const handleFilterChange = useCallback((newFilters: Partial<ServiceRequestFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  return (
    <VStack gap="24" max className="flex-1">
      {/* Page header */}
      <Flex justify="between" align="center" className="px-2">
        <Flex align="center" gap="12">
          <Flex align="center" justify="center" className="p-2.5 bg-indigo-500/10 rounded-xl">
            <ClipboardList className="w-6 h-6 text-indigo-500" />
          </Flex>
          <VStack>
            <Text variant="h1" className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t('serviceRequests.title', 'Заявки клиентов')}
            </Text>
            <Text variant="muted" className="mt-1">
              {t('serviceRequests.subtitle', 'Работа с обращениями клиентов')}
            </Text>
          </VStack>
        </Flex>
      </Flex>

      {/* KPI Stats */}
      <ServiceRequestsStats stats={statsData} isLoading={isLoadingStats} />

      {/* Main card with filters + table */}
      <Card className="border-muted/50 shadow-sm backdrop-blur-xl bg-background/50 flex flex-col min-h-[500px]">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
          <ServiceRequestsFilter filters={filters} onChange={handleFilterChange} />
        </CardHeader>
        <CardContent className="p-0 flex-1 relative">
          <ServiceRequestsTable filters={filters} />
        </CardContent>
      </Card>
    </VStack>
  );
}
