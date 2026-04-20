import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select, Button, Flex } from '@/shared/ui';
import { Search, X } from 'lucide-react';
import { CDR_DISPOSITION_OPTIONS } from '@/shared/api/endpoints/voiceRobotCdrApi';

interface VoiceRobotCdrFilterProps {
  filters: {
    search?: string;
    disposition?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  onChange: (filters: Partial<VoiceRobotCdrFilterProps['filters']>) => void;
}

export const VoiceRobotCdrFilter = memo(({ filters, onChange }: VoiceRobotCdrFilterProps) => {
  const { t } = useTranslation();

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ search: e.target.value });
  }, [onChange]);

  const handleDispositionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onChange({ disposition: value === 'all' ? undefined : value });
  }, [onChange]);

  const clearFilters = useCallback(() => {
    onChange({ search: '', disposition: undefined, dateFrom: undefined, dateTo: undefined });
  }, [onChange]);

  const hasFilters = Boolean(filters.search || filters.disposition || filters.dateFrom || filters.dateTo);

  return (
    <Flex gap="16" align="center" className="flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('voiceRobots.cdr.filterSearch')}
          value={filters.search || ''}
          onChange={handleSearchChange}
          className="pl-9 bg-background/50 border-muted-foreground/20 focus-visible:ring-indigo-500"
        />
      </div>

      <div className="w-[200px]">
        <Select value={filters.disposition || 'all'} onChange={handleDispositionChange} className="bg-background/50 border-muted-foreground/20 focus:ring-indigo-500">
          <option value="all">{t('common.all', 'Все')}</option>
          {CDR_DISPOSITION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey, opt.fallback)}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={filters.dateFrom || ''}
          onChange={(e) => onChange({ dateFrom: e.target.value })}
          className="w-auto bg-background/50 border-muted-foreground/20 text-sm"
        />
        <span className="text-muted-foreground text-sm">-</span>
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
    </Flex>
  );
});

VoiceRobotCdrFilter.displayName = 'VoiceRobotCdrFilter';
