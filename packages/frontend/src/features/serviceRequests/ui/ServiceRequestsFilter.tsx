import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select, Button, Flex, Text } from '@/shared/ui';
import { Search, X, SlidersHorizontal, Calendar } from 'lucide-react';
import { REQUEST_STATUS_OPTIONS } from '@/entities/serviceRequest';
import {
  useGetCcSubjectsQuery,
  useGetCcDistrictsQuery,
} from '@/shared/api/endpoints/serviceRequestApi';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

export interface ServiceRequestFilters {
  search?: string;
  status?: string;
  topic?: string;
  territorialZone?: string;
  district?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface ServiceRequestsFilterProps {
  filters: ServiceRequestFilters;
  onChange: (filters: Partial<ServiceRequestFilters>) => void;
}

export const ServiceRequestsFilter = memo(({ filters, onChange }: ServiceRequestsFilterProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const { data: subjects = [] } = useGetCcSubjectsQuery();
  const { data: allDistricts = [] } = useGetCcDistrictsQuery();

  const zones = [...new Set(allDistricts.map((d) => d.territorial_zone))];
  const filteredDistricts = filters.territorialZone
    ? allDistricts.filter((d) => d.territorial_zone === filters.territorialZone)
    : [];

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ search: e.target.value });
  }, [onChange]);

  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ status: e.target.value === 'all' ? undefined : e.target.value });
  }, [onChange]);

  const handleTopicChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ topic: e.target.value === 'all' ? undefined : e.target.value });
  }, [onChange]);

  const handleZoneChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value === 'all' ? undefined : e.target.value;
    onChange({ territorialZone: val, district: undefined });
  }, [onChange]);

  const handleDistrictChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ district: e.target.value === 'all' ? undefined : e.target.value });
  }, [onChange]);

  const clearFilters = useCallback(() => {
    onChange({
      search: '', status: undefined, topic: undefined,
      territorialZone: undefined, district: undefined,
      dateFrom: undefined, dateTo: undefined,
    });
  }, [onChange]);

  const hasFilters = Boolean(
    filters.search || filters.status || filters.topic ||
    filters.territorialZone || filters.district ||
    filters.dateFrom || filters.dateTo
  );

  const activeFilterCount = [
    filters.status, filters.topic, filters.territorialZone,
    filters.district, filters.dateFrom, filters.dateTo,
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
            {/* Status */}
            <Select value={filters.status || 'all'} onChange={handleStatusChange} className="w-full">
              <option value="all">{t('serviceRequests.filter.allStatuses', 'Все статусы')}</option>
              {REQUEST_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey, opt.fallback)}</option>
              ))}
            </Select>

            {/* Topic */}
            <Select value={filters.topic || 'all'} onChange={handleTopicChange} className="w-full">
              <option value="all">{t('serviceRequests.filter.allTopics', 'Все темы')}</option>
              {subjects.map((s) => (
                <option key={s.uid} value={s.name}>{s.name}</option>
              ))}
            </Select>

            {/* Zone */}
            <Select value={filters.territorialZone || 'all'} onChange={handleZoneChange} className="w-full">
              <option value="all">{t('serviceRequests.filter.allZones', 'Все зоны')}</option>
              {zones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </Select>

            {/* District */}
            <Select
              value={filters.district || 'all'}
              onChange={handleDistrictChange}
              disabled={!filters.territorialZone}
              className="w-full"
            >
              <option value="all">{filters.territorialZone ? t('serviceRequests.filter.allDistricts', 'Все районы') : t('serviceRequests.filter.selectZone', '← Зона')}</option>
              {filteredDistricts.map((d) => (
                <option key={d.uid} value={d.district}>{d.district}</option>
              ))}
            </Select>

            {/* Date range with labels */}
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
      {/* Search */}
      <div className="relative flex-1 min-w-[160px] basis-[calc(20%-0.5rem)]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
        <Input
          placeholder={t('serviceRequests.searchPlaceholder', 'Поиск...')}
          value={filters.search || ''}
          onChange={handleSearchChange}
          className="pl-9 w-full"
        />
      </div>

      {/* Status */}
      <div className="flex-1 min-w-[120px] basis-[calc(14%-0.5rem)]">
        <Select value={filters.status || 'all'} onChange={handleStatusChange} className="w-full">
          <option value="all">{t('serviceRequests.filter.allStatuses', 'Все статусы')}</option>
          {REQUEST_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{t(opt.labelKey, opt.fallback)}</option>
          ))}
        </Select>
      </div>

      {/* Topic */}
      <div className="flex-1 min-w-[120px] basis-[calc(14%-0.5rem)]">
        <Select value={filters.topic || 'all'} onChange={handleTopicChange} className="w-full">
          <option value="all">{t('serviceRequests.filter.allTopics', 'Все темы')}</option>
          {subjects.map((s) => (
            <option key={s.uid} value={s.name}>{s.name}</option>
          ))}
        </Select>
      </div>

      {/* Zone */}
      <div className="flex-1 min-w-[120px] basis-[calc(14%-0.5rem)]">
        <Select value={filters.territorialZone || 'all'} onChange={handleZoneChange} className="w-full">
          <option value="all">{t('serviceRequests.filter.allZones', 'Все зоны')}</option>
          {zones.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </Select>
      </div>

      {/* District */}
      <div className="flex-1 min-w-[120px] basis-[calc(14%-0.5rem)]">
        <Select
          value={filters.district || 'all'}
          onChange={handleDistrictChange}
          disabled={!filters.territorialZone}
          className="w-full"
        >
          <option value="all">{filters.territorialZone ? t('serviceRequests.filter.allDistricts', 'Все районы') : t('serviceRequests.filter.selectZone', '← Зона')}</option>
          {filteredDistricts.map((d) => (
            <option key={d.uid} value={d.district}>{d.district}</option>
          ))}
        </Select>
      </div>

      {/* Date range with labels */}
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

      {/* Clear */}
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
