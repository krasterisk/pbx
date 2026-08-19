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
  });
});
