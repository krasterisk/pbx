import type { CallPeriod } from '../model/savedCallFilters';
import { useState } from 'react';
import type { CallsQuery, OrganizationWeekStart } from '@krasterisk/shared';
import { useTranslation } from 'react-i18next';
import { X, Plus } from 'lucide-react';
import { Button, Flex, MultiSelect, Text, VStack } from '@/shared/ui';
import { CallDirectoryFilters } from './CallDirectoryFilters';
import { CallDateTimeFilters } from './CallDateTimeFilters';
import { CallNumberFilters } from './CallNumberFilters';
import cls from './Calls.module.scss';
const fields = {
  period: 'period',
  directions: 'directionLabel',
  outcomes: 'result',
  numbers: 'numbers',
  employees: 'employee',
  departments: 'department',
  companyNumbers: 'companyNumber',
  queues: 'queue',
  groups: 'group',
  robots: 'robot',
  trunks: 'trunk',
  handlings: 'handling',
  recording: 'recording',
  voicemail: 'voicemail',
  analytics: 'analytics',
} as const;
type Field = keyof typeof fields;
const aliases: Partial<Record<Field, keyof CallsQuery>> = {
  directions: 'direction',
  outcomes: 'outcome',
  employees: 'extension',
  departments: 'department',
  companyNumbers: 'companyNumber',
  handlings: 'handling',
};
export function CallAdvancedFilters({
  query,
  patch,
  analyticsAllowed,
  timezone = 'UTC',
  periodPreset,
  weekStart,
}: {
  query: CallsQuery;
  patch: (value: Record<string, string | string[] | undefined>) => void;
  analyticsAllowed: boolean;
  timezone?: string;
  periodPreset?: CallPeriod;
  weekStart?: OrganizationWeekStart;
}) {
  const { t } = useTranslation();
  const active = (Object.keys(fields) as Field[]).filter((key) => {
    const value =
      key === 'period'
        ? query.from ||
          query.to ||
          query.dateFrom !== undefined ||
          query.dateTo !== undefined
        : key === 'outcomes'
          ? query.outcomes?.length || query.outcome || query.results?.length
          : query[key] || (aliases[key] ? query[aliases[key]!] : undefined);
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
  const [added, setAdded] = useState<Field[]>([]);
  const selected = [...new Set<Field>(['period', ...active, ...added])];
  const clearing = (key: Field) => ({
    [key]: undefined,
    ...(aliases[key] ? { [aliases[key]!]: undefined } : {}),
    ...(key === 'numbers' ? { numberRole: undefined } : {}),
    ...(key === 'period'
      ? {
          periodPreset: undefined,
          from: undefined,
          to: undefined,
          dateFrom: undefined,
          dateTo: undefined,
        }
      : {}),
    ...(key === 'outcomes' ? { results: undefined } : {}),
  });
  const clear = (key: Field) => {
    patch(clearing(key));
    setAdded((old) => old.filter((value) => value !== key));
  };
  return (
    <VStack gap="4" align="stretch">
      {selected.map((key) => (
        <Flex key={key} gap="8" align="center" className={cls.conditionRow}>
          <Text className={cls.conditionLabel}>
            {t(`calls.${fields[key]}`)}
          </Text>
          <VStack align="stretch" className={cls.conditionValue}>
            {key === 'period' ? (
              <CallDateTimeFilters
                query={query}
                timezone={timezone}
                periodPreset={periodPreset}
                weekStart={weekStart}
                patch={patch}
              />
            ) : key === 'directions' ? (
              <MultiSelect
                ariaLabel={t('calls.directionLabel')}
                value={
                  query.directions || (query.direction ? [query.direction] : [])
                }
                onChange={(values) =>
                  patch({ directions: values.length ? values : undefined })
                }
                options={['in', 'out', 'internal', 'external'].map((value) => ({
                  value,
                  label: t(`calls.directionFilter.${value}`),
                }))}
                placeholder={t('calls.all')}
              />
            ) : key === 'outcomes' ? (
              <MultiSelect
                ariaLabel={t('calls.result')}
                value={[
                  ...(query.outcomes || (query.outcome ? [query.outcome] : [])),
                  ...(query.results || []),
                ]}
                onChange={(values) =>
                  patch({
                    outcomes: values.filter(
                      (value) =>
                        !['busy', 'noAnswer', 'unavailable'].includes(value),
                    ),
                    results: values.filter((value) =>
                      ['busy', 'noAnswer', 'unavailable'].includes(value),
                    ),
                  })
                }
                options={[
                  'human',
                  'robot',
                  'voicemail',
                  'menu',
                  'active',
                  'busy',
                  'noAnswer',
                  'unavailable',
                  ...(query.outcomes || []).filter(
                    (value) =>
                      ![
                        'human',
                        'robot',
                        'voicemail',
                        'menu',
                        'active',
                      ].includes(value),
                  ),
                ].map((value) => ({
                  value,
                  label: t(
                    ['busy', 'noAnswer', 'unavailable'].includes(value)
                      ? `calls.connectionResult.${value}`
                      : `calls.outcome.${value}`,
                  ),
                }))}
                placeholder={t('calls.all')}
              />
            ) : key === 'numbers' ? (
              <CallNumberFilters query={query} patch={patch} />
            ) : key === 'handlings' ? (
              <MultiSelect
                searchable
                ariaLabel={t('calls.handling')}
                value={
                  query.handlings || (query.handling ? [query.handling] : [])
                }
                onChange={(values) =>
                  patch({ handlings: values.length ? values : undefined })
                }
                options={[
                  'employee',
                  'queue',
                  'menu',
                  'voiceRobot',
                  'aiRobot',
                  'autodial',
                ].map((value) => ({
                  value,
                  label: t(
                    value === 'autodial'
                      ? 'calls.autodial'
                      : `calls.actor.${value}`,
                  ),
                }))}
                placeholder={t('calls.all')}
              />
            ) : (
              <CallDirectoryFilters
                query={query}
                patch={patch}
                advanced
                visibleFields={[key]}
                compact
              />
            )}
          </VStack>
          {(key !== 'period' || active.includes('period')) && <Button
            size="icon"
            variant="ghost"
            aria-label={`${t('calls.removeFilter')}: ${t(`calls.${fields[key]}`)}`}
            onClick={() => clear(key)}
          >
            <X size={14} />
          </Button>}
        </Flex>
      ))}
      <Flex gap="8" align="center" className={cls.addFilter}>
        <Plus size={16} />
        <MultiSelect
          ariaLabel={t('calls.addFilter')}
          placeholder={t('calls.addFilter')}
          searchable
          value={[]}
          onChange={(values) =>
            setAdded((old) => [...new Set([...old, ...(values as Field[])])])
          }
          options={(Object.keys(fields) as Field[])
            .filter(
              (key) =>
                !selected.includes(key) &&
                (key !== 'analytics' || analyticsAllowed),
            )
            .map((key) => ({ value: key, label: t(`calls.${fields[key]}`) }))}
        />
      </Flex>
    </VStack>
  );
}
