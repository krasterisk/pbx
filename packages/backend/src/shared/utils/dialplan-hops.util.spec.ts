import {
  DEFAULT_HOP_LIMIT,
  HOPS_VAR,
  emitHopGuard,
  emitHopIncrement,
  emitHopPrologue,
  resolveHopDecision,
} from './dialplan-hops.util';

describe('dialplan hops (D-25)', () => {
  it('HOPS_VAR is inherited (double underscore)', () => {
    expect(HOPS_VAR).toBe('__KRSK_HOPS');
    expect(HOPS_VAR.startsWith('__')).toBe(true);
  });

  it('emitHopPrologue contains increment Set and guard in one emission', () => {
    const out = emitHopPrologue('sip-out42,100,1', { routeId: 'sip-out42' });
    expect(out).toContain(`Set(${HOPS_VAR}=`);
    expect(out).toContain(HOPS_VAR);
    expect(out).toMatch(/GotoIf\(\$\[/);
    expect(out).toContain('Congestion()');
    expect(out).toContain('NoOp(');
    expect(out.indexOf(`Set(${HOPS_VAR}`)).toBeLessThan(out.indexOf('GotoIf'));
  });

  it('increment and guard are not split across helpers used independently for the branch', () => {
    const increment = emitHopIncrement();
    const guard = emitHopGuard('Congestion()');
    const prologue = emitHopPrologue('ivr_7,start,1');
    expect(increment).toContain(`Set(${HOPS_VAR}=`);
    expect(guard).toContain(HOPS_VAR);
    expect(prologue).toContain(increment);
    expect(prologue).toContain('GotoIf');
  });

  it('missing incoming hops is treated as 0 via arithmetic default, not empty-string compare', () => {
    const increment = emitHopIncrement();
    expect(increment).toContain(`$[\${${HOPS_VAR}} + 1]`);
    expect(increment).not.toContain(`= ""`);
    expect(emitHopGuard('Congestion()')).not.toContain(`= ""`);
    expect(resolveHopDecision(undefined)).toBe('goto');
    expect(resolveHopDecision(0)).toBe('goto');
  });

  it('simulates a chain of limit hops then exceeds on limit+1', () => {
    const decisions = Array.from({ length: DEFAULT_HOP_LIMIT }, (_, i) =>
      resolveHopDecision(i),
    );
    expect(decisions.every((d) => d === 'goto')).toBe(true);
    expect(resolveHopDecision(DEFAULT_HOP_LIMIT)).toBe('exceed');

    const exceeded = emitHopPrologue('loop,100,1', { routeId: 'loop' });
    expect(exceeded).toContain('Congestion()');
    expect(exceeded).toMatch(/NoOp\(.*hop/i);
  });
});
