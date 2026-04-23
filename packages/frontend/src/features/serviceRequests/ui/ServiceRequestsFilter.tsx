import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select, Button, Flex } from '@/shared/ui';
import { Search, X } from 'lucide-react';
import { REQUEST_STATUS_OPTIONS } from '@/entities/serviceRequest';
import {
  useGetCcSubjectsQuery,
  useGetCcDistrictsQuery,
} from '@/shared/api/endpoints/serviceRequestApi';

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

/** Responsive filter class: flex-1 with min-width for wrapping */
const FILTER_CELL = 'flex-1 min-w-[140px] basis-[calc(16.666%-0.5rem)]';

export const ServiceRequestsFilter = memo(({ filters, onChange }: ServiceRequestsFilterProps) => {
  const { t } = useTranslation();
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

  return (
    <Flex gap="8" align="stretch" className="flex-wrap">
      {/* Search */}
      <Flex className={`relative ${FILTER_CELL} min-w-[180px]`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
        <Input
          placeholder={t('serviceRequests.searchPlaceholder', 'Поиск...')}
          value={filters.search || ''}
          onChange={handleSearchChange}
          className="pl-9 w-full"
        />
      </Flex>

      {/* Status */}
      <Flex className={FILTER_CELL}>
        <Select value={filters.status || 'all'} onChange={handleStatusChange} className="w-full">
          <option value="all">Все статусы</option>
          {REQUEST_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{t(opt.labelKey, opt.fallback)}</option>
          ))}
        </Select>
      </Flex>

      {/* Topic */}
      <Flex className={FILTER_CELL}>
        <Select value={filters.topic || 'all'} onChange={handleTopicChange} className="w-full">
          <option value="all">Все темы</option>
          {subjects.map((s) => (
            <option key={s.uid} value={s.name}>{s.name}</option>
          ))}
        </Select>
      </Flex>

      {/* Zone */}
      <Flex className={FILTER_CELL}>
        <Select value={filters.territorialZone || 'all'} onChange={handleZoneChange} className="w-full">
          <option value="all">Все зоны</option>
          {zones.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </Select>
      </Flex>

      {/* District */}
      <Flex className={FILTER_CELL}>
        <Select
          value={filters.district || 'all'}
          onChange={handleDistrictChange}
          disabled={!filters.territorialZone}
          className="w-full"
        >
          <option value="all">{filters.territorialZone ? 'Все районы' : '← Зона'}</option>
          {filteredDistricts.map((d) => (
            <option key={d.uid} value={d.district}>{d.district}</option>
          ))}
        </Select>
      </Flex>

      {/* Date range */}
      <Flex align="center" gap="4" className="flex-1 min-w-[220px] basis-[calc(25%-0.5rem)]">
        <Input
          type="date"
          value={filters.dateFrom || ''}
          onChange={(e) => onChange({ dateFrom: e.target.value })}
          className="flex-1 min-w-0 text-sm"
        />
        <span className="text-muted-foreground text-sm shrink-0">—</span>
        <Input
          type="date"
          value={filters.dateTo || ''}
          onChange={(e) => onChange({ dateTo: e.target.value })}
          className="flex-1 min-w-0 text-sm"
        />
      </Flex>

      {/* Clear */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="w-4 h-4 mr-1" />
          <span className="text-sm">Сбросить</span>
        </Button>
      )}
    </Flex>
  );
});

ServiceRequestsFilter.displayName = 'ServiceRequestsFilter';
