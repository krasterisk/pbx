import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Download } from 'lucide-react';
import { Button, Flex, Input, Select, Text } from '@/shared/ui';
import type { CdrUiFilters } from '@/features/cdr/model/lib/cdrFiltersToParams';
import cls from './CdrFilter.module.scss';

const SEARCH_DEBOUNCE_MS = 400;

interface CdrFilterProps {
  filters: CdrUiFilters;
  onChange: (patch: Partial<CdrUiFilters>) => void;
  onExportCsv?: () => void;
  isExporting?: boolean;
}

export const CdrFilter = memo(({ filters, onChange, onExportCsv, isExporting }: CdrFilterProps) => {
  const { t } = useTranslation();
  const [localSearch, setLocalSearch] = useState(filters.search || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalSearch(filters.search || '');
  }, [filters.search]);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ search: value || undefined });
    }, SEARCH_DEBOUNCE_MS);
  }, [onChange]);

  const clearAll = useCallback(() => {
    setLocalSearch('');
    onChange({
      search: undefined,
      direction: undefined,
      disposition: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      extension: undefined,
      trunk: undefined,
      bucket: undefined,
      bucketValue: undefined,
    });
  }, [onChange]);

  const hasFilters = Boolean(
    filters.search || filters.direction || filters.disposition ||
    filters.dateFrom || filters.dateTo || filters.bucket,
  );

  return (
    <Flex gap="16" align="center" className={cls.filterRow}>
      <Flex className={cls.searchWrap} align="center">
        <Search className={cls.searchIcon} />
        <Input
          className={cls.searchInput}
          placeholder={t('cdr.filter.search', 'Поиск по номеру, каналу...')}
          value={localSearch}
          onChange={handleSearch}
        />
      </Flex>

      <Select
        value={filters.direction || 'all'}
        onChange={(e) => onChange({ direction: e.target.value === 'all' ? undefined : e.target.value })}
      >
        <option value="all">{t('cdr.filter.directionAll', 'Все направления')}</option>
        <option value="in">{t('cdr.filter.directionIn', 'Входящие')}</option>
        <option value="out">{t('cdr.filter.directionOut', 'Исходящие')}</option>
        <option value="int">{t('cdr.filter.directionInt', 'Внутренние')}</option>
        <option value="external">{t('cdr.filter.directionExt', 'Внешние')}</option>
      </Select>

      <Select
        value={filters.disposition || 'all'}
        onChange={(e) => onChange({ disposition: e.target.value === 'all' ? undefined : e.target.value })}
      >
        <option value="all">{t('cdr.filter.dispositionAll', 'Все статусы')}</option>
        <option value="answered">{t('cdr.filter.answered', 'Отвеченные')}</option>
        <option value="missed">{t('cdr.filter.missed', 'Пропущенные')}</option>
        <option value="ANSWERED">ANSWERED</option>
        <option value="NO ANSWER">NO ANSWER</option>
        <option value="BUSY">BUSY</option>
      </Select>

      <Input
        type="date"
        className={cls.dateField}
        value={filters.dateFrom || ''}
        onChange={(e) => onChange({ dateFrom: e.target.value || undefined })}
      />
      <Text variant="muted">-</Text>
      <Input
        type="date"
        className={cls.dateField}
        value={filters.dateTo || ''}
        onChange={(e) => onChange({ dateTo: e.target.value || undefined })}
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="w-4 h-4 mr-2" />
          {t('common.clear', 'Очистить')}
        </Button>
      )}

      {onExportCsv && (
        <Button variant="outline" size="sm" onClick={onExportCsv} disabled={isExporting}>
          <Download className="w-4 h-4 mr-2" />
          CSV
        </Button>
      )}
    </Flex>
  );
});

CdrFilter.displayName = 'CdrFilter';
