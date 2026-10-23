import { describe, expect, it } from 'vitest';
import {
  callDuration,
  callTime,
  patchCallsQuery,
  readCallsQuery,
} from './callsUrl';
describe('company call navigation', () => {
  it('keeps multiple ring groups in links and clears them independently',()=>{
    const next=patchCallsQuery(new URLSearchParams('employees=201&cursor=old'),{groups:['700','701']});
    expect(readCallsQuery(next)).toMatchObject({groups:['700','701'],employees:['201']});
    const cleared=readCallsQuery(patchCallsQuery(next,{groups:undefined}));expect(cleared.groups).toBeUndefined();expect(cleared.employees).toEqual(['201']);
  });
  it('roundtrips multi-direction, handling, number lists and results and removes legacy single values', () => {
    const next = patchCallsQuery(new URLSearchParams('direction=in&handling=employee&outcome=missed&cursor=old'), {
      directions:['in','out'],handlings:['employee','voiceRobot'],numbers:['79135551122','79135553344'],numberRole:'caller',trunks:['t_main_42'],results:['busy'],
    });
    expect(next.has('direction')).toBe(false);
    expect(next.has('handling')).toBe(false);
    expect(next.has('outcome')).toBe(false);
    expect(next.has('cursor')).toBe(false);
    expect(readCallsQuery(next)).toMatchObject({directions:['in','out'],handlings:['employee','voiceRobot'],numbers:['79135551122','79135553344'],numberRole:'caller',trunks:['t_main_42'],results:['busy']});
  });
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

it('keeps the custom-period marker out of API queries and clears it on a new period',()=>{
 const params=new URLSearchParams('periodPreset=custom&dateFrom=2026-10-16&dateTo=2026-10-22');
 expect(readCallsQuery(params)).not.toHaveProperty('periodPreset');
 expect(patchCallsQuery(params,{dateFrom:'2026-10-22',dateTo:'2026-10-22'}).has('periodPreset')).toBe(false);
});
