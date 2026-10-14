import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetDashboardSystemQuery } from '@/shared/api/endpoints/dashboardApi';
import {
  Button,
  HStack,
  VStack,
  Text,
  Select,
  Skeleton,
  QueryErrorState,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/shared/ui';
import { DashboardChart } from '@/shared/ui/DashboardChart/DashboardChart';
import { DashboardSource } from './DashboardSource';
import { useDocumentVisible } from '../model/useDashboardOverview';
import { hasDashboardValue } from '../model/dashboardView';
import cls from './Dashboard.module.scss';

export function DashboardSystem({ nodeId, timezone }: { nodeId?: string; timezone: string }) {
  const { t, i18n } = useTranslation();
  const visible = useDocumentVisible();
  const [selected, setSelected] = useState(nodeId);
  const [range, setRange] = useState<'1h' | '24h' | '7d'>('1h');
  const query = useGetDashboardSystemQuery(
    { nodeId: selected, range },
    { pollingInterval: visible ? 15000 : 0 },
  );
  if (!query.data)
    return query.isError ? (
      <QueryErrorState onRetry={query.refetch} />
    ) : (
      <Skeleton className={cls.empty} />
    );
  const node = query.data.nodes.find((row) => row.id === selected) ?? query.data.nodes[0];
  const sample = node?.current;
  const known = node && hasDashboardValue(node.source);
  const percent = (value: number | null | undefined) =>
    known && value !== null && value !== undefined ? value.toFixed(1) + '%' : t('dashboard.noData');
  const metric = (label: string, value: string) => (
    <VStack gap="12" align="start" className={cls.detailRow}>
      <Text variant="xs">{label}</Text>
      <Text className={cls.resourceValue}>{value}</Text>
    </VStack>
  );
  const formatTime = (at: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(at));
  return (
    <Tabs value={range} onValueChange={(value) => setRange(value as typeof range)} asChild>
      <VStack gap="16" align="stretch" max>
        <VStack gap="12" align="stretch" className={cls.detailToolbar}>
          <Select
            aria-label={t('dashboard.node')}
            value={node?.id || ''}
            onChange={(e) => setSelected(e.target.value)}
            options={query.data.nodes.map((row) => ({ value: row.id, label: row.label }))}
          />
          <TabsList aria-label={t('dashboard.historyRange')} className={cls.periodTabs}>
            {['1h', '24h', '7d'].map((value) => (
              <TabsTrigger key={value} value={value} className={cls.periodTab}>
                {t('dashboard.range.' + value)}
              </TabsTrigger>
            ))}
          </TabsList>
        </VStack>
        <TabsContent value={range} className={cls.periodContent}>
          <VStack gap="16" align="stretch" max>
            {node ? (
              <>
                <Text variant="muted">{t('dashboard.nodeRole.' + node.role)}</Text>
                <DashboardSource source={node.source} timezone={timezone} />
                <HStack className={cls.detailGrid}>
                  {metric(t('dashboard.cpu'), percent(sample?.cpu))}
                  {metric(t('dashboard.memory'), percent(sample?.memory))}
                  {metric(
                    t('dashboard.load'),
                    known && sample?.load != null ? sample.load.toFixed(2) : t('dashboard.noData'),
                  )}
                  {metric(
                    t('dashboard.uptime'),
                    known && sample?.uptime != null
                      ? t('dashboard.uptimeHours', { count: Math.floor(sample.uptime / 3600) })
                      : t('dashboard.noData'),
                  )}
                  {metric(
                    t('dashboard.networkRx'),
                    known && sample?.networkRx != null
                      ? (sample.networkRx / 1024 / 1024).toFixed(2) + ' MB/s'
                      : t('dashboard.noData'),
                  )}
                  {metric(
                    t('dashboard.networkTx'),
                    known && sample?.networkTx != null
                      ? (sample.networkTx / 1024 / 1024).toFixed(2) + ' MB/s'
                      : t('dashboard.noData'),
                  )}
                  {(sample?.disks ?? []).map((disk) => (
                    <VStack gap="4" key={disk.mount} className={cls.detailRow}>
                      <Text>{disk.mount}</Text>
                      <Text variant="muted">
                        {known
                          ? t('dashboard.diskUsage', {
                              percent: disk.usedPercent.toFixed(1),
                              free: (disk.availableBytes / 1024 ** 3).toFixed(1),
                            })
                          : t('dashboard.noData')}
                      </Text>
                    </VStack>
                  ))}
                  {(sample?.missingFilesystems ?? []).slice(0, 8).map((mount) => (
                    <VStack gap="4" key={'missing:' + mount} className={cls.detailRow}>
                      <Text>{mount}</Text>
                      <Text variant="muted">{t('dashboard.noData')}</Text>
                    </VStack>
                  ))}
                </HStack>
                <VStack gap="12" align="stretch" className={cls.detailChart}>
                  <Text variant="h4">{t('dashboard.resourceHistory')}</Text>
                  <Text variant="muted">{t('dashboard.peaksPreserved')}</Text>
                  {query.data.history?.length ? (
                    <DashboardChart
                      label={t('dashboard.resourceHistory')}
                      points={query.data.history.map((row) => ({
                        at: row.at,
                        cpu: row.cpu,
                        cpuMax: row.cpuMax,
                        memory: row.memory,
                        memoryMax: row.memoryMax,
                      }))}
                      series={[
                        { key: 'cpu', label: t('dashboard.cpu'), color: 'var(--color-primary)' },
                        {
                          key: 'cpuMax',
                          label: t('dashboard.cpuMax'),
                          color: 'var(--color-destructive)',
                        },
                        {
                          key: 'memory',
                          label: t('dashboard.memory'),
                          color: 'var(--color-success)',
                        },
                        {
                          key: 'memoryMax',
                          label: t('dashboard.memoryMax'),
                          color: 'var(--color-muted-foreground)',
                        },
                      ]}
                      formatTime={formatTime}
                      onPoint={() => undefined}
                    />
                  ) : (
                    <Text variant="muted">{t('dashboard.noHistory')}</Text>
                  )}
                </VStack>
              </>
            ) : (
              <Text variant="muted">{t('dashboard.source.notConfigured')}</Text>
            )}
            {query.isError && <QueryErrorState onRetry={query.refetch} />}
            <Button type="button" variant="outline" onClick={() => void query.refetch()}>
              {t('dashboard.refresh')}
            </Button>
          </VStack>
        </TabsContent>
      </VStack>
    </Tabs>
  );
}
