import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { PhoneCall, BarChart3, List } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Flex,
  VStack,
  Text,
  Button,
} from '@/shared/ui';
import {
  useGetCdrListQuery,
  useGetCdrStatsQuery,
  useLazyExportCdrQuery,
} from '@/shared/api/endpoints/cdrApi';
import {
  CdrFilter,
  CdrStats,
  CdrTable,
  CdrLegsModal,
  CdrDrilldownModal,
  CdrCharts,
  type CdrUiFilters,
} from '@/features/cdr';
import {
  filtersToQueryParams,
  parseFiltersFromSearchParams,
} from '@/features/cdr/model/lib/cdrFiltersToParams';
import type { ICdrCall } from '@/shared/api/endpoints/cdrApi';

const PAGE_SIZE = 50;

const CdrReportPage = memo(() => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'journal' | 'analytics'>('journal');
  const [legsLinkedid, setLegsLinkedid] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<{ title: string; patch: Partial<CdrUiFilters> } | null>(null);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const filters = useMemo(() => parseFiltersFromSearchParams(searchParams), [searchParams]);

  const queryParams = filtersToQueryParams(filters, page, PAGE_SIZE);
  const { data: listData, isLoading: listLoading, isFetching } = useGetCdrListQuery(queryParams);
  const { data: statsData, isLoading: statsLoading } = useGetCdrStatsQuery({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    direction: filters.direction,
    disposition: filters.disposition,
    search: filters.search,
  });
  const [triggerExport, { isFetching: isExporting }] = useLazyExportCdrQuery();

  const handleFilterChange = useCallback((patch: Partial<CdrUiFilters>) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const handlePageChange = useCallback((newPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(newPage));
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const handleExportCsv = useCallback(async () => {
    try {
      const blob = await triggerExport({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        direction: filters.direction,
        disposition: filters.disposition,
        search: filters.search,
        extension: filters.extension,
        trunk: filters.trunk,
      }).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cdr_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('CDR export failed', e);
    }
  }, [triggerExport, filters]);

  const handleDrilldown = useCallback((title: string, patch: Partial<CdrUiFilters>) => {
    setDrilldown({ title, patch });
  }, []);

  return (
    <VStack gap="24" max className="flex-1">
      <Flex justify="between" align="center" className="px-2">
        <Flex align="center" gap="12">
          <Flex align="center" justify="center" className="p-2.5 bg-indigo-500/10 rounded-xl">
            <PhoneCall className="w-6 h-6 text-indigo-500" />
          </Flex>
          <VStack>
            <Text variant="h1">{t('cdr.title', 'Журнал звонков (CDR)')}</Text>
            <Text variant="muted">{t('cdr.subtitle', 'Детализация звонков АТС')}</Text>
          </VStack>
        </Flex>
      </Flex>

      <CdrStats stats={statsData} isLoading={statsLoading} />

      <Card className="border-muted/50 shadow-sm backdrop-blur-xl bg-background/50 flex flex-col min-h-[500px]">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
          <Flex justify="between" align="center" className="mb-4 flex-wrap gap-2">
            <Flex gap="8">
              <Button
                variant={activeTab === 'journal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('journal')}
              >
                <List className="w-4 h-4 mr-2" />
                {t('cdr.tabs.journal', 'Журнал')}
              </Button>
              <Button
                variant={activeTab === 'analytics' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('analytics')}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                {t('cdr.tabs.analytics', 'Аналитика')}
              </Button>
            </Flex>
            {listData && activeTab === 'journal' && (
              <Text variant="muted" className="text-sm">
                ({listData.count})
              </Text>
            )}
          </Flex>
          <CdrFilter
            filters={filters}
            onChange={handleFilterChange}
            onExportCsv={handleExportCsv}
            isExporting={isExporting}
          />
        </CardHeader>
        <CardContent className="p-0 flex-1">
          {activeTab === 'journal' ? (
            <VStack gap="0">
              <CdrTable
                data={listData?.rows || []}
                isLoading={listLoading || isFetching}
                totalRows={listData?.count || 0}
                currentPage={page - 1}
                pageSize={PAGE_SIZE}
                onPageChange={(p) => handlePageChange(p + 1)}
                onLegsClick={(call: ICdrCall) => setLegsLinkedid(call.linkedid)}
              />
            </VStack>
          ) : (
            <VStack className="p-4">
              <CdrCharts filters={filters} onDrilldown={handleDrilldown} />
            </VStack>
          )}
        </CardContent>
      </Card>

      <CdrLegsModal
        linkedid={legsLinkedid}
        isOpen={legsLinkedid !== null}
        onClose={() => setLegsLinkedid(null)}
      />

      <CdrDrilldownModal
        isOpen={drilldown !== null}
        onClose={() => setDrilldown(null)}
        title={drilldown?.title || ''}
        baseFilters={filters}
        drillFilters={drilldown?.patch || {}}
      />
    </VStack>
  );
});

CdrReportPage.displayName = 'CdrReportPage';

export default CdrReportPage;
