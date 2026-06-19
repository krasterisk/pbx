import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Button, Flex, Text, MultiSelect, type MultiSelectOption } from '@/shared/ui';
import { Search, X, SlidersHorizontal, Calendar } from 'lucide-react';
import { REQUEST_STATUS_OPTIONS } from '@/entities/serviceRequest';
import {
  useGetCcSubjectsQuery,
  useGetCcDistrictsQuery,
} from '@/shared/api/endpoints/serviceRequestApi';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

export interface ServiceRequestFilters {
  search?: string;
  statuses?: string[];
  topics?: string[];
  territorialZones?: string[];
  districts?: string[];
  dateFrom?: string;
  dateTo?: string;
}

interface ServiceRequestsFilterProps {
  filters: ServiceRequestFilters;
  onChange: (filters: Partial<ServiceRequestFilters>) => void;
}

function normalizeMultiSelectValues(values: string[]): string[] | undefined {
  const items = values.map((s) => s.trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export const ServiceRequestsFilter = memo(({ filters, onChange }: ServiceRequestsFilterProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const { data: subjects = [] } = useGetCcSubjectsQuery();
  const { data: allDistricts = [] } = useGetCcDistrictsQuery();

  const zones = useMemo(
    () => [...new Set(allDistricts.map((d) => d.territorial_zone))],
    [allDistricts],
  );

  const topicOptions = useMemo<MultiSelectOption[]>(
    () => subjects.map((s) => ({ value: s.name, label: s.name })),
    [subjects],
  );

  const statusOptions = useMemo<MultiSelectOption[]>(
    () => REQUEST_STATUS_OPTIONS.map((opt) => ({
      value: opt.value,
      label: t(opt.labelKey, opt.fallback),
    })),
    [t],
  );

  const zoneOptions = useMemo<MultiSelectOption[]>(
    () => zones.map((z) => ({ value: z, label: z })),
    [zones],
  );

  const districtOptions = useMemo<MultiSelectOption[]>(() => {
    const selectedZones = filters.territorialZones || [];
    const pool = selectedZones.length
      ? allDistricts.filter((d) => selectedZones.includes(d.territorial_zone))
      : allDistricts;

    return pool.map((d) => ({
      value: d.district,
      label: d.district,
      description: selectedZones.length !== 1 ? d.territorial_zone : undefined,
    }));
  }, [allDistricts, filters.territorialZones]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ search: e.target.value });
  }, [onChange]);

  const handleStatusesChange = useCallback((values: string[]) => {
    onChange({ statuses: normalizeMultiSelectValues(values) });
  }, [onChange]);

  const handleTopicsChange = useCallback((values: string[]) => {
    onChange({ topics: normalizeMultiSelectValues(values) });
  }, [onChange]);

  const handleZonesChange = useCallback((values: string[]) => {
    const nextZones = normalizeMultiSelectValues(values) || [];
    const nextDistricts = (filters.districts || []).filter((district) =>
      nextZones.length === 0 ||
      allDistricts.some((d) => d.district === district && nextZones.includes(d.territorial_zone)),
    );

    onChange({
      territorialZones: nextZones.length ? nextZones : undefined,
      districts: nextDistricts.length ? nextDistricts : undefined,
    });
  }, [onChange, filters.districts, allDistricts]);

  const handleDistrictsChange = useCallback((values: string[]) => {
    onChange({ districts: normalizeMultiSelectValues(values) });
  }, [onChange]);

  const clearFilters = useCallback(() => {
    onChange({
      search: '',
      statuses: undefined,
      topics: undefined,
      territorialZones: undefined,
      districts: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
  }, [onChange]);

  const hasFilters = Boolean(
    filters.search || filters.statuses?.length ||
    filters.topics?.length || filters.territorialZones?.length || filters.districts?.length ||
    filters.dateFrom || filters.dateTo,
  );

  const activeFilterCount = [
    filters.statuses?.length,
    filters.topics?.length,
    filters.territorialZones?.length,
    filters.districts?.length,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;

  // ─── Labeled date input ─────────────────────────────────
  const DateField = ({ label, value, onDateChange }: { label: string; value: string; onDateChange: (v: string) => void }) => (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <Text variant="small" className="text-xs text-muted-foreground font-medium flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        {label}
      </Text>
      <Input
        type="date"
        value={value}
        onChange={(e) => onDateChange(e.target.value)}
        className="w-full text-sm"
      />
    </div>
  );

  const statusFilter = (
    <MultiSelect
      value={filters.statuses || []}
      onChange={handleStatusesChange}
      options={statusOptions}
      placeholder={t('serviceRequests.filter.allStatuses', 'Все статусы')}
      className="w-full"
    />
  );

  const topicFilter = (
    <MultiSelect
      value={filters.topics || []}
      onChange={handleTopicsChange}
      options={topicOptions}
      placeholder={t('serviceRequests.filter.allTopics', 'Все темы')}
      className="w-full"
    />
  );

  const zoneFilter = (
    <MultiSelect
      value={filters.territorialZones || []}
      onChange={handleZonesChange}
      options={zoneOptions}
      placeholder={t('serviceRequests.filter.allZones', 'Все зоны')}
      className="w-full"
    />
  );

  const districtFilter = (
    <MultiSelect
      value={filters.districts || []}
      onChange={handleDistrictsChange}
      options={districtOptions}
      placeholder={t('serviceRequests.filter.allDistricts', 'Все районы')}
      className="w-full"
    />
  );

  // ─── Mobile layout ──────────────────────────────────────
  if (isMobile) {
    return (
      <Flex gap="8" direction="column">
        {/* Search + Toggle row */}
        <Flex gap="8" align="center">
          <Flex className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
            <Input
              placeholder={t('serviceRequests.searchPlaceholder', 'Поиск...')}
              value={filters.search || ''}
              onChange={handleSearchChange}
              className="pl-9 w-full"
            />
          </Flex>
          <Button
            variant={filtersExpanded ? 'default' : 'outline'}
            size="icon"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="shrink-0 h-10 w-10 relative"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="icon" onClick={clearFilters} className="shrink-0 h-10 w-10 text-muted-foreground">
              <X className="w-4 h-4" />
            </Button>
          )}
        </Flex>

        {/* Expandable filters */}
        {filtersExpanded && (
          <Flex gap="8" direction="column" className="animate-in slide-in-from-top-2 fade-in duration-200">
            {statusFilter}
            {topicFilter}
            {zoneFilter}
            {districtFilter}

            <Flex align="end" gap="8" className="w-full">
              <DateField
                label={t('serviceRequests.filter.dateFrom', 'Дата от')}
                value={filters.dateFrom || ''}
                onDateChange={(v) => onChange({ dateFrom: v })}
              />
              <DateField
                label={t('serviceRequests.filter.dateTo', 'Дата до')}
                value={filters.dateTo || ''}
                onDateChange={(v) => onChange({ dateTo: v })}
              />
            </Flex>
          </Flex>
        )}
      </Flex>
    );
  }

  // ─── Desktop layout ─────────────────────────────────────
  return (
    <div className="flex flex-wrap gap-2 items-end w-full">
      <div className="relative flex-1 min-w-[160px] basis-[calc(20%-0.5rem)]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
        <Input
          placeholder={t('serviceRequests.searchPlaceholder', 'Поиск...')}
          value={filters.search || ''}
          onChange={handleSearchChange}
          className="pl-9 w-full"
        />
      </div>

      <div className="flex-1 min-w-[140px] basis-[calc(14%-0.5rem)]">
        {statusFilter}
      </div>

      <div className="flex-1 min-w-[140px] basis-[calc(14%-0.5rem)]">
        {topicFilter}
      </div>

      <div className="flex-1 min-w-[140px] basis-[calc(14%-0.5rem)]">
        {zoneFilter}
      </div>

      <div className="flex-1 min-w-[140px] basis-[calc(14%-0.5rem)]">
        {districtFilter}
      </div>

      <div className="flex items-end gap-2 flex-1 min-w-[200px] basis-[calc(24%-0.5rem)]">
        <DateField
          label={t('serviceRequests.filter.dateFrom', 'Дата от')}
          value={filters.dateFrom || ''}
          onDateChange={(v) => onChange({ dateFrom: v })}
        />
        <DateField
          label={t('serviceRequests.filter.dateTo', 'Дата до')}
          value={filters.dateTo || ''}
          onDateChange={(v) => onChange({ dateTo: v })}
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground shrink-0 self-end">
          <X className="w-4 h-4 mr-1" />
          <span className="text-sm">{t('serviceRequests.filter.clear', 'Сбросить')}</span>
        </Button>
      )}
    </div>
  );
});

ServiceRequestsFilter.displayName = 'ServiceRequestsFilter';
