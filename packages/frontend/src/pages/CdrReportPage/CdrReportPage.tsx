import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { PhoneCall, BarChart3, List, Voicemail } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Text,
  Button,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useGetCdrListQuery,
  useGetCdrStatsQuery,
  useLazyExportCdrQuery,
} from '@/shared/api/endpoints/cdrApi';
import { useGetVoicemailMessagesQuery } from '@/shared/api/endpoints/voicemailApi';
import { useGetConferenceRecordingsByUniqueidQuery } from '@/shared/api/endpoints/conferenceMeetingsApi';
import {
  CdrFilter,
  CdrStats,
  CdrTable,
  CdrLegsModal,
  CdrDrilldownModal,
  CdrCharts,
  VoicemailDetailsModal,
  ConferenceRecordingModal,
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
  const [detailsUniqueid, setDetailsUniqueid] = useState<string | null>(null);
  const [conferenceUniqueid, setConferenceUniqueid] = useState<string | null>(null);
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
    { skip: currentTab === 'analytics' },
  );

  const voicemailIds = useMemo(
    () => new Set((voicemailMessages ?? []).map((msg) => msg.uniqueid)),
    [voicemailMessages],
  );
  const journalUniqueids = useMemo(
    () =>
      currentTab === 'journal'
        ? (listData?.rows ?? []).map((row) => row.uniqueid).filter(Boolean)
        : [],
    [currentTab, listData?.rows],
  );
  const { data: conferenceRecordings } = useGetConferenceRecordingsByUniqueidQuery(
    journalUniqueids,
    { skip: journalUniqueids.length === 0 },
  );
  const conferenceIds = useMemo(
    () => new Set((conferenceRecordings ?? []).map((item) => item.uniqueid)),
    [conferenceRecordings],
  );
  const journalRows = useMemo(
    () => (listData?.rows ?? []).map((row) => ({
      ...row,
      hasVoicemail: voicemailIds.has(row.uniqueid),
      hasConferenceRecording: conferenceIds.has(row.uniqueid),
    })),
    [listData?.rows, voicemailIds, conferenceIds],
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
    <VStack gap="24" max className={cls.page} data-testid="cdr-report-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <PhoneCall size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>{t('cdr.title')}</Text>
            <Text variant="muted">{t('cdr.subtitle')}</Text>
          </VStack>
        </HStack>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.statsScroll}>
        <CdrStats stats={statsData} isLoading={statsLoading} />
      </Flex>

      <Card className={cls.card}>
        <CardHeader className={cls.cardHeader}>
          <Flex justify="between" align="center" className={cls.tabsRow} max>
            <HStack gap="8" align="center" className={cls.tabs}>
              <Button
                variant={currentTab === 'journal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectTab('journal')}
              >
                <List size={16} className={cls.tabIcon} />
                {t('cdr.tabs.journal', 'Журнал')}
              </Button>
              <Button
                variant={currentTab === 'analytics' ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectTab('analytics')}
              >
                <BarChart3 size={16} className={cls.tabIcon} />
                {t('cdr.tabs.analytics', 'Аналитика')}
              </Button>
              <Button
                variant={currentTab === 'voicemail' ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectTab('voicemail')}
              >
                <Voicemail size={16} className={cls.tabIcon} />
                {t('cdr.tabs.voicemail', 'Голосовые сообщения')}
              </Button>
            </HStack>
            {listData && currentTab === 'journal' && (
              <Text variant="muted">({listData.count})</Text>
            )}
            {currentTab === 'voicemail' && (
              <Text variant="muted">({voicemailMessages?.length ?? 0})</Text>
            )}
          </Flex>
          <Flex direction="column" align="stretch" className={cls.filterBar} max>
            <CdrFilter
              filters={filters}
              onChange={handleFilterChange}
              onExportCsv={handleExportCsv}
              isExporting={isExporting}
            />
          </Flex>
        </CardHeader>
        <CardContent className={cls.cardContent}>
          {currentTab === 'journal' ? (
            <Flex
              direction="column"
              align="stretch"
              className={cls.tableScroll}
              data-testid="hybrid-table"
              data-hybrid="overflow-x-auto"
            >
              <CdrTable
                data={journalRows}
                isLoading={listLoading || isFetching}
                totalRows={listData?.count || 0}
                currentPage={page - 1}
                pageSize={PAGE_SIZE}
                onPageChange={(p) => handlePageChange(p + 1)}
                onLegsClick={(call: ICdrCall) => setLegsLinkedid(call.linkedid)}
                onVoicemailClick={(uniqueid) => setDetailsUniqueid(uniqueid)}
                onConferenceClick={(uniqueid) => setConferenceUniqueid(uniqueid)}
              />
            </Flex>
          ) : currentTab === 'analytics' ? (
            <VStack className={cls.analytics} max>
              <CdrCharts filters={filters} onDrilldown={handleDrilldown} />
            </VStack>
          ) : (
            <Flex direction="column" align="stretch" className={cls.tableScroll} max>
              {voicemailLoading ? (
                <Text variant="muted" className={cls.vmEmpty}>{t('common.loading', 'Загрузка...')}</Text>
              ) : (voicemailMessages ?? []).length === 0 ? (
                <Text variant="muted" className={cls.vmEmpty}>{t('cdr.voicemail.empty', 'Нет голосовых сообщений')}</Text>
              ) : (
                <table className={cls.vmTable}>
                  <thead>
                    <tr>
                      <th className={cls.vmTh}>{t('cdr.table.date', 'Дата')}</th>
                      <th className={cls.vmTh}>{t('cdr.table.src', 'Кто звонил')}</th>
                      <th className={cls.vmTh}>{t('cdr.table.dst', 'Куда')}</th>
                      <th className={cls.vmTh}>{t('cdr.table.duration', 'Длительность')}</th>
                      <th className={cls.vmTh}>{t('cdr.voicemail.transcript', 'Расшифровка')}</th>
                      <th className={cls.vmTh}>{t('cdr.voicemail.processingStatus', 'Статус обработки')}</th>
                      <th className={cls.vmTh}>{t('cdr.voicemail.detailsTitle', 'Детали сообщения')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(voicemailMessages ?? []).map((msg) => (
                      <tr key={msg.uid}>
                        <td className={cls.vmTd}>
                          {msg.created_at
                            ? new Date(msg.created_at).toLocaleString('ru-RU')
                            : ''}
                        </td>
                        <td className={cls.vmTd}>{msg.caller_id}</td>
                        <td className={cls.vmTd}>{msg.exten}</td>
                        <td className={cls.vmTd}>{msg.duration_sec ?? 0}s</td>
                        <td className={`${cls.vmTd} ${cls.vmTranscript}`}>
                          {msg.transcript || ''}
                        </td>
                        <td className={cls.vmTd}>{msg.transcript_status}</td>
                        <td className={cls.vmTd}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cls.vmDetailsBtn}
                            title={t('cdr.voicemail.detailsTitle', 'Детали сообщения')}
                            aria-label={t('cdr.voicemail.detailsTitle', 'Детали сообщения')}
                            onClick={() => setDetailsUniqueid(msg.uniqueid)}
                          >
                            <Voicemail size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Flex>
          )}
        </CardContent>
      </Card>

      <CdrLegsModal
        linkedid={legsLinkedid}
        isOpen={legsLinkedid !== null}
        onClose={() => setLegsLinkedid(null)}
      />

      <VoicemailDetailsModal
        uniqueid={detailsUniqueid}
        isOpen={detailsUniqueid !== null}
        onClose={() => setDetailsUniqueid(null)}
      />

      <ConferenceRecordingModal
        uniqueid={conferenceUniqueid}
        isOpen={conferenceUniqueid !== null}
        onClose={() => setConferenceUniqueid(null)}
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
