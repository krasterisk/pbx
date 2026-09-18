import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, Text, Pagination } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useGetVoiceRobotCdrsQuery,
  useGetVoiceRobotCdrStatsQuery,
  useLazyExportVoiceRobotCdrQuery,
  IVoiceRobotCdr,
} from '@/shared/api/endpoints/voiceRobotCdrApi';
import {
  VoiceRobotCdrFilter,
  VoiceRobotCdrTable,
  VoiceRobotCdrStats,
  VoiceRobotCdrDetailModal,
} from '@/features/voiceRobotCdr';
import cls from './VoiceRobotCdrPage.module.scss';

const PAGE_SIZE = 50;
const CSV_DELIMITER = ';';

function exportCdrToCsv(data: IVoiceRobotCdr[], t: (...args: [key: string] | [key: string, fallback: string]) => string) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = [
    t('voiceRobots.cdr.table.date'),
    t('voiceRobots.cdr.table.robot'),
    t('voiceRobots.cdr.table.caller'),
    'CallerID Name',
    t('voiceRobots.cdr.table.disposition'),
    t('voiceRobots.cdr.table.tag'),
    t('voiceRobots.cdr.table.duration'),
    t('voiceRobots.cdr.table.steps'),
    'Transfer',
  ].map(esc).join(CSV_DELIMITER);

  const rows = data.map((row) =>
    [
      row.started_at,
      row.robot_name || `ID: ${row.robot_id}`,
      row.caller_id || '',
      row.caller_name || '',
      row.disposition,
      row.tags?.length ? row.tags[row.tags.length - 1] : '',
      row.duration_seconds,
      row.total_steps,
      row.transfer_target || '',
    ].map(esc).join(CSV_DELIMITER),
  );

  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
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
  const [triggerExport, { isFetching: isExporting }] = useLazyExportVoiceRobotCdrQuery();

  const handleFilterChange = useCallback((newFilters: Partial<typeof filters>) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', '1');
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) newParams.set(key, value);
      else newParams.delete(key);
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
        exportCdrToCsv(result.rows, t);
      }
    } catch (e) {
      console.error('CSV export failed:', e);
    }
  }, [triggerExport, filters, t]);

  const totalPages = cdrData ? Math.ceil(cdrData.count / PAGE_SIZE) : 0;

  return (
    <VStack gap="24" max className={cls.page} data-testid="voice-robot-cdr-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Activity size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('voiceRobots.cdr.title')}
            </Text>
            <Text variant="muted">{t('voiceRobots.cdr.subtitle')}</Text>
          </VStack>
        </HStack>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.statsScroll}>
        <VoiceRobotCdrStats stats={statsData} isLoading={isLoadingStats} />
      </Flex>

      <Card className={cls.card}>
        <CardHeader className={cls.cardHeader}>
          <Text className={cls.cardTitle}>
            {t('voiceRobots.cdr.title')}
            {cdrData ? ` (${cdrData.count})` : ''}
          </Text>
          <Flex direction="column" align="stretch" className={cls.filterBar} max>
            <VoiceRobotCdrFilter
              filters={filters}
              onChange={handleFilterChange}
              onExportCsv={handleExportCsv}
              isExporting={isExporting}
            />
          </Flex>
        </CardHeader>
        <CardContent className={cls.cardContent}>
          <Flex
            direction="column"
            align="stretch"
            className={cls.tableScroll}
            data-testid="hybrid-table"
            data-hybrid="overflow-x-auto"
          >
            <VoiceRobotCdrTable
              data={cdrData?.rows || []}
              isLoading={isLoadingCdr || isFetching}
              onRowClick={(cdr) => setSelectedCdrId(cdr.uid)}
            />
          </Flex>
        </CardContent>
        {totalPages > 1 && (
          <Flex justify="center" className={cls.pagination} max>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </Flex>
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
