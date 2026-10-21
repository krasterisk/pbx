import type { CallsQuery } from '@krasterisk/shared';
const directions = new Set(['in', 'out', 'internal', 'external']);
const outcomes = new Set([
  'human',
  'robot',
  'voicemail',
  'menu',
  'missed',
  'error',
  'unknown',
  'active',
]);
const handling = new Set([
  'employee',
  'queue',
  'menu',
  'voiceRobot',
  'aiRobot',
  'autodial',
]);
export function readCallsQuery(params: URLSearchParams): CallsQuery {
  const direction = params.get('direction');
  const outcome = params.get('outcome');
  const handler = params.get('handling');
  // Old links keep their useful meaning, without exposing raw dispositions in the UI.
  const legacyOutcome = params.get('disposition');
  const overviewOutcome =
    params.get('dashboardOutcome') ||
    (params.get('dashboard') === '1' ? outcome : null) ||
    (['answered', 'ANSWERED'].includes(legacyOutcome || '')
      ? 'accepted'
      : null);
  const period = params.has('dateFrom') || params.has('dateTo');
  return {
    callerEmployee: params.get('callerEmployee') || undefined,
    search: params.get('search') || undefined,
    focusEmployee: params.get('focusEmployee') || undefined,
    focusDepartment: params.get('focusDepartment') || undefined,
    focusCompanyNumber: params.get('focusCompanyNumber') || undefined,
    attentionView: params.get('attentionView') === 'all' ? 'all' : undefined,
    unassignedDimensions: params
      .getAll('unassignedDimensions')
      .filter((v) =>
        ['employee', 'department', 'companyNumber'].includes(v),
      ) as CallsQuery['unassignedDimensions'],
    focusOutcome: outcomes.has(params.get('focusOutcome') || '')
      ? (params.get('focusOutcome') as CallsQuery['focusOutcome'])
      : undefined,
    ...(period
      ? {
          dateFrom: params.get('dateFrom') || '',
          dateTo: params.get('dateTo') || '',
        }
      : {}),
    direction:
      direction && directions.has(direction)
        ? (direction as CallsQuery['direction'])
        : direction === 'int'
          ? 'internal'
          : undefined,
    outcome:
      params.get('dashboard') !== '1' && outcome && outcomes.has(outcome)
        ? (outcome as CallsQuery['outcome'])
        : legacyOutcome === 'missed'
          ? 'missed'
          : undefined,
    dashboardOutcome:
      overviewOutcome &&
      ['accepted', 'missed', 'unknown', 'active'].includes(overviewOutcome)
        ? (overviewOutcome as CallsQuery['dashboardOutcome'])
        : undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    origin: ['ai', 'telephony', 'autodial'].includes(params.get('origin') || '')
      ? (params.get('origin') as CallsQuery['origin'])
      : undefined,
    handling:
      handler && handling.has(handler)
        ? (handler as CallsQuery['handling'])
        : undefined,
    extension: params.get('extension') || undefined,
    voicemail: params.get('voicemail') === '1' ? '1' : undefined,
    companyNumber: params.get('companyNumber') || undefined,
    department: params.get('department') || undefined,
    ...Object.fromEntries(
      ['employees', 'departments', 'companyNumbers', 'queues', 'robots'].map(
        (key) => [
          key,
          params.has(key)
            ? [...new Set(params.getAll(key).filter(Boolean))]
            : undefined,
        ],
      ),
    ),
    outcomes: params.has('outcomes')
      ? (params
          .getAll('outcomes')
          .filter((v) => outcomes.has(v)) as CallsQuery['outcomes'])
      : undefined,
    recording: ['yes', 'no'].includes(params.get('recording') || '')
      ? (params.get('recording') as CallsQuery['recording'])
      : undefined,
    analytics: ['none', 'queued', 'running', 'analyzed', 'failed'].includes(
      params.get('analytics') || '',
    )
      ? (params.get('analytics') as CallsQuery['analytics'])
      : undefined,
    cursor: params.get('cursor') || undefined,
    limit: 50,
  };
}
export function patchCallsQuery(
  params: URLSearchParams,
  patch: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const original = readCallsQuery(params);
  if (original.outcome && !next.has('outcome'))
    next.set('outcome', original.outcome);
  if (original.dashboardOutcome && !next.has('dashboardOutcome'))
    next.set('dashboardOutcome', original.dashboardOutcome);
  if (params.get('dashboard') === '1' && params.get('outcome')) {
    next.set('dashboardOutcome', params.get('outcome')!);
    next.delete('outcome');
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'outcome'))
    next.delete('dashboardOutcome');
  if (Object.prototype.hasOwnProperty.call(patch, 'outcomes')) {
    next.delete('outcome');
    next.delete('dashboardOutcome');
  }
  for (const [modern, legacy] of [
    ['employees', 'extension'],
    ['departments', 'department'],
    ['companyNumbers', 'companyNumber'],
  ]) {
    if (Object.prototype.hasOwnProperty.call(patch, modern))
      next.delete(legacy);
  }
  if (
    Object.prototype.hasOwnProperty.call(patch, 'dateFrom') ||
    Object.prototype.hasOwnProperty.call(patch, 'dateTo')
  ) {
    next.delete('from');
    next.delete('to');
  }
  next.delete('cursor');
  next.delete('page');
  next.delete('dashboard');
  next.delete('disposition');
  for (const [key, value] of Object.entries(patch)) {
    next.delete(key);
    if (value !== undefined)
      for (const entry of Array.isArray(value) ? value : [value])
        next.append(key, entry);
  }
  return next;
}
export function callDuration(
  seconds: number | null,
  approximate = false,
): string {
  if (seconds === null) return '-';
  return `${approximate ? '≈ ' : ''}${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export function callTime(
  value: string,
  timezone: string,
  locale: string,
): string {
  if (!Number.isFinite(Date.parse(value))) return '-';
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
export function callOutcomeKey(call: {
  direction: string;
  outcome: string;
}): string {
  if (call.outcome === 'human' && call.direction === 'out')
    return 'calls.outgoingConnected';
  if (call.outcome === 'human' && call.direction === 'internal')
    return 'calls.internalConnected';
  if (call.outcome === 'missed' && call.direction === 'out')
    return 'calls.outgoingMissed';
  return `calls.outcome.${call.outcome}`;
}
