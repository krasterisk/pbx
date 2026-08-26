import { memo } from 'react';
import { HStack, Input, Select } from '@/shared/ui';
import { KOMANDOR_STATUS_OPTIONS } from '@/entities/komandorClaim';
import { useGetKomandorDictQuery } from '@/shared/api/endpoints/komandorClaimApi';

export interface KomandorClaimFilters {
  search?: string;
  status?: string;
  topic?: string;
  store?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface Props {
  filters: KomandorClaimFilters;
  onChange: (next: Partial<KomandorClaimFilters>) => void;
}

export const KomandorClaimsFilter = memo(({ filters, onChange }: Props) => {
  const { data: dict = [] } = useGetKomandorDictQuery('topic');
  const topics = dict.filter((d) => d.kind === 'topic');

  return (
    <HStack gap="8" className="flex-wrap">
      <Input
        className="min-w-[180px]"
        placeholder="Поиск..."
        value={filters.search || ''}
        onChange={(e) => onChange({ search: e.target.value || undefined })}
      />
      <Select
        className="min-w-[140px]"
        value={filters.status || ''}
        onChange={(e) => onChange({ status: e.target.value || undefined })}
      >
        <option value="">Все статусы</option>
        {KOMANDOR_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
      <Select
        className="min-w-[200px]"
        value={filters.topic || ''}
        onChange={(e) => onChange({ topic: e.target.value || undefined })}
      >
        <option value="">Все тематики</option>
        {topics.map((t) => (
          <option key={t.uid} value={t.name}>{t.name}</option>
        ))}
      </Select>
      <Input
        className="min-w-[160px]"
        placeholder="Магазин"
        value={filters.store || ''}
        onChange={(e) => onChange({ store: e.target.value || undefined })}
      />
      <Input type="date" value={filters.dateFrom || ''} onChange={(e) => onChange({ dateFrom: e.target.value || undefined })} />
      <Input type="date" value={filters.dateTo || ''} onChange={(e) => onChange({ dateTo: e.target.value || undefined })} />
    </HStack>
  );
});

KomandorClaimsFilter.displayName = 'KomandorClaimsFilter';
