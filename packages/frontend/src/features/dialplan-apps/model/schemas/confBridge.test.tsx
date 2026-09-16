import { describe, it, expect } from 'vitest';
import { ru } from '@/shared/config/locales/ru';
import { en } from '@/shared/config/locales/en';
import { dialplanAppsRegistry } from '../registry';
import { buildConfBridgeSchema } from './confBridge';

const t = (key: string, fallback?: string) => fallback ?? key;

function resolve(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

const LOCALE_KEYS = [
  'routes.chain.catalog.conferencesSection',
  'conferences.orphanRoom',
  'conferences.selectRoom',
] as const;

describe('buildConfBridgeSchema (16-04)', () => {
  it('exposes a single catalog room field', () => {
    const schema = buildConfBridgeSchema(t);
    expect(schema).toHaveLength(1);
    expect(schema[0]).toMatchObject({
      key: 'room',
      optionsSource: 'conferenceRooms',
      valueSourceMode: 'queue',
    });
  });

  it('does not keep the accepted-risk hint about a shared conference', () => {
    const hint = buildConfBridgeSchema(t)[0]?.hint ?? '';
    expect(hint).not.toContain('одну конференцию');
  });

  it('summarizes a catalog room by number and a dynamic source by name', () => {
    const refs = {
      conferenceRooms: {
        items: [{ value: '77', label: '6007 - Планёрка' }],
      },
    };
    expect(
      dialplanAppsRegistry.confbridge.summarize(
        { room: { source: 'fixed', value: '77' } },
        t,
        refs,
      ),
    ).toContain('6007');
    expect(
      dialplanAppsRegistry.confbridge.summarize({ room: { source: 'route_pattern' } }, t),
    ).toMatch(/B-номер/i);
  });

  it('does not add a bridge-profile field', () => {
    expect(buildConfBridgeSchema(t).some((field) => field.key === 'options')).toBe(false);
  });

  it.each(LOCALE_KEYS)('declares %s in ru and en', (key) => {
    expect(typeof resolve(ru, key)).toBe('string');
    expect(typeof resolve(en, key)).toBe('string');
  });

});
