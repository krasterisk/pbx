import {
  CONDITION_SOURCES,
  HTTP_RESULT_VAR,
  QUEUESTATUS_VALUES,
} from '@krasterisk/shared';
import { buildConditionExpr, wrapEachLine } from './dialplan-condition.util';

describe('buildConditionExpr / wrapEachLine (D-43)', () => {
  it('wrapEachLine wraps every application, keeping same => n, prefixes', () => {
    const out = wrapEachLine(
      '${DIALSTATUS}=NOANSWER',
      'same => n,NoOp(a)\nsame => n,NoOp(b)',
    );
    expect(out).toBe(
      [
        'same => n,ExecIf($[${DIALSTATUS}=NOANSWER]?NoOp(a))',
        'same => n,ExecIf($[${DIALSTATUS}=NOANSWER]?NoOp(b))',
      ].join('\n'),
    );
    expect(out).not.toContain('ExecIf($[${DIALSTATUS}=NOANSWER]?same =>');
  });

  it('wrapEachLine with empty expr returns dp unchanged', () => {
    const dp = 'same => n,NoOp(a)\nsame => n,NoOp(b)';
    expect(wrapEachLine('', dp)).toBe(dp);
  });

  it('does not wrap a lone empty line leftover', () => {
    expect(wrapEachLine('X', 'NoOp(a)\n\nNoOp(b)')).toBe(
      ['ExecIf($[X]?NoOp(a))', 'ExecIf($[X]?NoOp(b))'].join('\n'),
    );
  });

  it('converts Goto(...) to GotoIf, not ExecIf(Goto)', () => {
    expect(wrapEachLine('G', 'Goto(ivr_7,start,1)')).toBe('GotoIf($[G]?ivr_7,start,1)');
    expect(wrapEachLine('G', 'same => n,Goto(t2)')).toBe('same => n,GotoIf($[G]?t2)');
  });

  it('ANDs the guard into an existing GotoIf', () => {
    expect(wrapEachLine('"A" = "1"', 'same => n,GotoIf($["${TC_PICK}" = "1"]?t1)')).toBe(
      'same => n,GotoIf($[("A" = "1") & ("${TC_PICK}" = "1")]?t1)',
    );
  });

  it('buildConditionExpr matches legacy DIALSTATUS OR-join semantics', () => {
    expect(buildConditionExpr({ dialstatus: 'ANSWER' })).toBe('"${DIALSTATUS}" = "ANSWER"');
    expect(buildConditionExpr({ dialstatus: ['ANSWER', 'NOANSWER'] })).toBe(
      '"${DIALSTATUS}" = "ANSWER" | "${DIALSTATUS}" = "NOANSWER"',
    );
    expect(buildConditionExpr({ dialstatus: ['BOGUS'] })).toBe('');
    expect(buildConditionExpr({})).toBe('');
    expect(buildConditionExpr(undefined)).toBe('');
  });
});

describe('buildConditionExpr ConditionSource (D-22)', () => {
  it('QUEUESTATUS_VALUES is exactly the D-22 set of 5', () => {
    expect(QUEUESTATUS_VALUES).toEqual([
      'TIMEOUT',
      'FULL',
      'JOINEMPTY',
      'LEAVEEMPTY',
      'CONTINUE',
    ]);
    expect(QUEUESTATUS_VALUES).toHaveLength(5);
  });

  it('source dialstatus matches the legacy DIALSTATUS expression (regression)', () => {
    const legacy = buildConditionExpr({ dialstatus: ['NOANSWER', 'BUSY'] });
    const next = buildConditionExpr({ source: 'dialstatus', values: ['NOANSWER', 'BUSY'] });
    expect(next).toBe(legacy);
    expect(next).toBe('"${DIALSTATUS}" = "NOANSWER" | "${DIALSTATUS}" = "BUSY"');
  });

  it('source queuestatus emits QUEUESTATUS comparison', () => {
    expect(buildConditionExpr({ source: 'queuestatus', values: ['FULL'] })).toBe(
      '"${QUEUESTATUS}" = "FULL"',
    );
  });

  it('source device_state emits DEVICE_STATE(...) comparison', () => {
    expect(
      buildConditionExpr({
        source: 'device_state',
        device: 'PJSIP/e101_42',
        values: ['BUSY'],
      }),
    ).toBe('"${DEVICE_STATE(PJSIP/e101_42)}" = "BUSY"');
  });

  it('source variable compares ${NAME} after sanitizing the name', () => {
    expect(
      buildConditionExpr({ source: 'variable', name: 'MYVAR', op: 'eq', value: '1' }),
    ).toBe('"${MYVAR}" = "1"');
    expect(
      buildConditionExpr({
        source: 'variable',
        name: '${EVIL}; exten',
        op: 'eq',
        value: '1',
      }),
    ).toBe('');
  });

  it('source http_result reads the single D-47 variable name', () => {
    const expr = buildConditionExpr({ source: 'http_result', op: 'eq', value: 'ok' });
    expect(expr).toBe(`"\${${HTTP_RESULT_VAR}}" = "ok"`);
    expect(expr).toContain(HTTP_RESULT_VAR);
  });

  it('empty condition and wrapEachLine leftover stay a no-op (12-05 joint)', () => {
    expect(buildConditionExpr({})).toBe('');
    expect(buildConditionExpr(undefined)).toBe('');
    const dp = 'same => n,NoOp(a)';
    expect(wrapEachLine('', dp)).toBe(dp);
    expect(wrapEachLine(buildConditionExpr({}), dp)).toBe(dp);
  });

  it.each([
    [{ source: 'dialstatus' as const, values: ['NOANSWER'] }],
    [{ source: 'queuestatus' as const, values: ['FULL'] }],
    [{ source: 'device_state' as const, device: 'PJSIP/e101_42', values: ['BUSY'] }],
    [{ source: 'variable' as const, name: 'MY_VAR', op: 'eq' as const, value: '1' }],
    [{ source: 'http_result' as const, op: 'eq' as const, value: 'ok' }],
  ])('source %j yields a nonempty expression', (cond) => {
    expect(CONDITION_SOURCES).toContain(cond.source);
    expect(buildConditionExpr(cond).length).toBeGreaterThan(0);
  });
});
