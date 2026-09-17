import { describe, it, expect } from 'vitest';
import { ru } from '@/shared/config/locales/ru';
import { en } from '@/shared/config/locales/en';
import { dialplanAppsRegistry } from '../registry';
import { buildToGroupSchema, readToGroupTarget, toGroupFixedKey } from './toGroup';

const t = (key: string, fallback?: string) => fallback ?? key;

function resolve(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

describe('buildToGroupSchema', () => {
  it('exposes a catalog value-source field instead of a static select', () => {
    const schema = buildToGroupSchema(t);
    expect(schema).toHaveLength(1);
    expect(schema[0]).toMatchObject({
      key: 'target',
      kind: 'value-source',
      optionsSource: 'callGroups',
      valueSourceMode: 'catalog',
    });
  });

  it('reads legacy params.group as a fixed target', () => {
    expect(readToGroupTarget({ group: '12' })).toBe('12');
    expect(toGroupFixedKey({ group: '12' })).toBe('12');
    expect(toGroupFixedKey({ target: { source: 'fixed', value: '600' } })).toBe('600');
    expect(toGroupFixedKey({ target: { source: 'route_pattern' } })).toBe('');
  });

  it('summarizes a catalog group by number and a dynamic source by name', () => {
    const refs = {
      callGroups: {
        items: [{ value: '600', label: '600 - Sales' }],
      },
    };
    expect(
      dialplanAppsRegistry.togroup.summarize(
        { target: { source: 'fixed', value: '600' } },
        t,
        refs,
      ),
    ).toContain('600');
    expect(
      dialplanAppsRegistry.togroup.summarize({ target: { source: 'route_pattern' } }, t),
    ).toMatch(/B-номер/i);
    expect(
      dialplanAppsRegistry.togroup.summarize({ group: '12' }, t),
    ).toContain('12');
  });

  it.each([
    'routes.chain.source.groupDynamicByNumber',
    'routes.chain.source.requiredCallGroup',
    'routes.chain.summary.togroup.routePattern',
    'routes.chain.togroup.targetHint',
  ] as const)('declares %s in ru and en', (key) => {
    expect(typeof resolve(ru, key)).toBe('string');
    expect(typeof resolve(en, key)).toBe('string');
  });
});
