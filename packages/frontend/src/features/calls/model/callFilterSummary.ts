import type { CallsFacets, CallsQuery, OrganizationWeekStart } from '@krasterisk/shared';
import { callPeriodParams, selectedCallPeriod, type CallPeriod } from './savedCallFilters';

export function callFilterSummary(
  query: CallsQuery,
  timezone: string,
  language: string,
  t: (key: string) => string,
  facets?: CallsFacets,
  now = new Date(),
  periodHint?: CallPeriod,
  weekStart: OrganizationWeekStart = 'monday',
): Array<{ key: string; text: string }> {
  const items: Array<{ key: string; text: string }> = [];
  const add = (key: string, label: string, values: string[]) => {
    if (values.length) items.push({ key, text: `${t(`calls.${label}`)}: ${[...new Set(values)].join(', ')}` });
  };
  const formatDate = (value: string, timed = false, end = false) => {
    const date = timed ? new Date(Date.parse(value) - (end ? 60000 : 0)) : new Date(`${value}T12:00:00Z`);
    if (!Number.isFinite(date.getTime())) return value;
    return new Intl.DateTimeFormat(language, {
      timeZone: timed ? timezone : 'UTC', day: '2-digit', month: '2-digit', year: 'numeric',
      ...(timed ? { hour: '2-digit', minute: '2-digit' } as const : {}),
    }).format(date);
  };
  let period: string;
  const preset = selectedCallPeriod(query, timezone, periodHint, now, weekStart);
  if (preset !== 'custom') {
    period = t(`calls.periods.${preset}`);
  } else if (query.from || query.to) {
    period = `${query.from ? formatDate(query.from, true) : '…'} - ${query.to ? formatDate(query.to, true, true) : '…'}`;
  } else if (query.dateFrom !== undefined || query.dateTo !== undefined) {
    period = !query.dateFrom && !query.dateTo ? t('calls.periods.all') :
      `${query.dateFrom ? formatDate(query.dateFrom) : '…'} - ${query.dateTo ? formatDate(query.dateTo) : '…'}`;
  } else {
    const dates = callPeriodParams('week', timezone, now);
    period = `${formatDate(dates.dateFrom)} - ${formatDate(dates.dateTo)}`;
  }
  add('period', 'period', [period]);
  add('search', 'searchLabel', query.search ? [query.search] : []);
  add('directions', 'directionLabel', (query.directions || (query.direction ? [query.direction] : [])).map(value => t(`calls.directionFilter.${value}`)));
  add('outcomes', 'result', [
    ...(query.outcomes || (query.outcome ? [query.outcome] : [])).map(value => t(`calls.outcome.${value}`)),
    ...(query.results || []).map(value => t(`calls.connectionResult.${value}`)),
  ]);
  add('numbers', 'numbers', (query.numbers || []).map(value => query.numberRole && query.numberRole !== 'any'
    ? `${value} (${t(`calls.numberRoles.${query.numberRole}`)})` : value));
  for (const [key, kind, label, legacy] of [
    ['employees', 'employee', 'employee', 'extension'],
    ['departments', 'department', 'department', 'department'],
    ['companyNumbers', 'companyNumber', 'companyNumber', 'companyNumber'],
    ['queues', 'queue', 'queue', undefined], ['groups', 'group', 'group', undefined],
    ['robots', 'robot', 'robot', undefined], ['trunks', 'trunk', 'trunk', undefined],
  ] as const) {
    const values = query[key] || (legacy && query[legacy] ? [query[legacy]!] : []);
    add(key, label, values.map(value => facets?.options[kind]?.find(option => option.value === value)?.label || value));
  }
  add('handlings', 'handling', (query.handlings || (query.handling ? [query.handling] : [])).map(value => t(value === 'autodial' ? 'calls.autodial' : `calls.actor.${value}`)));
  if (query.recording) items.push({ key: 'recording', text: t(query.recording === 'yes' ? 'calls.withRecording' : 'calls.withoutRecording') });
  if (query.voicemail) items.push({ key: 'voicemail', text: t('calls.hasVoicemail') });
  if (query.analytics) add('analytics', 'analytics', [t(`calls.analysis.${query.analytics}`)]);
  // Drill-down links carry additional cohort constraints outside the composer.
  for (const [key, label] of [['callerEmployee', 'caller'], ['focusEmployee', 'employee'], ['focusDepartment', 'department'], ['focusCompanyNumber', 'companyNumber']] as const) {
    if (query[key]) add(key, label, [query[key]!]);
  }
  if (query.focusOutcome) add('focusOutcome', 'result', [t(`calls.outcome.${query.focusOutcome}`)]);
  if (query.dashboardOutcome) add('dashboardOutcome', 'result', [t(`calls.overviewOutcome.${query.dashboardOutcome}`)]);
  if (query.origin) add('origin', 'originLabel', [t(`calls.origin.${query.origin}`)]);
  if (query.unassignedDimensions?.length) add('unassigned', 'unassignedLabel', query.unassignedDimensions.map(value => t(`calls.unassigned.${value}`)));
  return items;
}
