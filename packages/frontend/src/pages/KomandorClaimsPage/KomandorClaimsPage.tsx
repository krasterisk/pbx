import { useCallback, useState } from 'react';
import { Store } from 'lucide-react';
import { Card, CardContent, CardHeader, Flex, VStack, Text } from '@/shared/ui';
import { useGetKomandorClaimStatsQuery } from '@/shared/api/endpoints/komandorClaimApi';
import {
  KomandorClaimsTable,
  KomandorClaimsFilter,
  KomandorClaimsStats,
} from '@/features/komandorClaims';
import type { KomandorClaimFilters } from '@/features/komandorClaims';
import cls from '../ServiceRequestsPage/ServiceRequestsPage.module.scss';

export function KomandorClaimsPage() {
  const { data: statsData, isLoading: isLoadingStats } = useGetKomandorClaimStatsQuery();
  const [filters, setFilters] = useState<KomandorClaimFilters>({});

  const handleFilterChange = useCallback((next: Partial<KomandorClaimFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  return (
    <VStack gap="24" max className={`${cls.page} flex-1`} data-testid="komandor-claims-page-responsive">
      <Flex justify="between" align="center" className="px-2 min-w-0">
        <Flex align="center" gap="12" className="min-w-0">
          <Flex align="center" justify="center" className="p-2.5 bg-emerald-500/10 rounded-xl shrink-0">
            <Store className="w-6 h-6 text-emerald-500" />
          </Flex>
          <VStack className="min-w-0">
            <Text variant="h1" className="text-lg sm:text-2xl">Рекламации Командор</Text>
            <Text variant="muted" className="text-xs sm:text-sm">
              Сбор обращения, магазин, ответственные и отправка на почту / СМС клиенту
            </Text>
          </VStack>
        </Flex>
      </Flex>

      <div className={cls.statsScroll}>
        <KomandorClaimsStats stats={statsData} isLoading={isLoadingStats} />
      </div>

      <Card className={`${cls.card} border-muted/50 flex flex-col min-h-[400px]`}>
        <CardHeader className="border-b border-border/50 pb-4 px-3 sm:px-6">
          <div className={cls.filterBar}>
            <KomandorClaimsFilter filters={filters} onChange={handleFilterChange} />
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-w-0">
          <div className={`${cls.tableScroll} overflow-x-auto`} data-testid="hybrid-table" data-hybrid="overflow-x-auto">
            <KomandorClaimsTable filters={filters} />
          </div>
        </CardContent>
      </Card>
    </VStack>
  );
}
