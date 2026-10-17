import { CC_REPORT_IDS, type CcReportId } from '@/shared/api/endpoints/callCenterReportsApi';

export const REPORTS_PATH = '/callcenter/reports';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Everything the reports page keeps in its URL, so a view can be sent as a link and survive a reload. */
export interface ReportsUrlState {
  reportId: CcReportId;
  dateFrom: string;
  dateTo: string;
  queueName: string;
  /** Legacy / drill-down link: a raw agent interface. Prefer `operatorUserId`. */
  agentInterface: string;
  /** Stable user id of the picked operator; the interface is resolved from it on request (U3.1). */
  operatorUserId: string;
  /** `previous` repeats the report for the window just before this one. */
  compare: '' | 'previous';
  groupBy: '' | 'day' | 'queue';
}

export interface ReportsUrlDefaults {
  dateFrom: string;
  dateTo: string;
}

const isReportId = (value: string | null): value is CcReportId =>
  value !== null && (CC_REPORT_IDS as readonly string[]).includes(value);

/** Queue names from a comma-separated value, without blanks or duplicates. */
export function splitQueueNames(value: string): string[] {
  return [...new Set(value.split(',').map((part) => part.trim()).filter(Boolean))];
}

/** Reads the URL; anything missing or malformed falls back to the page defaults. */
export function parseReportsUrl(search: URLSearchParams, defaults: ReportsUrlDefaults): ReportsUrlState {
  const report = search.get('report');
  const from = search.get('from');
  const to = search.get('to');
  const validFrom = from !== null && DATE_KEY.test(from) ? from : defaults.dateFrom;
  const validTo = to !== null && DATE_KEY.test(to) ? to : defaults.dateTo;
  // A reversed range is a broken link, not a request: use the defaults for both bounds.
  const reversed = validFrom > validTo;
  return {
    reportId: isReportId(report) ? report : 'queue-summary',
    dateFrom: reversed ? defaults.dateFrom : validFrom,
    dateTo: reversed ? defaults.dateTo : validTo,
    queueName: search.getAll('queue').flatMap(splitQueueNames).filter((name, index, all) => all.indexOf(name) === index).join(','),
    agentInterface: (search.get('agent') ?? '').trim(),
    operatorUserId: /^\d+$/.test((search.get('operator') ?? '').trim()) ? (search.get('operator') ?? '').trim() : '',
    compare: search.get('compare') === 'previous' ? 'previous' : '',
    groupBy: search.get('group') === 'day' || search.get('group') === 'queue' ? search.get('group') as 'day' | 'queue' : '',
  };
}

/** Query string of a state; empty values and the default report are left out. */
export function buildReportsSearch(state: ReportsUrlState): string {
  const params = new URLSearchParams();
  if (state.reportId !== 'queue-summary') params.set('report', state.reportId);
  params.set('from', state.dateFrom);
  params.set('to', state.dateTo);
  for (const name of splitQueueNames(state.queueName)) params.append('queue', name);
  if (state.agentInterface) params.set('agent', state.agentInterface);
  if (state.operatorUserId) params.set('operator', state.operatorUserId);
  if (state.compare) params.set('compare', state.compare);
  if (state.groupBy) params.set('group', state.groupBy);
  return params.toString();
}

export interface ReportsLinkInput {
  reportId?: CcReportId;
  dateFrom: string;
  dateTo: string;
  queueName?: string;
  agentInterface?: string;
  operatorUserId?: number | string;
}

/** Link into the reports page, used by dashboard drill-downs. */
export function buildReportsLink(input: ReportsLinkInput): string {
  return `${REPORTS_PATH}?${buildReportsSearch({
    reportId: input.reportId ?? 'queue-summary',
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    queueName: input.queueName ?? '',
    agentInterface: input.agentInterface ?? '',
    operatorUserId: input.operatorUserId ? String(input.operatorUserId) : '',
    compare: '',
    groupBy: '',
  })}`;
}
