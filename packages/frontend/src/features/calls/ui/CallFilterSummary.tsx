import type { CallsQuery, OrganizationWeekStart } from '@krasterisk/shared';
import { CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Flex, Text, Tooltip } from '@/shared/ui';
import { useGetCompanyCallFacetsQuery } from '@/shared/api/endpoints/callsApi';
import { invalidCallPeriod } from '../model/callPeriod';
import { callFilterSummary } from '../model/callFilterSummary';
import type { CallPeriod } from '../model/savedCallFilters';
import cls from './Calls.module.scss';

export function CallFilterSummary({ query, timezone, periodPreset, weekStart }: { query: CallsQuery; timezone: string; periodPreset?: CallPeriod; weekStart?: OrganizationWeekStart }) {
  const { t, i18n } = useTranslation();
  const directorySelected = Boolean(query.employees?.length || query.departments?.length || query.companyNumbers?.length || query.queues?.length || query.groups?.length || query.robots?.length || query.trunks?.length || query.extension || query.department || query.companyNumber);
  const { currentData: facets } = useGetCompanyCallFacetsQuery(
    { ...query, cursor: undefined, directorySearch: undefined },
    { skip: !directorySelected || invalidCallPeriod(query) || Boolean(query.search && query.search.trim().length < 3) },
  );
  return (
    <Flex role="region" aria-label={t('calls.filterSummary')} gap="4" align="center" wrap="wrap" className={cls.filterSummary}>
      {callFilterSummary(query, timezone, i18n.language, key => String(t(key)), facets, new Date(), periodPreset, weekStart).map(item => (
        <Tooltip key={item.key} content={item.text}>
          <Flex gap="4" align="center" className={cls.summaryCondition}>
            {item.key === 'period' && <CalendarDays key="icon" size={12} aria-hidden="true" />}
            <Text key="value" as="span" className={cls.summaryValue}>{item.text}</Text>
          </Flex>
        </Tooltip>
      ))}
    </Flex>
  );
}
