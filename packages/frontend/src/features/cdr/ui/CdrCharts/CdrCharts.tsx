import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { Text, VStack } from '@/shared/ui';
import {
  useGetCdrByHourQuery,
  useGetCdrByDayQuery,
  useGetCdrByExtensionQuery,
  useGetCdrByTrunkQuery,
  useGetCdrByDispositionQuery,
  useGetCdrHeatmapQuery,
} from '@/shared/api/endpoints/cdrApi';
import type { CdrUiFilters } from '@/features/cdr/model/lib/cdrFiltersToParams';
import cls from './CdrCharts.module.scss';

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7'];

interface CdrChartsProps {
  filters: CdrUiFilters;
  onDrilldown: (title: string, patch: Partial<CdrUiFilters>) => void;
}

export const CdrCharts = memo(({ filters, onDrilldown }: CdrChartsProps) => {
  const { t } = useTranslation();
  const chartParams = {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    direction: filters.direction,
    disposition: filters.disposition,
    search: filters.search,
  };

  const { data: byHour = [] } = useGetCdrByHourQuery(chartParams);
  const { data: byDay = [] } = useGetCdrByDayQuery(chartParams);
  const { data: byExt = [] } = useGetCdrByExtensionQuery(chartParams);
  const { data: byTrunk = [] } = useGetCdrByTrunkQuery(chartParams);
  const { data: byDisp = [] } = useGetCdrByDispositionQuery(chartParams);
  const { data: heatmap = [] } = useGetCdrHeatmapQuery(chartParams);

  const hourData = useMemo(() => (byHour as any[]).map((r) => ({
    hour: `${r.hour}:00`,
    hourVal: r.hour,
    calls: Number(r.calls),
    answered: Number(r.answered),
    missed: Number(r.missed),
  })), [byHour]);

  const dayData = useMemo(() => (byDay as any[]).map((r) => ({
    day: r.day,
    calls: Number(r.calls),
    answered: Number(r.answered),
    missed: Number(r.missed),
  })), [byDay]);

  const extData = useMemo(() => (byExt as any[]).slice(0, 10).map((r) => ({
    name: r.displayName || r.extension,
    extension: r.extension,
    total: Number(r.total),
  })), [byExt]);

  const trunkData = useMemo(() => (byTrunk as any[]).slice(0, 10).map((r) => ({
    name: r.trunk,
    calls: Number(r.calls),
  })), [byTrunk]);

  const dispData = useMemo(() => (byDisp as any[]).map((r) => ({
    name: r.disposition,
    value: Number(r.count),
  })), [byDisp]);

  const maxHeat = useMemo(() => {
    let m = 1;
    for (const c of heatmap) m = Math.max(m, c.calls);
    return m;
  }, [heatmap]);

  const onHourClick = useCallback((data: any) => {
    if (data?.hourVal !== undefined) {
      onDrilldown(
        t('cdr.drilldown.hour', { hour: data.hourVal, defaultValue: `Звонки в ${data.hourVal}:00` }),
        { bucket: 'hour', bucketValue: String(data.hourVal) },
      );
    }
  }, [onDrilldown, t]);

  const onDayClick = useCallback((data: any) => {
    if (data?.day) {
      onDrilldown(
        t('cdr.drilldown.day', { day: data.day, defaultValue: `Звонки за ${data.day}` }),
        { bucket: 'day', bucketValue: data.day },
      );
    }
  }, [onDrilldown, t]);

  return (
    <VStack className={cls.grid} gap="16">
      <VStack className={cls.chartCard}>
        <Text className={cls.chartTitle}>{t('cdr.charts.byHour', 'По часам')}</Text>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={hourData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="hour" fontSize={11} />
            <YAxis fontSize={11} />
            <RechartsTooltip />
            <Legend />
            <Bar dataKey="answered" stackId="a" fill="#22c55e" name={t('cdr.filter.answered', 'Отвеченные')} onClick={onHourClick} style={{ cursor: 'pointer' }} />
            <Bar dataKey="missed" stackId="a" fill="#ef4444" name={t('cdr.filter.missed', 'Пропущенные')} onClick={onHourClick} style={{ cursor: 'pointer' }} />
          </BarChart>
        </ResponsiveContainer>
      </VStack>

      <VStack className={cls.chartCard}>
        <Text className={cls.chartTitle}>{t('cdr.charts.byDay', 'По дням')}</Text>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={dayData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="day" fontSize={11} />
            <YAxis fontSize={11} />
            <RechartsTooltip />
            <Line type="monotone" dataKey="calls" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} onClick={onDayClick} />
          </LineChart>
        </ResponsiveContainer>
      </VStack>

      <VStack className={cls.chartCard}>
        <Text className={cls.chartTitle}>{t('cdr.charts.byExtension', 'По абонентам')}</Text>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={extData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis type="number" fontSize={11} />
            <YAxis dataKey="name" type="category" width={80} fontSize={11} />
            <RechartsTooltip />
            <Bar dataKey="total" fill="#6366f1" onClick={(d) => d?.extension && onDrilldown(`Абонент ${d.extension}`, { extension: d.extension })} />
          </BarChart>
        </ResponsiveContainer>
      </VStack>

      <VStack className={cls.chartCard}>
        <Text className={cls.chartTitle}>{t('cdr.charts.byTrunk', 'По транкам')}</Text>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={trunkData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="name" fontSize={11} />
            <YAxis fontSize={11} />
            <RechartsTooltip />
            <Bar dataKey="calls" fill="#3b82f6" onClick={(d) => d?.name && onDrilldown(`Транк ${d.name}`, { trunk: d.name })} />
          </BarChart>
        </ResponsiveContainer>
      </VStack>

      <VStack className={cls.chartCard}>
        <Text className={cls.chartTitle}>{t('cdr.charts.disposition', 'Статусы')}</Text>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={dispData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
              onClick={(d) => d?.name && onDrilldown(`Статус ${d.name}`, { bucket: 'disposition', bucketValue: d.name })}
            >
              {dispData.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip />
          </PieChart>
        </ResponsiveContainer>
      </VStack>

      <VStack className={`${cls.chartCard} ${cls.fullWidth}`}>
        <Text className={cls.chartTitle}>{t('cdr.charts.heatmap', 'Тепловая карта (день x час)')}</Text>
        <VStack className={cls.heatmapGrid}>
          {Array.from({ length: 7 }, (_, dow) =>
            Array.from({ length: 24 }, (_, hour) => {
              const cell = heatmap.find((h) => h.dow === dow + 1 && h.hour === hour);
              const calls = cell?.calls ?? 0;
              const intensity = calls / maxHeat;
              return (
                <VStack
                  key={`${dow}-${hour}`}
                  className={cls.heatCell}
                  style={{
                    background: `color-mix(in srgb, var(--color-primary) ${Math.round(intensity * 100)}%, transparent)`,
                  }}
                  title={`${dow + 1}/${hour}: ${calls}`}
                  onClick={() => onDrilldown(`День ${dow + 1}, ${hour}:00`, { bucket: 'hour', bucketValue: String(hour) })}
                >
                  {''}
                </VStack>
              );
            }),
          )}
        </VStack>
      </VStack>
    </VStack>
  );
});

CdrCharts.displayName = 'CdrCharts';
