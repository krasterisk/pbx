import { describe, expect, it } from 'vitest';
import { buildReportsLink, buildReportsSearch, parseReportsUrl } from './reportsUrlState';

const defaults = { dateFrom: '2026-07-08', dateTo: '2026-07-15' };
const parse = (q: string) => parseReportsUrl(new URLSearchParams(q), defaults);

describe('parseReportsUrl', () => {
  it('uses the page defaults for an empty URL', () => {
    expect(parse('')).toEqual({ reportId: 'queue-summary', ...defaults, queueName: '', agentInterface: '', operatorUserId: '' });
  });

  it('reads report, dates, queue and agent', () => {
    expect(parse('report=pause-report&from=2026-07-01&to=2026-07-03&queue=sales&agent=PJSIP%2Fe110_0')).toEqual({
      reportId: 'pause-report',
      dateFrom: '2026-07-01',
      dateTo: '2026-07-03',
      queueName: 'sales',
      agentInterface: 'PJSIP/e110_0',
      operatorUserId: '',
    });
  });

  it('keeps several queues, in order and without duplicates', () => {
    expect(parse('queue=sales&queue=support&queue=sales')).toMatchObject({ queueName: 'sales,support' });
    expect(buildReportsSearch({
      reportId: 'queue-summary', ...defaults, queueName: 'sales,support', agentInterface: '', operatorUserId: '',
    })).toBe('from=2026-07-08&to=2026-07-15&queue=sales&queue=support');
  });

  it('reads the stable operator user id and ignores a non-numeric one', () => {
    expect(parse('operator=42')).toMatchObject({ operatorUserId: '42' });
    expect(parse('operator=abc')).toMatchObject({ operatorUserId: '' });
  });

  it('ignores an unknown report and malformed dates', () => {
    expect(parse('report=drop-table&from=yesterday&to=2026-07-20')).toMatchObject({
      reportId: 'queue-summary',
      dateFrom: defaults.dateFrom,
      dateTo: '2026-07-20',
    });
  });

  it('a reversed range is a broken link: both bounds fall back to the defaults', () => {
    expect(parse('from=2026-07-10&to=2026-07-01')).toMatchObject(defaults);
  });
});

describe('buildReportsSearch / buildReportsLink', () => {
  it('leaves out the default report and empty filters', () => {
    expect(buildReportsSearch({ reportId: 'queue-summary', dateFrom: '2026-07-01', dateTo: '2026-07-02', queueName: '', agentInterface: '', operatorUserId: '' })).toBe('from=2026-07-01&to=2026-07-02');
  });

  it('round-trips through the parser', () => {
    const state = { reportId: 'missed-callback' as const, dateFrom: '2026-07-01', dateTo: '2026-07-02', queueName: 'sales support', agentInterface: 'PJSIP/e1', operatorUserId: '7' };
    expect(parseReportsUrl(new URLSearchParams(buildReportsSearch(state)), defaults)).toEqual(state);
  });

  it('builds a drill link into the reports page', () => {
    expect(buildReportsLink({ dateFrom: '2026-07-15', dateTo: '2026-07-15', queueName: 'sales' })).toBe(
      '/callcenter/reports?from=2026-07-15&to=2026-07-15&queue=sales',
    );
    expect(buildReportsLink({ reportId: 'pause-report', dateFrom: '2026-07-01', dateTo: '2026-07-07' })).toBe(
      '/callcenter/reports?report=pause-report&from=2026-07-01&to=2026-07-07',
    );
  });
});
