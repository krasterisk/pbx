import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Flex, VStack, Text, Pagination } from '@/shared/ui';
import { 
  useGetVoiceRobotCdrsQuery, 
  useGetVoiceRobotCdrStatsQuery,
  useLazyExportCdrQuery,
  IVoiceRobotCdr
} from '@/shared/api/endpoints/voiceRobotCdrApi';
import { 
  VoiceRobotCdrFilter, 
  VoiceRobotCdrTable, 
  VoiceRobotCdrStats, 
  VoiceRobotCdrDetailModal 
} from '@/features/voiceRobotCdr';

const PAGE_SIZE = 50;

/** Export all matching CDR records as CSV */
function exportCdrToCsv(data: IVoiceRobotCdr[], t: (key: string, defaultValue?: string) => string) {
  const headers = [
    t('voiceRobots.cdr.table.date'),
    t('voiceRobots.cdr.table.robot'),
    t('voiceRobots.cdr.table.caller'),
    'CallerID Name',
    t('voiceRobots.cdr.table.disposition'),
    t('voiceRobots.cdr.table.tag', 'Тег'),
    t('voiceRobots.cdr.table.duration'),
    t('voiceRobots.cdr.table.steps'),
    'Transfer',
  ].map((h) => `"${h}"`).join(',');

  const rows = data.map((row) => {
    return [
      row.started_at,
      row.robot_name || `ID: ${row.robot_id}`,
      row.caller_id || '',
      row.caller_name || '',
      row.disposition,
      row.tags?.length ? row.tags[row.tags.length - 1] : '',
      row.duration_seconds,
      row.total_steps,
      row.transfer_target || '',
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
  });

  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `krasterisk_cdr_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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
  const tag = searchParams.get('tag') || undefined;

  const filters = { search, disposition, dateFrom, dateTo, tag };

  const queryParams = {
    ...filters,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const { data: cdrData, isLoading: isLoadingCdr, isFetching } = useGetVoiceRobotCdrsQuery(queryParams);
  const { data: statsData, isLoading: isLoadingStats } = useGetVoiceRobotCdrStatsQuery();
  const [triggerExport, { isFetching: isExporting }] = useLazyExportCdrQuery();

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

  const handleExportCsv = useCallback(async () => {
    try {
      const result = await triggerExport(filters).unwrap();
      if (result?.rows) {
        exportCdrToCsv(result.rows, t as any);
      }
    } catch (e) {
      console.error('CSV export failed:', e);
    }
  }, [triggerExport, filters, t]);

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
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
          <Flex justify="between" align="start" className="mb-3">
            <CardTitle className="text-base font-medium">
              {t('voiceRobots.cdr.title')}
              {cdrData && <span className="ml-2 text-sm text-muted-foreground font-normal">({cdrData.count})</span>}
            </CardTitle>
          </Flex>
          <VoiceRobotCdrFilter
            filters={filters}
            onChange={handleFilterChange}
            onExportCsv={handleExportCsv}
            isExporting={isExporting}
          />
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
