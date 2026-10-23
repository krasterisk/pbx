import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type {
  CallBreakdown,
  CallBreakdownRow,
  CallsQuery,
  CallOutcome,
} from '@krasterisk/shared';
import { Button, Flex, Text, VStack, InfoTooltip } from '@/shared/ui';
import { callsParams } from '@/shared/lib/callsQueryParams';
import { patchCallsQuery } from '../model/callsUrl';
import cls from './Calls.module.scss';

export function cohortHref(
  query: CallsQuery,
  patch: Record<string, string | string[] | undefined>,
): string {
  return `/reports/calls?${patchCallsQuery(callsParams(query), { ...patch, view: undefined })}`;
}
export function CallMetricLink({
  query,
  outcome,
  value,
}: {
  query: CallsQuery;
  outcome?: CallOutcome;
  value: number;
}) {
  return value ? (
    <Button variant="link" size="none" asChild>
      <Link to={cohortHref(query, outcome ? { focusOutcome: outcome } : {})}>
        {value}
      </Link>
    </Button>
  ) : (
    <Text as="span">0</Text>
  );
}
export function CallBreakdowns({
  data,
  query,
}: {
  data: CallBreakdown[];
  query: CallsQuery;
}) {
  const { t } = useTranslation();
  return (
    <VStack gap="16" align="stretch">
      <Flex gap="4" align="center"><Text variant="h3">{t('calls.breakdownsTitle')}</Text><InfoTooltip text={t('calls.breakdownsMeaning')}/></Flex>
      {data.map((group) => {
        const rows = [
          ...group.rows,
          ...(group.unassigned.total ? [group.unassigned] : []),
        ];
        const href = (row: CallBreakdownRow) =>
          cohortHref(
            query,
            row.value === null
              ? {
                  unassignedDimensions: [
                    ...new Set([
                      ...(query.unassignedDimensions || []),
                      group.dimension,
                    ]),
                  ],
                }
              : {
                  [{
                    employee: 'focusEmployee',
                    department: 'focusDepartment',
                    companyNumber: 'focusCompanyNumber',
                  }[group.dimension]]: row.value,
                },
          );
        return (
          <VStack
            key={group.dimension}
            gap="8"
            align="stretch"
            className={cls.breakdown}
          >
            <Text variant="h4">{t(`calls.breakdown.${group.dimension}`)}</Text>
            <Flex className={cls.breakdownHeader}>
              <Text>{t('calls.participants')}</Text>
              <Text>{t('calls.overviewTotal')}</Text>
              <Text>{t('calls.breakdownDelta')}</Text>
              <Text>{t('calls.breakdownOutcomes')}</Text>
            </Flex>
            {rows.map((row) => (
              <Flex key={row.value ?? '__missing'} className={cls.breakdownRow}>
                <Button variant="link" size="none" asChild>
                  <Link to={href(row)}>
                    {row.label ||
                      row.value ||
                      t(`calls.unassigned.${group.dimension}`)}
                    {group.dimension === 'employee' && row.label && row.value
                      ? ` · ${row.value}`
                      : ''}
                  </Link>
                </Button>
                <Button variant="link" size="none" asChild>
                  <Link to={href(row)}>
                    {t('calls.overviewTotal')}: {row.total}
                  </Link>
                </Button>
                <Text>
                  {t('calls.breakdownDelta')}:{' '}
                  {row.total - row.previousTotal >= 0 ? '+' : ''}
                  {row.total - row.previousTotal}
                </Text>
                <Text variant="muted">
                  {t('calls.breakdownCounts', {
                    human: row.human,
                    missed: row.missed,
                    unknown: row.unknown,
                  })}
                </Text>
              </Flex>
            ))}
            {!rows.length && <Text variant="muted">{t('calls.empty')}</Text>}
            {group.truncated && (
              <Text variant="muted">{t('calls.breakdownsLimited')}</Text>
            )}
          </VStack>
        );
      })}
    </VStack>
  );
}
