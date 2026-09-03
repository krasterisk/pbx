import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { PhoneCall, BarChart3, List, Voicemail } from 'lucide-react';
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
import { useGetVoicemailMessagesQuery } from '@/shared/api/endpoints/voicemailApi';
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
import cls from './CdrReportPage.module.scss';

const PAGE_SIZE = 50;

type CdrReportTab = 'journal' | 'analytics' | 'voicemail';

const CdrReportPage = memo(() => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<CdrReportTab>('journal');
  const [legsLinkedid, setLegsLinkedid] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<{ title: string; patch: Partial<CdrUiFilters> } | null>(null);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const filters = useMemo(() => parseFiltersFromSearchParams(searchParams), [searchParams]);
  const voicemailOn = filters.voicemail === '1';
  const currentTab: CdrReportTab = voicemailOn
    ? 'voicemail'
    : activeTab === 'voicemail'
      ? 'journal'
      : activeTab;

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
  const { data: voicemailMessages, isLoading: voicemailLoading } = useGetVoicemailMessagesQuery(
    undefined,
    { skip: !voicemailOn },
  );

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

  const selectTab = useCallback((tab: CdrReportTab) => {
    setActiveTab(tab);
    handleFilterChange({ voicemail: tab === 'voicemail' ? '1' : undefined });
  }, [handleFilterChange]);

  return (
    <VStack gap="24" max className={`${cls.page} flex-1`} data-testid="cdr-report-page-responsive">
      <Flex justify="between" align="center" className="px-2 min-w-0">
        <Flex align="center" gap="12" className="min-w-0">
          <Flex align="center" justify="center" className="p-2.5 bg-indigo-500/10 rounded-xl shrink-0">
            <PhoneCall className="w-6 h-6 text-indigo-500" />
          </Flex>
          <VStack className="min-w-0">
            <Text variant="h1" className={cls.pageTitle}>{t('cdr.title', 'Журнал звонков (CDR)')}</Text>
            <Text variant="muted">{t('cdr.subtitle', 'Детализация звонков АТС')}</Text>
          </VStack>
        </Flex>
      </Flex>

      <div className={cls.statsScroll}>
        <CdrStats stats={statsData} isLoading={statsLoading} />
      </div>

      <Card className={`${cls.card} border-muted/50 shadow-sm backdrop-blur-xl bg-background/50 flex flex-col min-h-[500px]`}>
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
          <Flex justify="between" align="center" className="mb-4 flex-wrap gap-2">
            <Flex gap="8" className="flex-wrap">
              <Button
                variant={currentTab === 'journal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectTab('journal')}
              >
                <List className="w-4 h-4 mr-2" />
                {t('cdr.tabs.journal', 'Журнал')}
              </Button>
              <Button
                variant={currentTab === 'analytics' ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectTab('analytics')}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                {t('cdr.tabs.analytics', 'Аналитика')}
              </Button>
              <Button
                variant={currentTab === 'voicemail' ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectTab('voicemail')}
              >
                <Voicemail className="w-4 h-4 mr-2" />
                {t('cdr.tabs.voicemail', 'Голосовые сообщения')}
              </Button>
            </Flex>
            {listData && currentTab === 'journal' && (
              <Text variant="muted" className="text-sm">
                ({listData.count})
              </Text>
            )}
            {currentTab === 'voicemail' && (
              <Text variant="muted" className="text-sm">
                ({voicemailMessages?.length ?? 0})
              </Text>
            )}
          </Flex>
          <div className={cls.filterBar}>
            <CdrFilter
              filters={filters}
              onChange={handleFilterChange}
              onExportCsv={handleExportCsv}
              isExporting={isExporting}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-w-0">
          {currentTab === 'journal' ? (
            <div
              className={`${cls.tableScroll} overflow-x-auto`}
              data-testid="hybrid-table"
              data-hybrid="overflow-x-auto"
            >
              <CdrTable
                data={listData?.rows || []}
                isLoading={listLoading || isFetching}
                totalRows={listData?.count || 0}
                currentPage={page - 1}
                pageSize={PAGE_SIZE}
                onPageChange={(p) => handlePageChange(p + 1)}
                onLegsClick={(call: ICdrCall) => setLegsLinkedid(call.linkedid)}
              />
            </div>
          ) : currentTab === 'analytics' ? (
            <VStack className="p-4 min-w-0">
              <CdrCharts filters={filters} onDrilldown={handleDrilldown} />
            </VStack>
          ) : (
            <VStack gap="12" className="p-4 min-w-0">
              {voicemailLoading ? (
                <Text variant="muted">{t('common.loading', 'Загрузка...')}</Text>
              ) : (voicemailMessages ?? []).length === 0 ? (
                <Text variant="muted">{t('cdr.voicemail.empty', 'Нет голосовых сообщений')}</Text>
              ) : (
                (voicemailMessages ?? []).map((msg) => (
                  <Flex key={msg.uid} justify="between" align="center" gap="12">
                    <Text>{msg.caller_id}</Text>
                    <Text>{msg.exten}</Text>
                    <Text variant="muted">{msg.duration_sec ?? 0}s</Text>
                    <Text variant="muted">{msg.transcript_status}</Text>
                  </Flex>
                ))
              )}
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
