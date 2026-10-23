import type { CallDimension, CallsQuery } from '@krasterisk/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetCompanyCallFacetsQuery } from '@/shared/api/endpoints/callsApi';
import {
  Button,
  Flex,
  Input,
  Label,
  MultiSelect,
  Select,
  Text,
  VStack,
  InfoTooltip,
} from '@/shared/ui';
import cls from './Calls.module.scss';
import { invalidCallPeriod } from '../model/callPeriod';

export function CallDirectoryFilters({
  query,
  patch,
  advanced,
  visibleFields,
  compact = false,
}: {
  query: CallsQuery;
  patch: (value: Record<string, string | string[] | undefined>) => void;
  advanced: boolean;
  visibleFields?: string[];
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [directorySearch, setDirectorySearch] = useState('');
  const [knownLabels, setKnownLabels] = useState<{
    context: string;
    values: Record<string, string>;
  }>({ context: '', values: {} });
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setDirectorySearch(
          search.trim().length >= 3 ? search.trim().slice(0, 128) : '',
        ),
      650,
    );
    return () => clearTimeout(timer);
  }, [search]);
  const {
    currentData: data,
    data: previous,
    isFetching,
    isError,
    refetch,
  } = useGetCompanyCallFacetsQuery(
    {
      ...query,
      cursor: undefined,
      directorySearch: directorySearch || undefined,
    },
    {
      skip:
        invalidCallPeriod(query) ||
        Boolean(query.search && query.search.trim().length < 3),
    },
  );
  const context = (data || previous)?.contextKey || 'legacy';
  const labels = knownLabels.context === context ? knownLabels.values : {};
  useEffect(() => {
    if (!data) return;
    setKnownLabels((old) => {
      const values = old.context === context ? { ...old.values } : {};
      let changed = old.context !== context;
      for (const [kind, options] of Object.entries(data.options))
        for (const option of options) {
          const key = kind + ':' + option.value;
          if (values[key] !== option.label) changed = true;
          values[key] = option.label;
        }
      return changed ? { context, values } : old;
    });
  }, [data, context]);
  const fields = [
    {
      kind: 'employee',
      key: 'employees',
      legacy: 'extension',
      title: 'employee',
    },
    {
      kind: 'department',
      key: 'departments',
      legacy: 'department',
      title: 'department',
    },
    {
      kind: 'companyNumber',
      key: 'companyNumbers',
      legacy: 'companyNumber',
      title: 'companyNumber',
    },
    { kind: 'queue', key: 'queues', title: 'queue' },
    { kind: 'group', key: 'groups', title: 'group' },
    { kind: 'robot', key: 'robots', title: 'robot' },
    { kind: 'trunk', key: 'trunks', title: 'trunk' },
  ] as Array<{
    kind: CallDimension | 'trunk' | 'group';
    key:
      | 'employees'
      | 'departments'
      | 'companyNumbers'
      | 'queues'
      | 'groups'
      | 'robots'
      | 'trunks';
    legacy?: 'extension' | 'department' | 'companyNumber';
    title: string;
  }>;
  return (
    <VStack gap="12" align="stretch" aria-busy={isFetching}>
      {advanced && !visibleFields && (
        <VStack gap="4" align="stretch">
          <Label htmlFor="calls-directory-search">
            {t('calls.directorySearchLabel')}
            <InfoTooltip text={t('calls.filterLogic')} />
          </Label>
          <Input
            id="calls-directory-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('calls.directorySearchHint')}
          />
        </VStack>
      )}
      <Flex className={cls.filterRow}>
        {fields
          .filter((field) =>
            visibleFields
              ? visibleFields.includes(field.key)
              : advanced || !['queue', 'robot'].includes(field.kind),
          )
          .map((field) => {
            const legacy = field.legacy && query[field.legacy];
            const selected = query[field.key] || (legacy ? [legacy] : []);
            const options = [
              ...(data?.options[field.kind] ||
                previous?.options[field.kind] ||
                []),
            ];
            for (const value of selected)
              if (!options.some((o) => o.value === value))
                options.push({
                  value,
                  label: labels[field.kind + ':' + value] || value,
                  count: 0,
                });
            const label = (option: (typeof options)[number]) => {
              const name =
                field.kind === 'robot' && option.label === option.value
                  ? `${t(`calls.actor.${option.value.split(':')[0]}`)} ${option.value.split(':').slice(1).join(':')}`
                  : option.label;
              return `${name}${field.kind === 'employee' && name !== option.value ? ` · ${option.value}` : ''}`;
            };
            return (
              <VStack
                key={field.key}
                gap="4"
                align="stretch"
                className={cls.field}
              >
                {!compact && (
                  <Text as="span" variant="muted">
                    {t(`calls.${field.title}`)}
                  </Text>
                )}
                <MultiSelect
                  ariaLabel={t(`calls.${field.title}`)}
                  searchable
                  onSearchChange={setSearch}
                  options={options.map((o) => ({
                    value: o.value,
                    label: label(o),
                    description:
                      data && !isFetching
                        ? t('calls.facetCount', { count: o.count })
                        : t('common.loading'),
                  }))}
                  value={selected}
                  onChange={(values) =>
                    patch({ [field.key]: values.length ? values : undefined })
                  }
                  placeholder={t('calls.all')}
                  searchPlaceholder={t('calls.directorySearch')}
                />
              </VStack>
            );
          })}
        {advanced && (
          <>
            {(!visibleFields || visibleFields.includes('recording')) && (
              <VStack gap="4" align="stretch" className={cls.field}>
                {!compact && (
                  <Label htmlFor="calls-recording">
                    {t('calls.recording')}
                  </Label>
                )}
                <Select
                  aria-label={t('calls.recording')}
                  id="calls-recording"
                  value={query.recording || ''}
                  onChange={(e) =>
                    patch({ recording: e.target.value || undefined })
                  }
                >
                  <option value="">{t('calls.all')}</option>
                  <option value="yes">{t('calls.withRecording')}</option>
                  <option value="no">{t('calls.withoutRecording')}</option>
                </Select>
              </VStack>
            )}
            {(!visibleFields || visibleFields.includes('voicemail')) && (
              <VStack gap="4" align="stretch" className={cls.field}>
                {!compact && (
                  <Label htmlFor="calls-voicemail">
                    {t('calls.voicemail')}
                  </Label>
                )}
                <Select
                  aria-label={t('calls.voicemail')}
                  id="calls-voicemail"
                  value={query.voicemail || ''}
                  onChange={(e) =>
                    patch({ voicemail: e.target.value || undefined })
                  }
                >
                  <option value="">{t('calls.all')}</option>
                  <option value="1">{t('calls.hasVoicemail')}</option>
                </Select>
              </VStack>
            )}
            {data?.analyticsAllowed &&
              (!visibleFields || visibleFields.includes('analytics')) && (
                <VStack gap="4" align="stretch" className={cls.field}>
                  {!compact && (
                    <Label htmlFor="calls-analytics">
                      {t('calls.analytics')}
                    </Label>
                  )}
                  <Select
                    aria-label={t('calls.analytics')}
                    id="calls-analytics"
                    value={query.analytics || ''}
                    onChange={(e) =>
                      patch({ analytics: e.target.value || undefined })
                    }
                  >
                    <option value="">{t('calls.all')}</option>
                    {['none', 'queued', 'running', 'analyzed', 'failed'].map(
                      (state) => (
                        <option key={state} value={state}>
                          {t(`calls.analysis.${state}`)}
                        </option>
                      ),
                    )}
                  </Select>
                </VStack>
              )}
          </>
        )}
      </Flex>
      {isError && (
        <Flex gap="8" align="center">
          <Text role="status">{t('calls.facetsError')}</Text>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            {t('calls.refresh')}
          </Button>
        </Flex>
      )}
      {data && Object.values(data.truncated).some(Boolean) && (
        <InfoTooltip text={t('calls.facetsLimited')} />
      )}
      {!compact && (
        <Flex gap="8" wrap="wrap">
          {fields.flatMap((field) =>
            (query[field.key] || []).map((value) => {
              const option = (data || previous)?.options[field.kind]?.find(
                (o) => o.value === value,
              );
              return (
                <Button
                  key={`${field.key}:${value}`}
                  size="sm"
                  variant="outline"
                  aria-label={`${t('calls.removeFilter')}: ${option?.label || labels[field.kind + ':' + value] || value}`}
                  onClick={() =>
                    patch({
                      [field.key]: query[field.key]!.filter((v) => v !== value)
                        .length
                        ? query[field.key]!.filter((v) => v !== value)
                        : undefined,
                    })
                  }
                >
                  {t(`calls.${field.title}`)}:{' '}
                  {option?.label || labels[field.kind + ':' + value] || value} ×
                </Button>
              );
            }),
          )}
        </Flex>
      )}
    </VStack>
  );
}
