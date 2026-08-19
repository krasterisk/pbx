import { normalizeTarget } from './dialplan-target.util';
import type { ValueSource } from '@krasterisk/shared';

describe('normalizeTarget', () => {
  it('queue + route_pattern returns q${EXTEN}_{uid}', () => {
    expect(normalizeTarget('queue', { source: 'route_pattern' }, 42)).toBe('q${EXTEN}_42');
  });

  it('queue + fixed value returns q{value}_{uid}', () => {
    expect(normalizeTarget('queue', { source: 'fixed', value: 'sales' }, 42)).toBe('qsales_42');
  });

  it('queue + variable returns q${name}_{uid}', () => {
    expect(normalizeTarget('queue', { source: 'variable', name: 'MYVAR' }, 42)).toBe('q${MYVAR}_42');
  });

  it('queue + fixed sanitizes newline and semicolon', () => {
    const out = normalizeTarget('queue', { source: 'fixed', value: 'a;b\nexten' }, 42);
    expect(out).not.toContain(';');
    expect(out).not.toContain('\n');
    expect(out).toBe('qabexten_42');
  });

  it('queue + phonebook returns q${PB_TARGET}_{uid}', () => {
    expect(
      normalizeTarget('queue', { source: 'phonebook', phonebookUid: 7, varKey: 'queue' }, 42),
    ).toBe('q${PB_TARGET}_42');
  });

  it('queue result always carries the tenant suffix for every ValueSource', () => {
    const sources: ValueSource[] = [
      { source: 'fixed', value: 'sales' },
      { source: 'route_pattern' },
      { source: 'variable', name: 'MYVAR' },
      { source: 'phonebook', phonebookUid: 7, varKey: 'queue' },
    ];
    for (const src of sources) {
      expect(normalizeTarget('queue', src, 42)).toMatch(/^q.+_42$/);
    }
  });

  it('exten delegates to pjsipDialTarget', () => {
    const out = normalizeTarget('exten', { source: 'fixed', value: '101' }, 42);
    expect(out).toContain('PJSIP/e101_42');
  });

  it('group uses group_{raw}_{uid}', () => {
    expect(normalizeTarget('group', { source: 'fixed', value: 'sales' }, 42)).toBe('group_sales_42');
  });

  it('context concatenates uid with endsWith guard', () => {
    expect(normalizeTarget('context', { source: 'fixed', value: 'from-internal' }, 42)).toBe('from-internal42');
    expect(normalizeTarget('context', { source: 'fixed', value: 'from-internal42' }, 42)).toBe('from-internal42');
  });
});
