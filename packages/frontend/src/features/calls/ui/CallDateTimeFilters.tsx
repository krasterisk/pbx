import { useEffect, useRef, useState } from 'react';
import type { CallsQuery, OrganizationWeekStart } from '@krasterisk/shared';
import { useTranslation } from 'react-i18next';
import {
  Flex,
  InfoTooltip,
  Input,
  Select,
  Switch,
  Text,
  VStack,
} from '@/shared/ui';
import { callDateTimeInstant, callLocalDateTime } from '../model/callDateTime';
import { callPeriodParams, selectedCallPeriod, visibleCallPeriods, type CallPeriod } from '../model/savedCallFilters';
import cls from './Calls.module.scss';
function boundary(query: CallsQuery, timezone: string, end: boolean) {
  const instant = end ? query.to : query.from;
  if (instant && Number.isFinite(Date.parse(instant)))
    return callLocalDateTime(
      end ? new Date(Date.parse(instant) - 60000).toISOString() : instant,
      timezone,
    );
  const fallback = callPeriodParams('week', timezone);
  const date = (end ? query.dateTo : query.dateFrom) ||
    (end ? fallback.dateTo : fallback.dateFrom);
  return date + (end ? 'T23:59' : 'T00:00');
}
export function CallDateTimeFilters({
  query,
  timezone,
  periodPreset,
  weekStart = 'monday',
  patch,
}: {
  query: CallsQuery;
  timezone: string;
  periodPreset?: CallPeriod;
  weekStart?: OrganizationWeekStart;
  patch: (value: Record<string, string | undefined>) => void;
}) {
  const { t } = useTranslation();
  const initialPreset = selectedCallPeriod(query, timezone, periodPreset, new Date(), weekStart);
  const [preset, setPreset] = useState<CallPeriod>(initialPreset);
  const [from, setFrom] = useState(() => boundary(query, timezone, false));
  const [to, setTo] = useState(() => boundary(query, timezone, true));
  const [timed, setTimed] = useState(Boolean(query.from || query.to));
  const [error, setError] = useState(false);
  const signature = JSON.stringify([
    timezone,
    query.from,
    query.to,
    query.dateFrom,
    query.dateTo,
    periodPreset,
    weekStart,
  ]);
  const expected = useRef<string | null>(null);
  useEffect(() => {
    if (signature === expected.current) {
      expected.current = null;
      return;
    }
    expected.current = null;
    setFrom(boundary(query, timezone, false));
    setTo(boundary(query, timezone, true));
    setTimed(Boolean(query.from || query.to));
    setPreset(initialPreset);
    setError(false);
    // Only period changes synchronize the draft. Other conditions retain unfinished input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  const commit = (value: Record<string, string | undefined>) => {
    const next = { ...query, ...value };
    expected.current = JSON.stringify([
      timezone,
      next.from,
      next.to,
      next.dateFrom,
      next.dateTo,
      'periodPreset' in value ? value.periodPreset : periodPreset,
      weekStart,
    ]);
    patch(value);
  };

  const apply = (startCivil: string, endCivil: string, withTime: boolean) => {
    const start = callDateTimeInstant(startCivil, timezone),
      end = callDateTimeInstant(endCivil, timezone, true);
    if (!start || !end || Date.parse(end) < Date.parse(start)) {
      setError(true);
      return;
    }
    setError(false);
    commit(
      withTime
        ? {
            periodPreset: 'custom',
            dateFrom: undefined,
            dateTo: undefined,
            from: start,
            to: new Date(Date.parse(end) + 60000).toISOString(),
          }
        : {
            periodPreset: 'custom',
            from: undefined,
            to: undefined,
            dateFrom: startCivil.slice(0, 10),
            dateTo: endCivil.slice(0, 10),
          },
    );
  };
  const change = (value: string, end: boolean) => {
    const civil = timed ? value : value + (end ? 'T23:59' : 'T00:00');
    if (end) setTo(civil);
    else setFrom(civil);
    apply(end ? from : civil, end ? civil : to, timed);
  };
  return (
    <VStack gap="8" align="stretch" className={cls.dateTimeFilters}>
      <Flex gap="8" align="center" className={cls.dateComposer}>
        <Select
          aria-label={t('calls.period')}
          value={preset}
          onChange={(event) => {
            const value = event.target.value as CallPeriod;
            setPreset(value);
            setError(false);
            if (value !== 'custom') {
              commit({
                ...callPeriodParams(value, timezone, new Date(), weekStart),
                periodPreset: value,
                from: undefined,
                to: undefined,
              });
            } else {
              commit(
                query.from || query.to
                  ? { periodPreset: 'custom' }
                  : {
                      periodPreset: 'custom',
                      dateFrom: boundary(query, timezone, false).slice(0, 10),
                      dateTo: boundary(query, timezone, true).slice(0, 10),
                    },
              );
              setFrom(boundary(query, timezone, false));
              setTo(boundary(query, timezone, true));
            }
          }}
        >
          {[...visibleCallPeriods, 'custom'].map((value) => (
            <option key={value} value={value}>
              {t(`calls.periods.${value}`)}
            </option>
          ))}
        </Select>
        {preset === 'custom' && (
          <>
            <Input
              aria-label={t('calls.from')}
              type={timed ? 'datetime-local' : 'date'}
              className={cls.dateInput}
              value={timed ? from : from.slice(0, 10)}
              onInput={(e) => change(e.currentTarget.value, false)}
              onChange={(e) => change(e.target.value, false)}
            />
            <Input
              aria-label={t('calls.to')}
              type={timed ? 'datetime-local' : 'date'}
              className={cls.dateInput}
              value={timed ? to : to.slice(0, 10)}
              onInput={(e) => change(e.currentTarget.value, true)}
              onChange={(e) => change(e.target.value, true)}
            />
            <Flex gap="4" align="center">
              <Switch
                aria-label={t('calls.includeTime')}
                checked={timed}
                onCheckedChange={(value) => {
                  const start = from.slice(0, 10) + 'T00:00',
                    end = to.slice(0, 10) + 'T23:59';
                  setTimed(value);
                  setFrom(start);
                  setTo(end);
                  apply(start, end, value);
                }}
              />
              <Text variant="muted">{t('calls.includeTime')}</Text>
              <InfoTooltip text={t('calls.timeRangeHint')} />
            </Flex>
          </>
        )}
      </Flex>
      {error && (
        <Text role="alert" className={cls.validationError}>
          {t('calls.timeRangeError')}
        </Text>
      )}
    </VStack>
  );
}
