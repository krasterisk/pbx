import { describe, expect, it } from 'vitest';
import {
  callDuration,
  callTime,
  patchCallsQuery,
  readCallsQuery,
} from './callsUrl';
describe('company call navigation', () => {
  it('roundtrips repeated directory filters without splitting names and replaces legacy single values', () => {
    const params = patchCallsQuery(
      new URLSearchParams('extension=201&outcome=human&cursor=old&call=abc'),
      {
        employees: ['201', '202'],
        departments: ['Продажи, B2B'],
        outcomes: ['human', 'missed'],
      },
    );
    expect(params.getAll('employees')).toEqual(['201', '202']);
    expect(readCallsQuery(params)).toMatchObject({
      employees: ['201', '202'],
      departments: ['Продажи, B2B'],
      outcomes: ['human', 'missed'],
      extension: undefined,
      outcome: undefined,
      cursor: undefined,
    });
    expect(params.get('call')).toBe('abc');
    expect(patchCallsQuery(params, { employees: [] }).has('employees')).toBe(
      false,
    );
  });
  it('leaves the initial organization day to the server and preserves an explicit full-history request', () => {
    expect(readCallsQuery(new URLSearchParams())).not.toHaveProperty(
      'dateFrom',
    );
    expect(
      readCallsQuery(new URLSearchParams('dateFrom=&dateTo=')),
    ).toMatchObject({
      dateFrom: '',
      dateTo: '',
    });
  });
  it('changes a filter without losing the selected call, while discarding cursors and legacy flags', () => {
    const params = patchCallsQuery(
      new URLSearchParams(
        'call=abc&cursor=old&page=3&dashboard=1&extension=201',
      ),
      { outcome: 'missed' },
    );
    expect(params.get('call')).toBe('abc');
    expect(params.get('extension')).toBe('201');
    expect(params.get('outcome')).toBe('missed');
    expect(params.has('cursor')).toBe(false);
    expect(params.has('page')).toBe(false);
    expect(params.has('dashboard')).toBe(false);
  });
  it('preserves a real zero and formats timestamps with the organization timezone', () => {
    expect(callDuration(0)).toBe('0:00');
    expect(callDuration(null)).toBe('-');
    expect(callDuration(20, true)).toBe('≈ 0:20');
    expect(callDuration(null, true)).toBe('-');
    expect(
      callTime('2026-10-18T03:00:00Z', 'Asia/Krasnoyarsk', 'ru'),
    ).toContain('10:00');
  });
  it('preserves the exact dashboard interval, origin and aggregate outcome when refining a deep link', () => {
    const params = new URLSearchParams(
      'dashboard=1&from=2026-10-01T00:00:00Z&to=2026-10-02T00:00:00Z&outcome=missed&origin=ai',
    );
    const query = readCallsQuery(params);
    expect(query).toMatchObject({
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-02T00:00:00Z',
      dashboardOutcome: 'missed',
      origin: 'ai',
    });
    expect(query.outcome).toBeUndefined();
    expect(
      readCallsQuery(patchCallsQuery(params, { search: 'Анна' })),
    ).toMatchObject({
      dashboardOutcome: 'missed',
      origin: 'ai',
      search: 'Анна',
    });
    expect(
      readCallsQuery(patchCallsQuery(params, { outcome: 'human' })),
    ).toMatchObject({
      outcome: 'human',
      dashboardOutcome: undefined,
    });
  });
});
