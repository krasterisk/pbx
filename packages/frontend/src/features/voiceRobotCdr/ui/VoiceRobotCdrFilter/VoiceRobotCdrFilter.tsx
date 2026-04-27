import { memo, useCallback, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select, Button, Flex } from '@/shared/ui';
import { Search, X, Download } from 'lucide-react';
import { CDR_DISPOSITION_OPTIONS, useGetCdrTagsQuery } from '@/shared/api/endpoints/voiceRobotCdrApi';

const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MIN_CHARS = 2;

interface VoiceRobotCdrFilterProps {
  filters: {
    search?: string;
    disposition?: string;
    dateFrom?: string;
    dateTo?: string;
    tag?: string;
  };
  onChange: (filters: Partial<VoiceRobotCdrFilterProps['filters']>) => void;
  /** CSV export callback */
  onExportCsv?: () => void;
  /** Whether CSV export is in progress */
  isExporting?: boolean;
}

export const VoiceRobotCdrFilter = memo(({ filters, onChange, onExportCsv, isExporting }: VoiceRobotCdrFilterProps) => {
  const { t } = useTranslation();

  // Fetch unique tags from server (lightweight query)
  const { data: availableTags = [] } = useGetCdrTagsQuery(undefined);

  // ─── Debounced search ────────────────────────────────────
  const [localSearch, setLocalSearch] = useState(filters.search || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external → local when filters.search changes (e.g. on clear)
  useEffect(() => {
    setLocalSearch(filters.search || '');
  }, [filters.search]);

  const handleSearchInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      // Only fire search if empty (clear) or >= min chars
      if (value.length === 0 || value.length >= SEARCH_MIN_CHARS) {
        onChange({ search: value || undefined });
      }
    }, SEARCH_DEBOUNCE_MS);
  }, [onChange]);

  // Cleanup timeout on unmount
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // ─── Other handlers ──────────────────────────────────────

  const handleDispositionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onChange({ disposition: value === 'all' ? undefined : value });
  }, [onChange]);

  const handleTagChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onChange({ tag: value === 'all' ? undefined : value });
  }, [onChange]);

  const clearFilters = useCallback(() => {
    setLocalSearch('');
    onChange({ search: undefined, disposition: undefined, dateFrom: undefined, dateTo: undefined, tag: undefined });
  }, [onChange]);

  const hasFilters = Boolean(filters.search || filters.disposition || filters.dateFrom || filters.dateTo || filters.tag);

  return (
    <Flex gap="16" align="center" className="flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('voiceRobots.cdr.filterSearch')}
          value={localSearch}
          onChange={handleSearchInput}
          className="pl-9 bg-background/50 border-muted-foreground/20 focus-visible:ring-indigo-500"
        />
      </div>

      <div className="w-[200px]">
        <Select value={filters.disposition || 'all'} onChange={handleDispositionChange} className="bg-background/50 border-muted-foreground/20 focus:ring-indigo-500">
          <option value="all">{t('voiceRobots.cdr.filterDisposition', 'Все исходы')}</option>
          {CDR_DISPOSITION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey, opt.fallback)}
            </option>
          ))}
        </Select>
      </div>

      {availableTags.length > 0 && (
        <div className="w-[220px]">
          <Select value={filters.tag || 'all'} onChange={handleTagChange} className="bg-background/50 border-muted-foreground/20 focus:ring-indigo-500">
            <option value="all">{t('voiceRobots.cdr.filterTag', 'Все теги')}</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={filters.dateFrom || ''}
          onChange={(e) => onChange({ dateFrom: e.target.value })}
          className="w-auto bg-background/50 border-muted-foreground/20 text-sm"
        />
        <span className="text-muted-foreground text-sm">—</span>
        <Input
          type="date"
          value={filters.dateTo || ''}
          onChange={(e) => onChange({ dateTo: e.target.value })}
          className="w-auto bg-background/50 border-muted-foreground/20 text-sm"
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4 mr-2" />
          {t('common.clear', 'Очистить')}
        </Button>
      )}

      {onExportCsv && (
        <Button
          variant="outline"
          size="sm"
          onClick={onExportCsv}
          disabled={isExporting}
          className="h-9 gap-2 text-xs font-medium border-dashed border-2 hover:border-primary/50 text-muted-foreground hover:text-primary transition-colors"
        >
          <Download className={`w-4 h-4 ${isExporting ? 'animate-pulse' : ''}`} />
          {isExporting ? '...' : 'CSV'}
        </Button>
      )}
    </Flex>
  );
});

VoiceRobotCdrFilter.displayName = 'VoiceRobotCdrFilter';
