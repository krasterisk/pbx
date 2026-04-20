import { memo, useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Flex, VStack, Text, Pagination } from '@/shared/ui';
import { 
  useGetVoiceRobotCdrsQuery, 
  useGetVoiceRobotCdrStatsQuery,
  IVoiceRobotCdr
} from '@/shared/api/endpoints/voiceRobotCdrApi';
import { 
  VoiceRobotCdrFilter, 
  VoiceRobotCdrTable, 
  VoiceRobotCdrStats, 
  VoiceRobotCdrDetailModal 
} from '@/features/voiceRobotCdr';

const PAGE_SIZE = 50;

const VoiceRobotCdrPage = memo(() => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [selectedCdrId, setSelectedCdrId] = useState<number | null>(null);

  // Parse filters from URL
  const page = parseInt(searchParams.get('page') || '1', 10);
  const search = searchParams.get('search') || undefined;
  const disposition = searchParams.get('disposition') || undefined;
  const dateFrom = searchParams.get('dateFrom') || undefined;
  const dateTo = searchParams.get('dateTo') || undefined;

  const filters = { search, disposition, dateFrom, dateTo };

  const queryParams = {
    ...filters,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const { data: cdrData, isLoading: isLoadingCdr, isFetching } = useGetVoiceRobotCdrsQuery(queryParams);
  const { data: statsData, isLoading: isLoadingStats } = useGetVoiceRobotCdrStatsQuery();

  const handleFilterChange = useCallback((newFilters: Partial<typeof filters>) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', '1'); // Reset page on filter change
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  const handlePageChange = useCallback((newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  const totalPages = cdrData ? Math.ceil(cdrData.count / PAGE_SIZE) : 0;

  return (
    <VStack gap="24" max className="flex-1">
      <Flex justify="between" align="center" className="px-2">
        <Flex align="center" gap="12">
          <Flex align="center" justify="center" className="p-2.5 bg-indigo-500/10 rounded-xl">
            <Activity className="w-6 h-6 text-indigo-500" />
          </Flex>
          <VStack>
             <Text variant="h1" className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t('voiceRobots.cdr.title')}
            </Text>
            <Text variant="muted" className="mt-1">
              {t('voiceRobots.cdr.subtitle')}
            </Text>
          </VStack>
        </Flex>
      </Flex>

      {/* KPI Stats */}
      <VoiceRobotCdrStats stats={statsData} isLoading={isLoadingStats} />

      <Card className="border-muted/50 shadow-sm backdrop-blur-xl bg-background/50 flex flex-col min-h-[500px]">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">
            {t('voiceRobots.cdr.title')}
            {cdrData && <span className="ml-2 text-sm text-muted-foreground font-normal">({cdrData.count})</span>}
          </CardTitle>
          <VoiceRobotCdrFilter filters={filters} onChange={handleFilterChange} />
        </CardHeader>
        <CardContent className="p-0 flex-1 relative">
          <VoiceRobotCdrTable 
            data={cdrData?.rows || []} 
            isLoading={isLoadingCdr || isFetching} 
            onRowClick={(cdr) => setSelectedCdrId(cdr.uid)}
          />
        </CardContent>
        {totalPages > 1 && (
          <div className="p-4 border-t border-border/50 bg-muted/10 flex justify-center">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </Card>

      <VoiceRobotCdrDetailModal 
        cdrId={selectedCdrId} 
        isOpen={selectedCdrId !== null} 
        onClose={() => setSelectedCdrId(null)} 
      />
    </VStack>
  );
});

VoiceRobotCdrPage.displayName = 'VoiceRobotCdrPage';

export default VoiceRobotCdrPage;
